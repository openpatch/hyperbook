const scriptBase = new URL("./", self.location.href);

const FONTS_CONF = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>/fonts</dir>
</fontconfig>`;

const KNOWN_LIBRARIES = {
  BOSL2: "https://ochafik.com/openscad2/libraries/BOSL2.zip",
  BOSL: "https://ochafik.com/openscad2/libraries/BOSL.zip",
  MCAD: "https://ochafik.com/openscad2/libraries/MCAD.zip",
  NopSCADlib: "https://ochafik.com/openscad2/libraries/NopSCADlib.zip",
  fonts: "https://ochafik.com/openscad2/libraries/fonts.zip",
};
const OPENSCAD_BACKEND_ARG = "--backend=manifold";
const OPENSCAD_FEATURE_ARGS = ["--enable=lazy-union"];

let openscadModulePromise = null;
let robotoFontData = null;

// Per-name cache of extracted file maps: Map<name, { [path]: Uint8Array }>
const libraryCache = new Map();

const invokeOpenScad = (instance, args) => {
  try {
    return instance.callMain(args);
  } catch (e) {
    if (typeof e === "number" && typeof instance.formatException === "function") {
      throw new Error(`OpenSCAD invocation failed: ${instance.formatException(e)}`);
    }
    throw new Error(`OpenSCAD invocation failed: ${e}`);
  }
};

const getOpenScad = async (mergedOutputs) => {
  if (!openscadModulePromise) {
    openscadModulePromise = import(/* @vite-ignore */ new URL("openscad.js", scriptBase).href);
  }
  const OpenSCAD = (await openscadModulePromise).default;
  const instance = await OpenSCAD({
    noInitialRun: true,
    locateFile: (file) => new URL(file, scriptBase).href,
    print: (text) => mergedOutputs.push({ stdout: text }),
    printErr: (text) => mergedOutputs.push({ stderr: text }),
  });
  const fs = instance.FS;
  try {
    fs.mkdir("/tmp");
  } catch (_) {}
  try {
    fs.mkdir("/fonts");
  } catch (_) {}
  // Fonts are resolved from $(cwd)/fonts — keep cwd at /
  try {
    instance.FS.chdir("/");
  } catch (_) {}
  try {
    fs.writeFile("/fonts/fonts.conf", FONTS_CONF);
  } catch (_) {}
  // Write cached font data if already fetched.
  if (robotoFontData) {
    try {
      fs.writeFile("/fonts/Roboto-Regular.ttf", robotoFontData);
    } catch (_) {}
  }
  return instance;
};

// Minimal ZIP extractor using the browser-native DecompressionStream API.
// Supports Stored (method 0) and Deflate (method 8) entries.
const extractZip = async (buffer) => {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const files = {};
  const dec = new TextDecoder();

  // Locate End of Central Directory record.
  let eocdPos = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65558); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdPos = i;
      break;
    }
  }
  if (eocdPos < 0) throw new Error("Not a valid ZIP file");

  const entryCount = view.getUint16(eocdPos + 10, true);
  let cdOffset = view.getUint32(eocdPos + 16, true);

  for (let i = 0; i < entryCount; i++) {
    if (view.getUint32(cdOffset, true) !== 0x02014b50) break;
    const compression = view.getUint16(cdOffset + 10, true);
    const compressedSize = view.getUint32(cdOffset + 20, true);
    const fnLen = view.getUint16(cdOffset + 28, true);
    const extraLen = view.getUint16(cdOffset + 30, true);
    const commentLen = view.getUint16(cdOffset + 32, true);
    const localOffset = view.getUint32(cdOffset + 42, true);
    const name = dec.decode(bytes.subarray(cdOffset + 46, cdOffset + 46 + fnLen));
    cdOffset += 46 + fnLen + extraLen + commentLen;

    if (name.endsWith("/")) continue;

    const localFnLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localFnLen + localExtraLen;
    const compressed = bytes.subarray(dataStart, dataStart + compressedSize);

    if (compression === 0) {
      files[name] = new Uint8Array(compressed);
    } else if (compression === 8) {
      const ds = new DecompressionStream("deflate-raw");
      const writer = ds.writable.getWriter();
      const reader = ds.readable.getReader();
      writer.write(compressed);
      writer.close();
      const chunks = [];
      let totalLen = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        totalLen += value.byteLength;
      }
      const out = new Uint8Array(totalLen);
      let pos = 0;
      for (const c of chunks) {
        out.set(c, pos);
        pos += c.byteLength;
      }
      files[name] = out;
    }
  }
  return files;
};

const loadLibrary = async (name) => {
  if (libraryCache.has(name)) return libraryCache.get(name);
  const url = KNOWN_LIBRARIES[name];
  if (!url) throw new Error(`Unknown OpenSCAD library: ${name}`);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch library ${name}: ${resp.status}`);
  const files = await extractZip(await resp.arrayBuffer());
  libraryCache.set(name, files);
  return files;
};

