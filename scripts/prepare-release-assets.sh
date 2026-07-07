#!/usr/bin/env bash
# Collect distributable release files from CI artifacts (no unpacked Electron trees).
set -euo pipefail

ROOT="${1:?usage: prepare-release-assets.sh <artifacts-dir> <output-dir>}"
OUT="${2:?usage: prepare-release-assets.sh <artifacts-dir> <output-dir>}"

mkdir -p "$OUT"

copy_glob() {
  local label="$1"
  local dir="$2"
  shift 2
  local found=0
  shopt -s nullglob
  for pattern in "$@"; do
    for file in "$dir"/$pattern; do
      [[ -f "$file" ]] || continue
      cp "$file" "$OUT/"
      echo "[release] $label: $(basename "$file")"
      found=1
    done
  done
  shopt -u nullglob
  if [[ "$found" -eq 0 ]]; then
    echo "[release] warning: no $label files in $dir" >&2
  fi
}

copy_glob "Linux AppImage" "$ROOT/desktop-linux" "*.AppImage"
copy_glob "Windows installer" "$ROOT/desktop-windows-installer" "*Setup*.exe"
copy_glob "Windows portable" "$ROOT/desktop-windows-portable" "*portable*.exe"
copy_glob "macOS DMG" "$ROOT/desktop-macos" "*.dmg"
copy_glob "Android APK" "$ROOT/android-debug-apk" "*.apk"

if [[ -d "$ROOT/web-dist" ]]; then
  WEB_ZIP="$OUT/elizon-web-dist.zip"
  (cd "$ROOT/web-dist" && zip -r "$WEB_ZIP" .)
  echo "[release] Web bundle: $(basename "$WEB_ZIP")"
else
  echo "[release] warning: web-dist not found" >&2
fi

echo "[release] Upload set:"
find "$OUT" -maxdepth 1 -type f -printf '  %f (%s bytes)\n' | sort
