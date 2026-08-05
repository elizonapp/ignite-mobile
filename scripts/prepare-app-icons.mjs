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

/** MSIX / Microsoft Store tile assets (build/appx/). */
const appxDir = path.join(buildDir, "appx");
const appxAssets = {
  "StoreLogo.png": 50,
  "Square44x44Logo.png": 44,
  "Square150x150Logo.png": 150,
  "Wide310x150Logo.png": [310, 150],
  "LargeTile.png": 310,
  "SmallTile.png": 71,
  "BadgeLogo.png": 24,
  "SplashScreen.png": [620, 300],
};
for (const [name, size] of Object.entries(appxAssets)) {
  const outFile = path.join(appxDir, name);
  await mkdir(appxDir, { recursive: true });
  if (Array.isArray(size)) {
    const [w, h] = size;
    await sharp({
      create: { width: w, height: h, channels: 4, background: iconBg },
    })
      .composite([
        {
          input: await pipeline
            .clone()
            .resize(Math.round(Math.min(w, h) * 0.72), Math.round(Math.min(w, h) * 0.72), {
              fit: "contain",
              background: iconBg,
            })
            .flatten({ background: iconBg })
            .removeAlpha()
            .png()
            .toBuffer(),
          gravity: "centre",
        },
      ])
      .png()
      .toFile(outFile);
    console.log(`[icons] Wrote ${path.relative(root, outFile)} (${w}x${h})`);
  } else {
    await writePng(pipeline, size, outFile, { opaque: true });
  }
}

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
  // Keep clear of screen edges; portrait phones need horizontal margin.
  const maxW = Math.round(width * 0.72);
  const maxH = Math.round(height * 0.22);
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

/**
 * Android 12+ SplashScreen API draws the icon inside a circle (~2/3 of the
 * asset). A wide wordmark must fit inside that circle or it gets clipped.
 * Canvas 1152px; logo bbox kept within ~520px so corners stay inside the mask.
 */
{
  const size = 1152;
  const circleSafe = Math.round(size * 0.52);
  const outFile = path.join(root, "android/app/src/main/res/drawable/splash_logo.png");
  const logoMeta = await sharp(splashLogoPath).metadata();
  const logoW = logoMeta.width || 1;
  const logoH = logoMeta.height || 1;
  // Fit rectangle inside circle of diameter circleSafe:
  // (w/2)^2 + (h/2)^2 <= (r)^2  with w/h = logo aspect
  const aspect = logoW / logoH;
  const maxW = Math.floor(
    (circleSafe * aspect) / Math.sqrt(aspect * aspect + 1),
  );
  const maxH = Math.floor(maxW / aspect);
  const logo = await sharp(splashLogoPath)
    .resize(Math.max(1, maxW), Math.max(1, maxH), {
      fit: "inside",
      background: splashBg,
    })
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: splashBg },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toFile(outFile);
  console.log(
    `[splash] Wrote ${path.relative(root, outFile)} (${size}x${size}, logo ${maxW}x${maxH} in circle)`,
  );
}
