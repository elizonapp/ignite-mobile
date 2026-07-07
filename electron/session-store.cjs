const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");

const SESSION_FILE = "elizon-session.json";

function getFilePath() {
  return path.join(app.getPath("userData"), SESSION_FILE);
}

/** @returns {{ token: string | null; persist: boolean }} */
function readSession() {
  try {
    const filePath = getFilePath();
    if (!fs.existsSync(filePath)) {
      return { token: null, persist: false };
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const token = typeof parsed?.token === "string" ? parsed.token : null;
    const persist = parsed?.persist !== false;
    if (!token || !persist) {
      return { token: null, persist: false };
    }
    return { token, persist: true };
  } catch {
    return { token: null, persist: false };
  }
}

/**
 * @param {string | null} token
 * @param {boolean} persist
 */
function writeSession(token, persist) {
  const filePath = getFilePath();
  if (!token || !persist) {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // ignore
    }
    return;
  }
  fs.writeFileSync(filePath, JSON.stringify({ token, persist: true }), "utf8");
}

function clearSession() {
  writeSession(null, false);
}

module.exports = { readSession, writeSession, clearSession };
