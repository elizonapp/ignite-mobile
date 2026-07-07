#!/usr/bin/env bun
/**
 * electron-builder cannot convert WebP icons (Linux/macOS/Windows).
 * Generates build/icon.png (512x512) from public/logo-dark.webp before packaging.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "public/logo-dark.webp");
const outDir = path.join(root, "build");
const outFile = path.join(outDir, "icon.png");

await mkdir(outDir, { recursive: true });

await sharp(src)
  .resize(512, 512, {
    fit: "contain",
    background: { r: 15, g: 17, b: 21, alpha: 1 },
  })
  .png()
  .toFile(outFile);

console.log(`[icons] Wrote ${path.relative(root, outFile)}`);
