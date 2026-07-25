#!/usr/bin/env bun
/**
 * Generates platform app icons from public/app-icon-big.png.
 * public/favicon.ico is left untouched.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "public/app-icon-big.png");
const buildDir = path.join(root, "build");
const iconBg = { r: 9, g: 9, b: 11, alpha: 1 };

async function sourcePipeline() {
  return sharp(sourcePath);
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
