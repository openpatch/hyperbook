import { CRC32_TABLE } from "./constants.js";

export const i18nGet = (key, fallback = key) =>
  hyperbook.i18n?.get(key) || fallback;

export const ABSOLUTE_URL_PATTERN = /^(?:[a-z]+:)?\/\//i;

export const normalizePath = (path) => {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
};

export const constructUrl = (path, basePath, pagePath) => {
  if (path.startsWith("/")) {
    return basePath ? `${basePath}${path}`.replace(/\/+/g, "/") : path;
  }
  return pagePath ? `${pagePath}/${path}`.replace(/\/+/g, "/") : path;
};

export const resolveImportFsPath = (assetPath) => {
  try {
    return new URL(assetPath, "file:///tmp/model.scad").pathname || null;
  } catch (_) {
    return null;
  }
};

export const extractImportAssetPaths = (code) => {
  const paths = new Set();
  const pattern = /import\s*\(\s*(['"])([^'"]+)\1/g;
  let match;
  while ((match = pattern.exec(code || "")) !== null) {
    const path = match[2];
    if (!path) continue;
    if (
      ABSOLUTE_URL_PATTERN.test(path) ||
      path.startsWith("data:") ||
      path.startsWith("blob:")
    ) {
      continue;
    }
    paths.add(path);
  }
  return [...paths];
};

export const buildAutoBinaryFiles = (code, basePath, pagePath) => {
  return extractImportAssetPaths(code)
    .map((assetPath) => {
      const dest = resolveImportFsPath(assetPath);
      if (!dest) return null;
      return {
        dest,
        url: constructUrl(assetPath, basePath, pagePath),
      };
    })
    .filter(Boolean);
};

export const mergeBinaryFiles = (baseFiles = [], autoFiles = []) => {
  const merged = new Map();
  for (const file of autoFiles) {
    if (!file?.dest || !file?.url) continue;
    merged.set(file.dest, file);
  }
  for (const file of baseFiles) {
    if (!file?.dest || !file?.url) continue;
    merged.set(file.dest, file);
  }
  return [...merged.values()];
};

export const formatValue = (value) => {
  if (typeof value === "string")
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  if (Array.isArray(value)) return `[${value.map(formatValue).join(",")}]`;
  if (typeof value === "boolean" || typeof value === "number")
    return `${value}`;
  throw new Error(
    "Only numbers, booleans, strings and arrays are supported in parameters",
  );
};

export const toUint8Array = (data) => {
  if (data instanceof Uint8Array) return data;
  if (typeof data === "string") return new TextEncoder().encode(data);
  return new Uint8Array(data || []);
};

export const textEncoder = new TextEncoder();

export const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

export const concatUint8Arrays = (chunks) => {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
};

export const createZip = (files) => {
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  for (const [name, dataLike] of Object.entries(files)) {
    const nameBytes = textEncoder.encode(name);
    const data = toUint8Array(dataLike);
    const crc = crc32(data);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);
    localChunks.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralChunks.push(centralHeader);

    offset += localHeader.length + data.length;
  }

  const centralDirectory = concatUint8Arrays(centralChunks);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, centralChunks.length, true);
  eocdView.setUint16(10, centralChunks.length, true);
  eocdView.setUint32(12, centralDirectory.length, true);
  eocdView.setUint32(16, offset, true);
  eocdView.setUint16(20, 0, true);

  return concatUint8Arrays([...localChunks, centralDirectory, eocd]);
};

export const toHexByte = (value) =>
  Math.round(Math.max(0, Math.min(1, value)) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();

export const colorToDisplayColor = ([r, g, b, a = 1]) => {
  const base = `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
  return a < 1 ? `${base}${toHexByte(a)}` : base;
};

export const createUuid = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 10)}`;
