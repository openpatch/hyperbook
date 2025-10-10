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

/**
 * Simple FNV-1a hash implementation (32-bit)
 * Browser-compatible alternative to Node.js crypto
 * https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function
 */
function fnv1aHash(str: string): string {
  let hash = 2166136261; // FNV offset basis (32-bit)
  
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // FNV prime (32-bit): 16777619
    hash = Math.imul(hash, 16777619);
  }
  
  // Convert to unsigned 32-bit and format as hex
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Create a hash from an object
 * Uses FNV-1a algorithm for browser compatibility
 * @param object - The object to hash
 * @returns A hex string hash
 */
export default function hash(object: any) {
  if (!isObject(object)) {
    throw new TypeError("Expected an object");
  }

  const normalizedObject = normalizeObject(decircular(object));
  const jsonString = JSON.stringify(sortKeys(normalizedObject, { deep: true }));
  
  return fnv1aHash(jsonString);
}
