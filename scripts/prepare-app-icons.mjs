#!/usr/bin/env bun
/**
 * Generates platform app icons from public/app-icon-big.png
 * and Android splash screens from public/logo-dark.webp (elizon wordmark).
 * public/favicon.ico is left untouched.
 */
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "public/app-icon-big.png");
const buildDir = path.join(root, "build");
const iconBg = { r: 9, g: 9, b: 11, alpha: 1 };
const splashBg = { r: 0, g: 0, b: 0, alpha: 1 };

/** Splash logo: mobile-local only (standalone CI repo has no monorepo ../../public). */
async function resolveSplashLogoPath() {
  const candidates = [
    path.join(root, "public", "logo-dark.webp"),
    sourcePath,
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try next
    }
  }
  throw new Error("No splash logo found (expected public/logo-dark.webp or public/app-icon-big.png)");
}

const splashLogoPath = await resolveSplashLogoPath();
console.log(`[splash] Using ${path.relative(root, splashLogoPath) || splashLogoPath}`);

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

/** Capacitor default splash sizes — logo centered on black. */
const androidSplashSizes = {
  drawable: [480, 320],
  "drawable-land-mdpi": [480, 320],
  "drawable-land-hdpi": [800, 480],
  "drawable-land-xhdpi": [1280, 720],
  "drawable-land-xxhdpi": [1600, 960],
  "drawable-land-xxxhdpi": [1920, 1280],
  "drawable-port-mdpi": [320, 480],
  "drawable-port-hdpi": [480, 800],
  "drawable-port-xhdpi": [720, 1280],
  "drawable-port-xxhdpi": [960, 1600],
  "drawable-port-xxxhdpi": [1280, 1920],
};

/**
 * @param {number} width
 * @param {number} height
 * @param {string} outFile
 */
async function writeSplash(width, height, outFile) {
  await mkdir(path.dirname(outFile), { recursive: true });
  const maxW = Math.round(width * 0.62);
  const maxH = Math.round(height * 0.28);
  const logo = await sharp(splashLogoPath)
    .resize(maxW, maxH, { fit: "inside", background: splashBg })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: splashBg,
    },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toFile(outFile);

  console.log(`[splash] Wrote ${path.relative(root, outFile)} (${width}x${height})`);
}

for (const [folder, [width, height]] of Object.entries(androidSplashSizes)) {
  await writeSplash(
    width,
    height,
    path.join(root, "android/app/src/main/res", folder, "splash.png"),
  );
}

// Android 12+ centered splash icon (wordmark on black square).
{
  const size = 576;
  const max = Math.round(size * 0.72);
  const outFile = path.join(root, "android/app/src/main/res/drawable/splash_logo.png");
  const logo = await sharp(splashLogoPath)
    .resize(max, max, { fit: "inside", background: splashBg })
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: splashBg },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toFile(outFile);
  console.log(`[splash] Wrote ${path.relative(root, outFile)} (${size}x${size})`);
}
