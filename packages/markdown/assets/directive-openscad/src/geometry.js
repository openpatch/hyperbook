import { DEFAULT_FACE_COLOR, PAINT_COLOR_MAP } from "./constants.js";
import { i18nGet, createZip, colorToDisplayColor, createUuid, textEncoder } from "./utils.js";

export const parseOffToIndexedPolyhedron = (offData) => {
  const arrayBuffer = offData.buffer.slice(
    offData.byteOffset,
    offData.byteOffset + offData.byteLength,
  );
  const text = new TextDecoder().decode(arrayBuffer);
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  if (lines.length === 0) {
    throw new Error(
      i18nGet("openscad-render-failed", "OpenSCAD render failed"),
    );
  }

  let countsLine = "";
  let currentLine = 0;
  if (/^OFF(\s|$)/.test(lines[0])) {
    countsLine = lines[0].substring(3).trim();
    currentLine = 1;
  } else if (lines[0] === "OFF" && lines.length > 1) {
    countsLine = lines[1];
    currentLine = 2;
  } else {
    throw new Error(
      i18nGet("openscad-render-failed", "OpenSCAD render failed"),
    );
  }

  const [vertexCountRaw, faceCountRaw] = countsLine.split(/\s+/).map(Number);
  const vertexCount = Number.isFinite(vertexCountRaw)
    ? Math.floor(vertexCountRaw)
    : NaN;
  const faceCount = Number.isFinite(faceCountRaw)
    ? Math.floor(faceCountRaw)
    : NaN;
  if (
    !Number.isFinite(vertexCount) ||
    !Number.isFinite(faceCount) ||
    vertexCount <= 0 ||
    faceCount <= 0
  ) {
    throw new Error(
      i18nGet("openscad-render-failed", "OpenSCAD render failed"),
    );
  }
  if (currentLine + vertexCount + faceCount > lines.length) {
    throw new Error(
      i18nGet("openscad-render-failed", "OpenSCAD render failed"),
    );
  }

  const vertices = [];
  for (let i = 0; i < vertexCount; i++) {
    const parts = lines[currentLine + i].split(/\s+/).map(Number);
    if (parts.length < 3 || parts.some(Number.isNaN)) {
      throw new Error(
        i18nGet("openscad-render-failed", "OpenSCAD render failed"),
      );
    }
    vertices.push({ x: parts[0], y: parts[1], z: parts[2] });
  }
  currentLine += vertexCount;

  const colors = [];
  const colorMap = new Map();
  const faces = [];

  for (let i = 0; i < faceCount; i++) {
    const parts = lines[currentLine + i].split(/\s+/).map(Number);
    const numVerts = Number.isFinite(parts[0]) ? Math.floor(parts[0]) : 0;
    const faceVertices = parts
      .slice(1, numVerts + 1)
      .map((index) => Math.floor(index));
    if (faceVertices.length < 3) {
      throw new Error(
        i18nGet("openscad-render-failed", "OpenSCAD render failed"),
      );
    }

    let color = DEFAULT_FACE_COLOR;
    if (parts.length >= numVerts + 4) {
      const raw = parts
        .slice(numVerts + 1, numVerts + 5)
        .filter(Number.isFinite);
      if (raw.length >= 3) {
        const r = raw[0];
        const g = raw[1];
        const b = raw[2];
        const a = raw.length >= 4 ? raw[3] : Math.max(r, g, b) > 1 ? 255 : 1;
        const divisor = Math.max(r, g, b, a) > 1 ? 255 : 1;
        color = [r / divisor, g / divisor, b / divisor, a / divisor];
      }
    }

    const colorKey = color.join(",");
    let colorIndex = colorMap.get(colorKey);
    if (colorIndex == null) {
      colorIndex = colors.length;
      colors.push(color);
      colorMap.set(colorKey, colorIndex);
    }

    if (faceVertices.length === 3) {
      faces.push({ vertices: faceVertices, colorIndex });
    } else {
      for (let j = 1; j < faceVertices.length - 1; j++) {
        faces.push({
          vertices: [faceVertices[0], faceVertices[j], faceVertices[j + 1]],
          colorIndex,
        });
      }
    }
  }

  return { vertices, faces, colors };
};

export const exportIndexedPolyhedronTo3mf = (polyhedron) => {
  const objectUuid = createUuid();
  const buildUuid = createUuid();
  const extruderIndexByColorIndex = polyhedron.colors.map(
    (_, idx) => idx % PAINT_COLOR_MAP.length,
  );

  const modelXml = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06">',
    '<meta name="BambuStudio:3mfVersion" value="1"/>',
    '<meta name="slic3rpe:Version3mf" value="1"/>',
    '<meta name="slic3rpe:MmPaintingVersion" value="1"/>',
    "<resources>",
    '<basematerials id="2">',
    ...polyhedron.colors.map(
      (color, i) =>
        `<base name="color_${i}" displaycolor="${colorToDisplayColor(color)}"/>`,
    ),
    "</basematerials>",
    `<object id="1" name="OpenSCAD Model" type="model" p:UUID="${objectUuid}" pid="2" pindex="0">`,
    "<mesh>",
    "<vertices>",
    ...polyhedron.vertices.map(
      (vertex) =>
        `<vertex x="${vertex.x}" y="${vertex.y}" z="${vertex.z}" />`,
    ),
    "</vertices>",
    "<triangles>",
    ...polyhedron.faces.map((face) => {
      const [v1, v2, v3] = face.vertices;
      const attrs = [`v1="${v1}"`, `v2="${v2}"`, `v3="${v3}"`];
      if (face.colorIndex > 0) {
        attrs.push(`pid="2"`, `p1="${face.colorIndex}"`);
      }
      const paintColor =
        PAINT_COLOR_MAP[extruderIndexByColorIndex[face.colorIndex]];
      if (paintColor) {
        attrs.push(`paint_color="${paintColor}"`);
      }
      return `<triangle ${attrs.join(" ")} />`;
    }),
    "</triangles>",
    "</mesh>",
    "</object>",
    "</resources>",
    `<build p:UUID="${buildUuid}">`,
    `<item objectid="1" p:UUID="${objectUuid}"/>`,
    "</build>",
    "</model>",
  ].join("\n");

  const contentTypesXml = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>',
    "</Types>",
  ].join("\n");

  const relationshipsXml = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" Target="/3D/3dmodel.model" Id="rel0"/>',
    "</Relationships>",
  ].join("\n");

  return createZip({
    "3D/3dmodel.model": textEncoder.encode(modelXml),
    "[Content_Types].xml": textEncoder.encode(contentTypesXml),
    "_rels/.rels": textEncoder.encode(relationshipsXml),
  });
};
