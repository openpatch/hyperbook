import crypto from "node:crypto";
import isObject from "is-obj";
import sortKeys from "sort-keys";
import decircular from "decircular";

function normalizeObject(object: object): object {
  if (Array.isArray(object)) {
    return object.map((element) => normalizeObject(element));
  }

  if (isObject(object)) {
    return Object.fromEntries(
      Object.entries(object).map(([key, value]) => [
        key.normalize("NFD"),
        normalizeObject(value),
      ]),
    );
  }

  return object;
}

export default function hash(object: any) {
  if (!isObject(object)) {
    throw new TypeError("Expected an object");
  }

  const normalizedObject = normalizeObject(decircular(object));

  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(sortKeys(normalizedObject, { deep: true })), "utf8")
    .digest("hex");

  return hash;
}

/**
 * Keys that describe where a node sits in the file rather than what it says.
 *
 * `position` is the important one: every mdast node carries its byte offsets,
 * so hashing a node whole makes its id a function of everything above it in
 * the document. `data` is excluded because plugins mutate it during the
 * transform, which would make the hash depend on plugin ordering.
 */
const NON_SEMANTIC_KEYS = new Set(["position", "data"]);

function stripNonSemantic(value: any): any {
  if (Array.isArray(value)) {
    return value.map(stripNonSemantic);
  }

  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !NON_SEMANTIC_KEYS.has(key))
        .map(([key, child]) => [key, stripNonSemantic(child)]),
    );
  }

  return value;
}

/**
 * Hashes what a node *is*, ignoring where it sits in the file.
 *
 * Interactive directives use their hash as the key their reader's work is
 * stored under. With `hash` that key changed whenever anything above the
 * directive changed — inserting a single paragraph silently orphaned every
 * saved answer on the page. This keeps the id stable across edits elsewhere.
 */
export function stableHash(object: any): string {
  if (!isObject(object)) {
    throw new TypeError("Expected an object");
  }

  return hash(stripNonSemantic(decircular(object)));
}
