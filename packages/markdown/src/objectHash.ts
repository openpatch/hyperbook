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
