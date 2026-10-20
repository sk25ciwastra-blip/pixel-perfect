const fs = require("node:fs");
const zlib = require("node:zlib");

const sourcePath = "C:/Users/USER/Downloads/Logo Resmi BTRD25.png";
const outputPath = "public/assets/Logo_Resmi_BTRD25_Transparan.png";
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

function isNearBlack(index) {
  return pixels[index + 3] > 0
    && pixels[index] <= 18
    && pixels[index + 1] <= 18
    && pixels[index + 2] <= 18;
}

const background = new Uint8Array(width * height);
const queue = [];
for (let x = 0; x < width; x += 1) {
  queue.push(x, (height - 1) * width + x);
}
for (let y = 0; y < height; y += 1) {
  queue.push(y * width, y * width + width - 1);
}
for (let cursor = 0; cursor < queue.length; cursor += 1) {
  const point = queue[cursor];
  if (background[point]) continue;
  if (!isNearBlack(point * 4)) continue;
  background[point] = 1;
  const x = point % width;
  const y = Math.floor(point / width);
  if (x > 0) queue.push(point - 1);
  if (x + 1 < width) queue.push(point + 1);
  if (y > 0) queue.push(point - width);
  if (y + 1 < height) queue.push(point + width);
}

let minX = width;
let minY = height;
let maxX = -1;
let maxY = -1;
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const point = y * width + x;
    const index = point * 4;
    if (background[point]) {
      pixels[index + 3] = 0;
      continue;
    }
    if (pixels[index + 3] > 0) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
}

if (maxX < minX || maxY < minY) throw new Error("Logo content was not found");
const padding = 16;
minX = Math.max(0, minX - padding);
minY = Math.max(0, minY - padding);
maxX = Math.min(width - 1, maxX + padding);
maxY = Math.min(height - 1, maxY + padding);
const outputWidth = maxX - minX + 1;
const outputHeight = maxY - minY + 1;
const outputRaw = Buffer.alloc((outputWidth * 4 + 1) * outputHeight);
for (let y = minY; y <= maxY; y += 1) {
  const rowOffset = (y - minY) * (outputWidth * 4 + 1);
  outputRaw[rowOffset] = 0;
  for (let x = minX; x <= maxX; x += 1) {
    const sourceIndex = (y * width + x) * 4;
    const targetIndex = rowOffset + 1 + (x - minX) * 4;
    outputRaw[targetIndex] = pixels[sourceIndex];
    outputRaw[targetIndex + 1] = pixels[sourceIndex + 1];
    outputRaw[targetIndex + 2] = pixels[sourceIndex + 2];
    outputRaw[targetIndex + 3] = pixels[sourceIndex + 3];
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(outputWidth, 0);
ihdr.writeUInt32BE(outputHeight, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const result = Buffer.concat([
  signature,
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(outputRaw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);
fs.writeFileSync(outputPath, result);
console.log(JSON.stringify({ outputPath, width: outputWidth, height: outputHeight }));
