export const DEFAULT_FACE_COLOR = [0xf9 / 255, 0xd7 / 255, 0x2c / 255, 1];

export const PAINT_COLOR_MAP = [
  "",
  "8",
  "0C",
  "1C",
  "2C",
  "3C",
  "4C",
  "5C",
  "6C",
  "7C",
  "8C",
  "9C",
  "AC",
  "BC",
  "CC",
  "DC",
];

export const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();