// Mount a list of libraries into a WASM FS instance.
// Each library is written to /<name>/<file> so `use <BOSL2/std.scad>` resolves correctly.
const mountLibraries = async (instance, libraryNames) => {
  for (const libName of libraryNames) {
    const files = await loadLibrary(libName);
    try {
      instance.FS.mkdir(`/${libName}`);
    } catch (_) {}
    for (const [filePath, data] of Object.entries(files)) {
      const parts = filePath.split("/");
      let dir = `/${libName}`;
      for (let j = 0; j < parts.length - 1; j++) {
        dir += "/" + parts[j];
        try {
          instance.FS.mkdir(dir);
        } catch (_) {}
      }
      try {
        instance.FS.writeFile(`/${libName}/${filePath}`, data);
      } catch (_) {}
    }
  }
};

// Fetch the Roboto TTF once and cache it in memory so it can be written
// to each new WASM instance's FS to enable OpenSCAD text() rendering.
const loadFonts = async () => {
  if (robotoFontData) return;
  try {
    const resp = await fetch("https://fonts.gstatic.com/s/roboto/v32/KFOmCnqEu92Fr1Me5Q.ttf");
    if (resp.ok) {
      robotoFontData = new Uint8Array(await resp.arrayBuffer());
    }
  } catch (e) {
    console.warn("[openscad] Failed to load fonts:", e);
  }
};

const toArrayBuffer = (content) => {
  const typed = content instanceof Uint8Array ? content : new Uint8Array(content || []);
  return typed.buffer.slice(typed.byteOffset, typed.byteOffset + typed.byteLength);
};

const serializeInvocationResults = (result) => {
  const transfer = [];
  const outputs = (result.outputs || []).map(([path, content]) => {
    const buffer = toArrayBuffer(content);
    transfer.push(buffer);
    return [path, buffer];
  });
  return {
    result: {
      ...result,
      outputs,
    },
    transfer,
  };
};

