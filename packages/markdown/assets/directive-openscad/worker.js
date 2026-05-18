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
