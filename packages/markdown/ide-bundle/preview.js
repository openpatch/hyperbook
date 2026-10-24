/**
 * Previews of the binary files of a workspace, shown in place of the editor
 * when their tab is opened: images, audio, video, PDFs, fonts and 3D models
 * (STL, OBJ). Anything else gets its type and size.
 */

import { icon } from "./icons.js";

const t = (key, values) => hyperbook.i18n.get(key, values);

const extensionOf = (path) => {
  const dot = path.lastIndexOf(".");
  return dot >= 0 ? path.slice(dot).toLowerCase() : "";
};

const KINDS = {
  image: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".avif", ".ico"],
  audio: [".mp3", ".wav", ".ogg", ".oga", ".m4a", ".aac", ".flac", ".opus", ".weba"],
  video: [".mp4", ".webm", ".ogv", ".mov", ".m4v"],
  pdf: [".pdf"],
  font: [".ttf", ".otf", ".woff", ".woff2"],
  model: [".stl", ".obj"],
};

/** @param {string} path */
export const previewKind = (path) => {
  const ext = extensionOf(path);
  for (const [kind, extensions] of Object.entries(KINDS)) {
    if (extensions.includes(ext)) return kind;
  }
  return "other";
};

const formatSize = (bytes) => {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

// --- 3D models -----------------------------------------------------------------

/** Triangles of an STL file, binary or ASCII, as a flat [x,y,z, ...] array. */
export const parseStl = (buffer) => {
  const view = new DataView(buffer);
  if (buffer.byteLength >= 84) {
    const count = view.getUint32(80, true);
    if (84 + count * 50 === buffer.byteLength) {
      const out = new Float32Array(count * 9);
      for (let i = 0; i < count; i++) {
        const base = 84 + i * 50 + 12;
        for (let j = 0; j < 9; j++) {
          out[i * 9 + j] = view.getFloat32(base + j * 4, true);
        }
      }
      return out;
    }
  }
  const text = new TextDecoder().decode(buffer);
  const numbers = [];
  for (const match of text.matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)) {
    numbers.push(Number(match[1]), Number(match[2]), Number(match[3]));
  }
  return new Float32Array(numbers);
};

/** Triangles of an OBJ file; polygons are split into fans. */
export const parseObj = (text) => {
  const vertices = [];
  const out = [];
  for (const line of text.split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === "v") {
      vertices.push([Number(parts[1]), Number(parts[2]), Number(parts[3])]);
    } else if (parts[0] === "f") {
      const index = parts.slice(1).map((p) => {
        const i = Number(p.split("/")[0]);
        return i < 0 ? vertices.length + i : i - 1;
      });
      for (let k = 1; k + 1 < index.length; k++) {
        for (const i of [index[0], index[k], index[k + 1]]) {
          out.push(...(vertices[i] || [0, 0, 0]));
        }
      }
    }
  }
  return new Float32Array(out);
};

/** Above this many triangles, a 2D canvas cannot keep up with dragging. */
const MAX_TRIANGLES = 150000;

/**
 * Draws a mesh with flat shading on a 2D canvas, sorted back to front. Drag
 * to turn it, scroll to zoom. Returns a function that stops it.
 */