const getExtractedParameters = (result) => {
  if (result?.error || result?.exitCode !== 0) {
    return [];
  }
  const output = result?.outputs?.[0]?.[1];
  if (!output) return [];
  try {
    const bytes = output instanceof Uint8Array ? output : new Uint8Array(output);
    const json = new TextDecoder().decode(bytes);
    const paramSet = JSON.parse(json);
    if (!Array.isArray(paramSet?.parameters)) return [];
    return paramSet.parameters.filter((p) => !p.name?.startsWith("$"));
  } catch (_) {
    return [];
  }
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const toFiniteNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const buildParamFormUi = (codeParams, currentOverrides = {}, id = "model") => {
  if (!Array.isArray(codeParams) || codeParams.length === 0) {
    return { hasParams: false, html: "", values: {} };
  }

  const values = {};

  const appendNumberAttrs = (min, max, step) => {
    let attrs = "";
    if (step != null) attrs += ` step="${escapeHtml(String(step))}"`;
    else attrs += ' step="any"';
    if (min != null) attrs += ` min="${escapeHtml(String(min))}"`;
    if (max != null) attrs += ` max="${escapeHtml(String(max))}"`;
    return attrs;
  };

  const buildParamRow = (param, index) => {
    const name = param?.name;
    if (!name) return null;
    const caption = param?.caption || name;
    const type = param?.type;
    const initial = param?.initial;
    const min = param?.min;
    const max = param?.max;
    const step = param?.step;
    const options = Array.isArray(param?.options) ? param.options : [];
    const current = Object.prototype.hasOwnProperty.call(currentOverrides, name)
      ? currentOverrides[name]
      : initial;

    const inputId = `openscad-param-${id}-${index}`;
    let controlHtml = "";

    if (type === "boolean") {
      const value = Boolean(current);
      values[name] = value;
      controlHtml = `<input id="${escapeHtml(inputId)}" type="checkbox" data-param-name="${escapeHtml(name)}" data-param-kind="boolean"${value ? " checked" : ""}>`;
    } else if (options.length > 0) {
      let selectedIndex = options.findIndex((opt) => String(opt?.value) === String(current));
      if (selectedIndex < 0) selectedIndex = 0;
      const selectedValue = options[selectedIndex]?.value ?? null;
      values[name] = selectedValue;
      const optionHtml = options.map((opt, optIndex) => {
        const optLabel = opt?.name || String(opt?.value);
        const optValueJson = JSON.stringify(opt?.value ?? null);
        const selected = optIndex === selectedIndex ? " selected" : "";
        return `<option value="${escapeHtml(String(optIndex))}" data-param-option-value="${escapeHtml(optValueJson)}"${selected}>${escapeHtml(optLabel)}</option>`;
      }).join("");
      controlHtml = `<select id="${escapeHtml(inputId)}" data-param-name="${escapeHtml(name)}" data-param-kind="option">${optionHtml}</select>`;
    } else if (type === "number" && Array.isArray(initial)) {
      const source = Array.isArray(current) ? current : initial;
      const vector = source.map((entry) => toFiniteNumber(entry));
      values[name] = vector;
      const vectorInputs = vector.map((entry, vectorIndex) =>
        `<input id="${escapeHtml(`${inputId}-${vectorIndex}`)}" type="number" value="${escapeHtml(String(entry))}" data-param-name="${escapeHtml(name)}" data-param-kind="vector" data-vector-index="${vectorIndex}"${appendNumberAttrs(min, max, step)}>`
      ).join("");
      controlHtml = `<span class="param-vector">${vectorInputs}</span>`;
    } else if (type === "number") {
      const value = toFiniteNumber(current, toFiniteNumber(initial));
      values[name] = value;
      controlHtml = `<input id="${escapeHtml(inputId)}" type="number" value="${escapeHtml(String(value))}" data-param-name="${escapeHtml(name)}" data-param-kind="number"${appendNumberAttrs(min, max, step)}>`;
    } else {
      const value = current == null ? "" : String(current);
      values[name] = value;
      controlHtml = `<input id="${escapeHtml(inputId)}" type="text" value="${escapeHtml(value)}" data-param-name="${escapeHtml(name)}" data-param-kind="string">`;
    }

    return `<div class="param-row"><label for="${escapeHtml(inputId)}">${escapeHtml(caption)}</label>${controlHtml}</div>`;
  };

  // Separate global/ungrouped params from named groups.
  // Parameters with group=null/undefined/"Global" are always shown outside any accordion.
  const globalRows = [];
  const groupMap = new Map(); // preserves insertion order

  codeParams.forEach((param, index) => {
    const row = buildParamRow(param, index);
    if (!row) return;
    const group = param?.group;
    if (!group || group === "Global") {
      globalRows.push(row);
    } else {
      if (!groupMap.has(group)) groupMap.set(group, []);
      groupMap.get(group).push(row);
    }
  });

  const parts = [...globalRows];

  for (const [groupName, groupRows] of groupMap) {
    parts.push(
      `<details class="param-group" open><summary class="param-group-summary">${escapeHtml(groupName)}</summary><div class="param-group-body">${groupRows.join("")}</div></details>`
    );
  }

  const totalRows = globalRows.length + [...groupMap.values()].reduce((sum, rows) => sum + rows.length, 0);

  return {
    hasParams: totalRows > 0,
    html: parts.join(""),
    values,
  };
};

const DEFAULT_FACE_COLOR_WORKER = [0xf9 / 255, 0xd7 / 255, 0x2c / 255, 1];

// Compute flat (per-triangle) normals for a non-indexed positions array.
// Every 9 consecutive floats represent one triangle (3 vertices × xyz).
const computeFlatNormals = (positions) => {
  const normals = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 9) {
    const ax = positions[i], ay = positions[i + 1], az = positions[i + 2];
    const bx = positions[i + 3], by = positions[i + 4], bz = positions[i + 5];
    const cx = positions[i + 6], cy = positions[i + 7], cz = positions[i + 8];
    const ex = bx - ax, ey = by - ay, ez = bz - az;
    const fx = cx - ax, fy = cy - ay, fz = cz - az;
    const nx = ey * fz - ez * fy;
    const ny = ez * fx - ex * fz;
    const nz = ex * fy - ey * fx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    const nnx = nx / len, nny = ny / len, nnz = nz / len;
    normals[i] = nnx; normals[i + 1] = nny; normals[i + 2] = nnz;
    normals[i + 3] = nnx; normals[i + 4] = nny; normals[i + 5] = nnz;
    normals[i + 6] = nnx; normals[i + 7] = nny; normals[i + 8] = nnz;
  }
  return normals;
};

