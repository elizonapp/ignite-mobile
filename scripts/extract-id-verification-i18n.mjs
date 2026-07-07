import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../../..");
const deUser = fs.readFileSync(path.join(root, "app/i18n/de.user.ts"), "utf8");
const enUser = fs.readFileSync(path.join(root, "app/i18n/en.user.ts"), "utf8");

const keyRe = /^\s*(idVerification[A-Za-z]+|requiredFieldLegend):/gm;
const keys = new Set();
let m;
while ((m = keyRe.exec(deUser))) keys.add(m[1]);

function extractValue(src, key) {
  const re = new RegExp(`\\s*${key}:\\s*\\n\\s*"([\\s\\S]*?)"`, "m");
  const multiline = src.match(re);
  if (multiline) return multiline[1];
  const single = src.match(new RegExp(`\\s*${key}:\\s*"([^"]*)"`));
  if (single) return single[1];
  return null;
}

const linesDe = [];
const linesEn = [];
for (const key of [...keys].sort()) {
  const de = extractValue(deUser, key);
  const en = extractValue(enUser, key);
  if (!de || !en) {
    console.error("missing", key);
    continue;
  }
  linesDe.push(`  ${key}: ${JSON.stringify(de)},`);
  linesEn.push(`  ${key}: ${JSON.stringify(en)},`);
}

fs.writeFileSync(path.join(__dirname, "id-verification-i18n-de.txt"), linesDe.join("\n"));
fs.writeFileSync(path.join(__dirname, "id-verification-i18n-en.txt"), linesEn.join("\n"));
console.log("extracted", linesDe.length, "keys");