const showModel = (container, triangles) => {
  const count = triangles.length / 9;
  const canvas = element("canvas");
  container.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  // Center the model and scale it into a unit sphere. Models are usually
  // Z-up (OpenSCAD, slicers); the view turns Z towards the screen's top.
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < triangles.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], triangles[i + a]);
      max[a] = Math.max(max[a], triangles[i + a]);
    }
  }
  const center = min.map((m, a) => (m + max[a]) / 2);
  const radius =
    Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2 || 1;

  let yaw = -0.6;
  let pitch = 0.5;
  let zoom = 1;
  // The brand colour as RGB, read on every draw so the model follows the
  // light and dark theme. The canvas normalizes any CSS colour to hex.
  const brandColor = () => {
    ctx.fillStyle =
      getComputedStyle(container).getPropertyValue("--color-brand").trim() ||
      "#3b82f6";
    const hex = /^#[0-9a-f]{6}$/i.test(ctx.fillStyle) ? ctx.fillStyle : "#3b82f6";
    return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  };

  // View space: x right, y up, z away from the viewer.
  const view = new Float32Array(triangles.length);
  const order = new Uint32Array(count);
  const depth = new Float32Array(count);
  const shade = new Float32Array(count);
  // Light from the viewer, a little from above and the left.
  const lightDir = [-0.3, 0.5, -1];
  const lightLength = Math.hypot(...lightDir);

  const draw = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const ratio = window.devicePixelRatio || 1;
    if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
      canvas.width = width * ratio;
      canvas.height = height * ratio;
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const scale = (Math.min(width, height) / 2 / radius) * 0.85 * zoom;
    const base = brandColor();

    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    for (let i = 0; i < triangles.length; i += 3) {
      // Model space is Z-up: x right, y away, z up.
      const x = triangles[i] - center[0];
      const y = triangles[i + 1] - center[1];
      const z = triangles[i + 2] - center[2];
      // Turn around the up axis, then tilt towards the viewer.
      const x1 = x * cy - y * sy;
      const y1 = x * sy + y * cy;
      view[i] = x1;
      view[i + 1] = y1 * sp + z * cp;
      view[i + 2] = y1 * cp - z * sp;
    }

    for (let f = 0; f < count; f++) {
      const i = f * 9;
      const ax = view[i + 3] - view[i], ay = view[i + 4] - view[i + 1], az = view[i + 5] - view[i + 2];
      const bx = view[i + 6] - view[i], by = view[i + 7] - view[i + 1], bz = view[i + 8] - view[i + 2];
      const nx = ay * bz - az * by;
      const ny = az * bx - ax * bz;
      const nz = ax * by - ay * bx;
      const length = Math.hypot(nx, ny, nz) || 1;
      // Two-sided: meshes do not always agree on their winding.
      shade[f] =
        Math.abs(nx * lightDir[0] + ny * lightDir[1] + nz * lightDir[2]) /
        (length * lightLength);
      depth[f] = view[i + 2] + view[i + 5] + view[i + 8];
      order[f] = f;
    }
    order.sort((a, b) => depth[b] - depth[a]);

    const sx = (i) => width / 2 + view[i] * scale;
    const sy2 = (i) => height / 2 - view[i + 1] * scale;
    for (const f of order) {
      const i = f * 9;
      ctx.beginPath();
      ctx.moveTo(sx(i), sy2(i));
      ctx.lineTo(sx(i + 3), sy2(i + 3));
      ctx.lineTo(sx(i + 6), sy2(i + 6));
      ctx.closePath();
      // Darker the more a face turns away from the light. The edge in the
      // same colour hides the hairline gaps between neighbouring triangles.
      const light = 0.25 + 0.75 * shade[f];
      const color = `rgb(${base.map((c) => Math.round(c * light)).join(",")})`;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.fill();
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
  };

  let frame = 0;
  const redraw = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  };

  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId);
    let lastX = event.clientX;
    let lastY = event.clientY;
    const move = (e) => {
      yaw += (e.clientX - lastX) * 0.01;
      pitch = Math.max(-1.5, Math.min(1.5, pitch + (e.clientY - lastY) * 0.01));
      lastX = e.clientX;
      lastY = e.clientY;
      redraw();
    };
    const up = () => {
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
    };
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
  });
  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      zoom = Math.max(0.2, Math.min(8, zoom * Math.exp(-event.deltaY * 0.001)));
      redraw();
    },
    { passive: false },
  );

  const observer = new ResizeObserver(redraw);
  observer.observe(canvas);
  document.addEventListener("colorschemechange", redraw);
  redraw();
  return () => {
    observer.disconnect();
    document.removeEventListener("colorschemechange", redraw);
    cancelAnimationFrame(frame);
  };
};

// --- fonts ---------------------------------------------------------------------

let fontCounter = 0;

const showFont = async (container, url) => {
  const family = `hyperbook-ide-font-${++fontCounter}`;
  const face = new FontFace(family, `url(${JSON.stringify(url)})`);
  await face.load();
  document.fonts.add(face);

  const sample = element("div", "ide-preview-sample");
  sample.style.fontFamily = `"${family}"`;
  for (const size of [40, 24, 16]) {
    const line = element("p", "", t("ide-font-sample"));
    line.style.fontSize = `${size}px`;
    sample.appendChild(line);
  }
  sample.appendChild(
    element(
      "p",
      "ide-preview-glyphs",
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n0123456789 äöüß .,;:!?()&@€",
    ),
  );
  container.appendChild(sample);
  return () => document.fonts.delete(face);
};