// Parse an OFF file into flat Float32Array colour buckets so the main thread can
// construct Three.js geometries without any text-parsing work.
// Returns { colorBuckets: [{color, positions, normals}], transfer } or null on failure.
const parseOffToColorBuckets = (offData) => {
  try {
    const text = new TextDecoder().decode(
      offData instanceof Uint8Array ? offData : new Uint8Array(offData),
    );
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"));
    if (lines.length === 0) return null;

    let countsLine = "";
    let currentLine = 0;
    if (/^OFF(\s|$)/.test(lines[0])) {
      countsLine = lines[0].substring(3).trim();
      currentLine = 1;
    }
    // Handle standard two-line OFF header: "OFF\nV F E"
    if (!countsLine && currentLine < lines.length) {
      countsLine = lines[currentLine];
      currentLine++;
    }
    if (!countsLine) return null;

    const countParts = countsLine.split(/\s+/).map(Number);
    const vertexCount = Number.isFinite(countParts[0]) ? Math.floor(countParts[0]) : NaN;
    const faceCount = Number.isFinite(countParts[1]) ? Math.floor(countParts[1]) : NaN;
    if (!Number.isFinite(vertexCount) || !Number.isFinite(faceCount) || vertexCount <= 0 || faceCount <= 0) return null;
    if (currentLine + vertexCount + faceCount > lines.length) return null;

    const vertices = new Float32Array(vertexCount * 3);
    for (let i = 0; i < vertexCount; i++) {
      const parts = lines[currentLine + i].split(/\s+/).map(Number);
      vertices[i * 3] = parts[0] || 0;
      vertices[i * 3 + 1] = parts[1] || 0;
      vertices[i * 3 + 2] = parts[2] || 0;
    }
    currentLine += vertexCount;

    const colorMap = new Map();
    const buckets = [];

    for (let i = 0; i < faceCount; i++) {
      const parts = lines[currentLine + i].split(/\s+/).map(Number);
      const numVerts = Number.isFinite(parts[0]) ? Math.floor(parts[0]) : 0;
      const faceVertices = parts.slice(1, numVerts + 1).map(Math.floor);
      if (faceVertices.length < 3) continue;

      let color = DEFAULT_FACE_COLOR_WORKER;
      if (parts.length >= numVerts + 4) {
        const raw = parts.slice(numVerts + 1, numVerts + 5).filter(Number.isFinite);
        if (raw.length >= 3) {
          const r = raw[0], g = raw[1], b = raw[2];
          const a = raw.length >= 4 ? raw[3] : (Math.max(r, g, b) > 1 ? 255 : 1);
          const div = Math.max(r, g, b, a) > 1 ? 255 : 1;
          color = [r / div, g / div, b / div, a / div];
        }
      }

      const colorKey = color.join(",");
      let bucket = colorMap.get(colorKey);
      if (!bucket) {
        bucket = { color, positionsList: [] };
        colorMap.set(colorKey, bucket);
        buckets.push(bucket);
      }

      // Fan triangulation of potentially non-triangular faces
      for (let j = 1; j < faceVertices.length - 1; j++) {
        const i1 = faceVertices[0], i2 = faceVertices[j], i3 = faceVertices[j + 1];
        bucket.positionsList.push(
          vertices[i1 * 3], vertices[i1 * 3 + 1], vertices[i1 * 3 + 2],
          vertices[i2 * 3], vertices[i2 * 3 + 1], vertices[i2 * 3 + 2],
          vertices[i3 * 3], vertices[i3 * 3 + 1], vertices[i3 * 3 + 2],
        );
      }
    }

    if (buckets.length === 0) return null;

    const transfer = [];
    const colorBuckets = buckets.map((bucket) => {
      const positions = new Float32Array(bucket.positionsList);
      const normals = computeFlatNormals(positions);
      transfer.push(positions.buffer, normals.buffer);
      return { color: bucket.color, positions, normals };
    });

    return { colorBuckets, transfer };
  } catch (_) {
    return null;
  }
};

