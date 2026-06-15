const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SVG_PATH = path.join(__dirname, '..', 'buildResources', 'icon.svg');
const OUTPUT_DIR = path.join(__dirname, '..', 'buildResources');
const SIZES = [16, 24, 32, 48, 64, 96, 128, 256];

async function generatePngs() {
  const svgBuffer = fs.readFileSync(SVG_PATH);
  const results = [];

  for (const size of SIZES) {
    const pngBuffer = await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toBuffer();
    results.push({ size, buffer: pngBuffer });
    console.log(`Generated ${size}x${size} PNG`);
  }

  return results;
}

function createIco(pngs) {
  const headerSize = 6;
  const entrySize = 16;
  const numImages = pngs.length;
  let offset = headerSize + entrySize * numImages;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(numImages, 4);

  const entries = [];
  const imageBuffers = [];

  for (const { size, buffer } of pngs) {
    const width = size >= 256 ? 0 : size;
    const height = size >= 256 ? 0 : size;
    const entry = Buffer.alloc(entrySize);
    entry.writeUInt8(width, 0);
    entry.writeUInt8(height, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(buffer.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    imageBuffers.push(buffer);
    offset += buffer.length;
  }

  return Buffer.concat([header, ...entries, ...imageBuffers]);
}

async function main() {
  const pngs = await generatePngs();
  const icoBuffer = createIco(pngs);
  const icoPath = path.join(OUTPUT_DIR, 'icon.ico');
  fs.writeFileSync(icoPath, icoBuffer);
  console.log(`ICO file created: ${icoPath} (${icoBuffer.length} bytes)`);

  const pngPath = path.join(OUTPUT_DIR, 'icon.png');
  const largest = pngs.find(p => p.size === 256);
  if (largest) {
    fs.writeFileSync(pngPath, largest.buffer);
    console.log(`PNG file created: ${pngPath}`);
  }
}

main().catch(console.error);
