import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ViewportGizmo } from "three-viewport-gizmo";
import { DEFAULT_FACE_COLOR } from "./constants.js";
import { i18nGet } from "./utils.js";

export { THREE, OrbitControls, ViewportGizmo };

export const buildThreeModelFromIndexedPolyhedron = (polyhedron) => {
  const model = new THREE.Group();
  const facesByColor = new Map();

  for (const face of polyhedron.faces) {
    const [i1, i2, i3] = face.vertices;
    const v1 = polyhedron.vertices[i1];
    const v2 = polyhedron.vertices[i2];
    const v3 = polyhedron.vertices[i3];
    if (!v1 || !v2 || !v3) continue;
    const color = polyhedron.colors[face.colorIndex] || DEFAULT_FACE_COLOR;
    const colorKey = color.join(",");
    let bucket = facesByColor.get(colorKey);
    if (!bucket) {
      bucket = { color, positions: [] };
      facesByColor.set(colorKey, bucket);
    }
    bucket.positions.push(
      v1.x,
      v1.y,
      v1.z,
      v2.x,
      v2.y,
      v2.z,
      v3.x,
      v3.y,
      v3.z,
    );
  }

  if (facesByColor.size === 0) {
    throw new Error(
      i18nGet("openscad-render-failed", "OpenSCAD render failed"),
    );
  }

  for (const bucket of facesByColor.values()) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(bucket.positions, 3),
    );
    geometry.computeBoundingBox();
    geometry.computeVertexNormals();
    const [r, g, b, a = 1] = bucket.color;
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(r, g, b),
      transparent: a < 1,
      opacity: a,
      metalness: 0.1,
      roughness: 0.6,
    });
    model.add(new THREE.Mesh(geometry, material));
  }

  return model;
};

export const buildThreeModelFromColorBuckets = (colorBuckets) => {
  const model = new THREE.Group();

  for (const bucket of colorBuckets) {
    const posArray =
      bucket.positions instanceof Float32Array
        ? bucket.positions
        : new Float32Array(bucket.positions || []);
    const normArray =
      bucket.normals instanceof Float32Array
        ? bucket.normals
        : new Float32Array(bucket.normals || []);

    if (posArray.length === 0) continue;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(posArray, 3),
    );
    geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(normArray, 3),
    );

    // Compute bounding box for tracking/camera framing,
    // BUT do NOT center the geometry via geometry.center()!
    geometry.computeBoundingBox();
    geometry.computeVertexNormals();

    const [r, g, b, a = 1] = bucket.color || DEFAULT_FACE_COLOR;
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(r, g, b),
      transparent: a < 1,
      opacity: a,
      metalness: 0.1,
      roughness: 0.6,
    });

    model.add(new THREE.Mesh(geometry, material));
  }

  if (model.children.length === 0) {
    throw new Error(
      i18nGet("openscad-render-failed", "OpenSCAD render failed"),
    );
  }
  return model;
};
