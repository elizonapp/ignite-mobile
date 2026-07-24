#!/usr/bin/env bun
/**
 * Generates platform app icons from public/favicon.ico (square mark, not the wide logo).
 */
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const icoPath = path.join(root, "public/favicon.ico");
const buildDir = path.join(root, "build");
const iconBg = { r: 9, g: 9, b: 11, alpha: 1 };

/** @returns {{ width: number, height: number, pixels: Buffer }} */
function decodeLargestIcoFrame(buffer) {
  const count = buffer.readUInt16LE(4);
  let best = null;

  for (let i = 0; i < count; i++) {
    const entryOffset = 6 + i * 16;
    const width = buffer[entryOffset] || 256;
    const height = buffer[entryOffset + 1] || 256;
    const size = buffer.readUInt32LE(entryOffset + 8);
    const dataOffset = buffer.readUInt32LE(entryOffset + 12);
    const area = width * height;

    if (!best || area > best.area) {
      best = { width, height, size, dataOffset, area };
    }
  }

  if (!best) {
    throw new Error("favicon.ico enthält keine Bilddaten.");
  }

  const dib = buffer.subarray(best.dataOffset, best.dataOffset + best.size);
  const headerSize = dib.readUInt32LE(0);
  const xorHeight = dib.readInt32LE(8) / 2;
  const bpp = dib.readUInt16LE(14);
  const rowSize = Math.ceil((best.width * bpp) / 32) * 4;
  const pixels = Buffer.alloc(best.width * xorHeight * 4);

  for (let y = 0; y < xorHeight; y++) {
    const srcY = xorHeight - 1 - y;
    const srcRow = headerSize + srcY * rowSize;
    for (let x = 0; x < best.width; x++) {
      const srcIndex = srcRow + x * 4;
      const dstIndex = (y * best.width + x) * 4;
      pixels[dstIndex] = dib[srcIndex + 2];
      pixels[dstIndex + 1] = dib[srcIndex + 1];
      pixels[dstIndex + 2] = dib[srcIndex];
      pixels[dstIndex + 3] = dib[srcIndex + 3];
    }
  }

  return { width: best.width, height: xorHeight, pixels };
}

async function sourcePipeline() {
  const buffer = await readFile(icoPath);
  const frame = decodeLargestIcoFrame(buffer);
  return sharp(frame.pixels, {
    raw: { width: frame.width, height: frame.height, channels: 4 },
  });
}

/**
 * @param {import("sharp").Sharp} pipeline
 * @param {number} size
 * @param {string} outFile
 * @param {{ fit?: keyof import("sharp").FitEnum, opaque?: boolean }} [opts]
 */
async function writePng(pipeline, size, outFile, opts = {}) {
  const { fit = "contain", opaque = false } = opts;
  await mkdir(path.dirname(outFile), { recursive: true });
  let img = pipeline
    .clone()
    .resize(size, size, { fit, background: iconBg });

  // App Store rejects 1024 icons with any alpha channel (ITMS-90717).
  if (opaque) {
    img = img.flatten({ background: iconBg }).removeAlpha();
  }

  await img.png().toFile(outFile);
  console.log(`[icons] Wrote ${path.relative(root, outFile)} (${size}px${opaque ? ", opaque" : ""})`);
}

const androidForegroundSizes = {
  "mipmap-mdpi": 108,
  "mipmap-hdpi": 162,
  "mipmap-xhdpi": 216,
  "mipmap-xxhdpi": 324,
  "mipmap-xxxhdpi": 432,
};

const androidLegacySizes = {
  "mipmap-mdpi": 48,
  "mipmap-hdpi": 72,
  "mipmap-xhdpi": 96,
  "mipmap-xxhdpi": 144,
  "mipmap-xxxhdpi": 192,
};

const pipeline = await sourcePipeline();

await writePng(pipeline, 512, path.join(buildDir, "icon.png"), { opaque: true });
await writePng(pipeline, 180, path.join(root, "public/apple-touch-icon.png"), { opaque: true });
await writePng(
  pipeline,
  1024,
  path.join(root, "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"),
  { opaque: true },
);

for (const [folder, size] of Object.entries(androidForegroundSizes)) {
  await writePng(
    pipeline,
    size,
    path.join(root, "android/app/src/main/res", folder, "ic_launcher_foreground.png"),
  );
}

for (const [folder, size] of Object.entries(androidLegacySizes)) {
  await writePng(
    pipeline,
    size,
    path.join(root, "android/app/src/main/res", folder, "ic_launcher.png"),
  );
  await writePng(
    pipeline,
    size,
    path.join(root, "android/app/src/main/res", folder, "ic_launcher_round.png"),
  );
}