// --- the preview ---------------------------------------------------------------

/**
 * Fills `container` with a preview of a binary workspace file.
 *
 * @param {HTMLElement} container
 * @param {{path: string, url: string}} file
 * @param {{ onDownload: () => void }} actions
 * @returns {() => void} Cleans the preview up.
 */
export const renderPreview = (container, file, { onDownload }) => {
  container.textContent = "";
  let cleanup = () => {};
  let stopped = false;

  const kind = previewKind(file.path);
  const header = element("div", "ide-preview-header");
  const kindIcon = icon(kind);
  kindIcon.classList.add("ide-preview-kind");
  header.appendChild(kindIcon);
  header.appendChild(element("span", "ide-preview-name", file.path));
  const meta = element("span", "ide-preview-meta", t(`ide-kind-${kind}`));
  header.appendChild(meta);
  const download = element("button", "ide-preview-download");
  download.appendChild(icon("download"));
  download.type = "button";
  download.title = t("ide-download-file", { file: file.path });
  download.setAttribute("aria-label", download.title);
  download.addEventListener("click", onDownload);
  header.appendChild(download);
  container.appendChild(header);

  const body = element("div", `ide-preview-body ide-preview-${kind}`);
  container.appendChild(body);

  const fail = (error) => {
    if (stopped) return;
    body.textContent = "";
    body.appendChild(
      element("p", "ide-preview-note", t("ide-preview-failed", { error: error?.message || `${error}` })),
    );
  };

  // The size, read from the data itself, which may be a data URL or a link.
  const loaded = fetch(file.url).then(async (response) => {
    if (!response.ok) throw new Error(`${response.status}`);
    return response.arrayBuffer();
  });
  loaded
    .then((buffer) => {
      if (!stopped) meta.textContent = `${t(`ide-kind-${kind}`)} · ${formatSize(buffer.byteLength)}`;
    })
    .catch(() => {});

  if (kind === "image") {
    const img = element("img");
    img.src = file.url;
    img.alt = file.path;
    body.appendChild(img);
  } else if (kind === "audio" || kind === "video") {
    const media = element(kind);
    media.controls = true;
    media.preload = "metadata";
    media.src = file.url;
    body.appendChild(media);
  } else if (kind === "pdf") {
    const frame = element("iframe");
    frame.title = file.path;
    // Data URLs are blocked as frame sources; a blob URL works everywhere.
    loaded
      .then((buffer) => {
        if (stopped) return;
        const url = URL.createObjectURL(
          new Blob([buffer], { type: "application/pdf" }),
        );
        frame.src = url;
        const previous = cleanup;
        cleanup = () => {
          previous();
          URL.revokeObjectURL(url);
        };
      })
      .catch(fail);
    body.appendChild(frame);
  } else if (kind === "font") {
    showFont(body, file.url)
      .then((stop) => {
        if (stopped) stop();
        else cleanup = stop;
      })
      .catch(fail);
  } else if (kind === "model") {
    loaded
      .then((buffer) => {
        if (stopped) return;
        const triangles =
          extensionOf(file.path) === ".obj"
            ? parseObj(new TextDecoder().decode(buffer))
            : parseStl(buffer);
        const count = triangles.length / 9;
        if (count === 0) throw new Error(t("ide-model-empty"));
        if (count > MAX_TRIANGLES) {
          body.appendChild(
            element("p", "ide-preview-note", t("ide-model-too-large", { count: `${count}` })),
          );
          return;
        }
        meta.textContent += ` · ${t("ide-model-triangles", { count: `${count}` })}`;
        cleanup = showModel(body, triangles);
        body.appendChild(element("p", "ide-preview-hint", t("ide-model-hint")));
      })
      .catch(fail);
  } else {
    body.appendChild(element("p", "ide-preview-note", t("ide-binary-file")));
  }

  return () => {
    stopped = true;
    cleanup();
    container.textContent = "";
  };
};
