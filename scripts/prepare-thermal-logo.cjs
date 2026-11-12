// Deterministic print preparation only. Never redraws, retypes or replaces source pixels.
const fs = require("node:fs");
const zlib = require("node:zlib");

const sourcePath = "public/assets/receipt-thermal-logo-source.png";
const outputPath = "src/assets/receipt-thermal-logo-monochrome.png";
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuffer, data]);
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  body.copy(result, 4);
  result.writeUInt32BE(crc32(body), 8 + data.length);
  return result;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

const input = fs.readFileSync(sourcePath);
if (!input.subarray(0, 8).equals(signature)) throw new Error("Not a PNG file");

let offset = 8;
let width;
let height;
let bitDepth;
let colorType;
let interlace;
const idat = [];
while (offset < input.length) {
  const length = input.readUInt32BE(offset);
  const type = input.subarray(offset + 4, offset + 8).toString("ascii");
  const data = input.subarray(offset + 8, offset + 8 + length);
  offset += 12 + length;
  if (type === "IHDR") {
    width = data.readUInt32BE(0);
    height = data.readUInt32BE(4);
    bitDepth = data[8];
    colorType = data[9];
    interlace = data[12];
  } else if (type === "IDAT") {
    idat.push(data);
  } else if (type === "IEND") {
    break;
  }
}

if (bitDepth !== 8 || ![2, 6].includes(colorType) || interlace !== 0) {
  throw new Error(`Unsupported PNG format: bitDepth=${bitDepth}, colorType=${colorType}, interlace=${interlace}`);
}

const sourceBytesPerPixel = colorType === 6 ? 4 : 3;
const rowBytes = width * sourceBytesPerPixel;
const raw = zlib.inflateSync(Buffer.concat(idat));
const pixels = Buffer.alloc(width * height * 4);
let rawOffset = 0;
let previous = Buffer.alloc(rowBytes);
for (let y = 0; y < height; y += 1) {
  const filter = raw[rawOffset++];
  const row = Buffer.from(raw.subarray(rawOffset, rawOffset + rowBytes));
  rawOffset += rowBytes;
  for (let x = 0; x < rowBytes; x += 1) {
    const left = x >= sourceBytesPerPixel ? row[x - sourceBytesPerPixel] : 0;
    const up = previous[x] ?? 0;
    const upLeft = x >= sourceBytesPerPixel ? previous[x - sourceBytesPerPixel] : 0;
    if (filter === 1) row[x] = (row[x] + left) & 255;
    else if (filter === 2) row[x] = (row[x] + up) & 255;
    else if (filter === 3) row[x] = (row[x] + Math.floor((left + up) / 2)) & 255;
    else if (filter === 4) row[x] = (row[x] + paeth(left, up, upLeft)) & 255;
    else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}`);
  }
  for (let x = 0; x < width; x += 1) {
    const sourceIndex = x * sourceBytesPerPixel;
    const targetIndex = (y * width + x) * 4;
    pixels[targetIndex] = row[sourceIndex];
    pixels[targetIndex + 1] = row[sourceIndex + 1];
    pixels[targetIndex + 2] = row[sourceIndex + 2];
    pixels[targetIndex + 3] = colorType === 6 ? row[sourceIndex + 3] : 255;
  }
  previous = row;
}

// Composite onto white, then threshold luminance. The blue badge becomes black;
// its white check and every original glyph keep their source geometry.
const ink = new Uint8Array(width * height);
let minX = width, minY = height, maxX = -1, maxY = -1;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4, alpha = pixels[i + 3] / 255;
    const luminance = (pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722) * alpha + 255 * (1 - alpha);
    if (luminance < 180) {
      ink[y * width + x] = 1;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
}
if (maxX < minX || maxY < minY) throw new Error('Logo ink not found');
// Trim only blank paper with an 8-source-pixel safety border. No resampling.
minX = Math.max(0, minX - 8); minY = Math.max(0, minY - 8);
maxX = Math.min(width - 1, maxX + 8); maxY = Math.min(height - 1, maxY + 8);
const outputWidth = maxX - minX + 1, outputHeight = maxY - minY + 1;
const stride = Math.ceil(outputWidth / 8);
const output = Buffer.alloc((stride + 1) * outputHeight, 255);
for (let y = 0; y < outputHeight; y++) {
  const rowStart = y * (stride + 1);
  output[rowStart] = 0;
  for (let x = 0; x < outputWidth; x++) {
    if (ink[(y + minY) * width + x + minX]) output[rowStart + 1 + (x >> 3)] &= ~(128 >> (x & 7));
  }
}
const header = Buffer.alloc(13);
header.writeUInt32BE(outputWidth, 0); header.writeUInt32BE(outputHeight, 4);
header[8] = 1; // 1-bit grayscale, pure black on white.
fs.writeFileSync(outputPath, Buffer.concat([signature, chunk('IHDR', header),
  chunk('IDAT', zlib.deflateSync(output, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
console.log(JSON.stringify({ sourcePath, outputPath, sourceWidth: width, sourceHeight: height,
  crop: { x: minX, y: minY, width: outputWidth, height: outputHeight }, threshold: 180 }));
