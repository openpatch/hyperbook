import pako from "pako";
import { Base64 } from "js-base64";

export function encode(str: string) {
  var data = new TextEncoder().encode(str);
  var buffer = pako.deflate(data, { level: 9 });
  var result = Base64.fromUint8Array(buffer, true);
  return result;
}