const runOpenScadInvocation = async ({
  code,
  sourcePath,
  outputPaths = [],
  args = [],
  libraryNames = [],
}) => {
  const mergedOutputs = [];
  const start = performance.now();

  try {
    await loadFonts();
    const instance = await getOpenScad(mergedOutputs);

    if (libraryNames.length > 0) {
      await mountLibraries(instance, libraryNames);
    }

    try {
      instance.FS.unlink(sourcePath);
    } catch (_) {}
    for (const outputPath of outputPaths) {
      try {
        instance.FS.unlink(outputPath);
      } catch (_) {}
    }

    instance.FS.writeFile(sourcePath, code || "");
    const exitCode = invokeOpenScad(instance, args);

    const outputs = [];
    for (const outputPath of outputPaths) {
      const content = instance.FS.readFile(outputPath, { encoding: "binary" });
      outputs.push([outputPath, content]);
    }

    return {
      exitCode,
      outputs,
      mergedOutputs,
      elapsedMillis: performance.now() - start,
    };
  } catch (e) {
    const error = `${e}`;
    mergedOutputs.push({ error });
    return {
      exitCode: undefined,
      error,
      outputs: [],
      mergedOutputs,
      elapsedMillis: performance.now() - start,
    };
  }
};

self.addEventListener("message", async (event) => {
  const { requestId, type, payload } = event.data || {};
  if (!requestId || typeof type !== "string") return;

  try {
    let result;
    if (type === "extractParams") {
      const sourcePath = "/tmp/params_model.scad";
      const outPath = "/tmp/params_out.json";
      result = await runOpenScadInvocation({
        code: `$preview=true;\n${payload?.code || ""}`,
        sourcePath,
        outputPaths: [outPath],
        libraryNames: payload?.libraryNames || [],
        args: [
          sourcePath,
          "-o",
          outPath,
          "--export-format=param",
        ],
      });
      const serialized = serializeInvocationResults(result);
      self.postMessage({ requestId, ok: true, result: serialized.result }, serialized.transfer);
      return;
    }
    if (type === "buildParamForm") {
      const sourcePath = "/tmp/params_model.scad";
      const outPath = "/tmp/params_out.json";
      result = await runOpenScadInvocation({
        code: `$preview=true;\n${payload?.code || ""}`,
        sourcePath,
        outputPaths: [outPath],
        libraryNames: payload?.libraryNames || [],
        args: [
          sourcePath,
          "-o",
          outPath,
          "--export-format=param",
        ],
      });

      const codeParams = getExtractedParameters(result);
      const ui = buildParamFormUi(
        codeParams,
        payload?.currentOverrides || {},
        payload?.id || "model",
      );

      self.postMessage({
        requestId,
        ok: true,
        result: {
          hasParams: ui.hasParams,
          html: ui.html,
          values: ui.values,
        },
      });
      return;
    }
    if (type === "render") {
      const format = payload?.format || "stl";
      const sourcePath = "/tmp/model.scad";
      const outPath = `/tmp/output.${format}`;
      const exportFormat = format === "stl" ? "binstl" : format;
      result = await runOpenScadInvocation({
        code: payload?.isPreview ? `$preview=true;\n${payload?.code || ""}` : (payload?.code || ""),
        sourcePath,
        outputPaths: [outPath],
        libraryNames: payload?.libraryNames || [],
        args: [
          sourcePath,
          "-o",
          outPath,
          OPENSCAD_BACKEND_ARG,
          `--export-format=${exportFormat}`,
          ...(payload?.paramDefinitions || []),
          ...OPENSCAD_FEATURE_ARGS,
        ],
      });
      // For preview OFF renders, parse geometry here in the worker so the main thread
      // never has to do heavy text parsing or Float32Array building.
      if (format === "off" && payload?.isPreview && result.exitCode === 0 && !result.error) {
        const offOutput = result.outputs?.[0]?.[1];
        if (offOutput) {
          const parsed = parseOffToColorBuckets(offOutput);
          if (parsed) {
            self.postMessage({
              requestId,
              ok: true,
              result: {
                exitCode: result.exitCode,
                mergedOutputs: result.mergedOutputs,
                elapsedMillis: result.elapsedMillis,
                parsedGeometry: parsed.colorBuckets,
              },
            }, parsed.transfer);
            return;
          }
        }
      }
      const serialized = serializeInvocationResults(result);
      self.postMessage({ requestId, ok: true, result: serialized.result }, serialized.transfer);
      return;
    }
    throw new Error(`Unknown OpenSCAD worker request: ${type}`);
  } catch (error) {
    self.postMessage({
      requestId,
      ok: false,
      error: {
        message: error?.message || String(error),
        stderr: Array.isArray(error?.stderr) ? error.stderr : [],
      },
    });
  }
});
