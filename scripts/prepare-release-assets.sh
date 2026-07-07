#!/usr/bin/env bash
# Collect distributable release files from CI artifacts (no unpacked Electron trees).
set -euo pipefail

ROOT="${1:?usage: prepare-release-assets.sh <artifacts-dir> <output-dir>}"
OUT="${2:?usage: prepare-release-assets.sh <artifacts-dir> <output-dir>}"
PKG_JSON="${3:-package.json}"

VERSION="$(node -p "require('./${PKG_JSON}').version.replace(/^v/i, '')")"
DESKTOP_PREFIX="ignite-desktop-${VERSION}"
MOBILE_PREFIX="ignite-mobile-${VERSION}"

mkdir -p "$OUT"

stage_file() {
  local label="$1"
  local src="$2"
  local dest_name="$3"
  cp "$src" "$OUT/$dest_name"
  echo "[release] $label: $dest_name"
}

stage_updater_asset() {
  local label="$1"
  local src="$2"
  local dest_name
  dest_name="$(basename "$src")"
  cp "$src" "$OUT/$dest_name"
  echo "[release] $label: $dest_name"
}

find_one() {
  local dir="$1"
  shift
  shopt -s nullglob
  for pattern in "$@"; do
    for file in "$dir"/$pattern; do
      if [[ -f "$file" ]]; then
        shopt -u nullglob
        echo "$file"
        return 0
      fi
    done
  done
  shopt -u nullglob
  return 1
}

if file="$(find_one "$ROOT/desktop-linux" "ignite-desktop-*.AppImage" "*.AppImage")"; then
  stage_file "Linux AppImage" "$file" "${DESKTOP_PREFIX}-linux.AppImage"
  stage_updater_asset "Linux updater" "$file"
else
  echo "[release] warning: Linux AppImage not found" >&2
fi

if file="$(find_one "$ROOT/desktop-linux" "latest-linux.yml" "latest-linux.yml")"; then
  stage_updater_asset "Linux metadata" "$file"
else
  echo "[release] warning: latest-linux.yml not found" >&2
fi

if file="$(find_one "$ROOT/desktop-windows-installer" "ignite-desktop-setup-*.exe" "*Setup*.exe")"; then
  stage_file "Windows installer" "$file" "${DESKTOP_PREFIX}-windows-setup.exe"
  stage_updater_asset "Windows updater" "$file"
else
  echo "[release] warning: Windows installer not found" >&2
fi

if file="$(find_one "$ROOT/desktop-windows-installer" "latest.yml" "latest.yml")"; then
  stage_updater_asset "Windows metadata" "$file"
else
  echo "[release] warning: latest.yml not found" >&2
fi

if file="$(find_one "$ROOT/desktop-windows-installer" "*.exe.blockmap" "*.blockmap")"; then
  stage_updater_asset "Windows blockmap" "$file"
else
  echo "[release] warning: Windows blockmap not found" >&2
fi

if file="$(find_one "$ROOT/desktop-windows-portable" "ignite-desktop-portable-*.exe" "*portable*.exe")"; then
  stage_file "Windows portable" "$file" "${DESKTOP_PREFIX}-windows-portable.exe"
else
  echo "[release] warning: Windows portable not found" >&2
fi

if file="$(find_one "$ROOT/desktop-macos" "ignite-desktop-*.dmg" "*.dmg")"; then
  stage_file "macOS DMG" "$file" "${DESKTOP_PREFIX}-macos.dmg"
else
  echo "[release] warning: macOS DMG not found" >&2
fi

if file="$(find_one "$ROOT/desktop-macos" "latest-mac.yml" "latest-mac.yml")"; then
  stage_updater_asset "macOS metadata" "$file"
else
  echo "[release] warning: latest-mac.yml not found" >&2
fi

if file="$(find_one "$ROOT/android-debug-apk" "*.apk")"; then
  stage_file "Android APK" "$file" "${MOBILE_PREFIX}-android-debug.apk"
else
  echo "[release] warning: Android APK not found" >&2
fi

if [[ -d "$ROOT/web-dist" ]]; then
  WEB_ZIP="$OUT/${MOBILE_PREFIX}-web.zip"
  (cd "$ROOT/web-dist" && zip -qr "$WEB_ZIP" .)
  echo "[release] Web bundle: $(basename "$WEB_ZIP")"
else
  echo "[release] warning: web-dist not found" >&2
fi

echo "[release] Upload set:"
find "$OUT" -maxdepth 1 -type f -printf '  %f (%s bytes)\n' | sort
