#!/usr/bin/env bash
set -euo pipefail

# Xcode Cloud: runs after clone, before resolving Swift packages.
# CapApp-SPM depends on local path packages under node_modules/; those are
# gitignored and must be created here. Also regenerates Capacitor config/assets.

cd "${CI_PRIMARY_REPOSITORY_PATH:-$(cd "$(dirname "$0")/../../.." && pwd)}"

export HOMEBREW_NO_INSTALL_CLEANUP=TRUE
export HOMEBREW_NO_AUTO_UPDATE=1
# Xcode Cloud's network proxy is flaky under high concurrency.
export GIT_HTTP_MAX_REQUESTS=1

install_bun() {
  if command -v bun >/dev/null 2>&1; then
    echo "==> Bun already available: $(bun --version)"
    return 0
  fi

  # homebrew/core ships bun; oven-sh/bun is blocked by Homebrew tap trust on Xcode Cloud.
  echo "==> Installing Bun via Homebrew"
  brew install bun
  hash -r || true

  if command -v bun >/dev/null 2>&1; then
    echo "==> Bun installed: $(bun --version)"
    return 0
  fi

  # Fallback: official installer (curl exit 35 = SSL; often fails on Xcode Cloud)
  echo "==> Homebrew Bun not on PATH; trying official installer"
  curl --retry 5 --retry-delay 2 --retry-all-errors -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="${HOME}/.bun"
  export PATH="${BUN_INSTALL}/bin:${PATH}"
}

install_bun

if ! command -v bun >/dev/null 2>&1; then
  echo "ERROR: bun is not available after install"
  exit 1
fi

echo "==> Installing JS dependencies"
# Omit peers + ignore scripts: bun-plugin-tailwind peers on the npm package "bun",
# which is already in older lockfiles and whose postinstall fails on Xcode Cloud
# (@oven/bun-darwin-*). Runtime Bun comes from Homebrew above.
bun install --frozen-lockfile --omit=peer --ignore-scripts

PLUGIN_PATH="node_modules/capacitor-secure-storage-plugin"
if [[ ! -d "$PLUGIN_PATH" ]]; then
  echo "ERROR: ${PLUGIN_PATH} missing after bun install (required by CapApp-SPM)"
  ls -la node_modules 2>/dev/null | head -n 50 || true
  exit 1
fi

if [[ -d node_modules/bun ]]; then
  echo "==> Removing unused npm package bun (runtime is Homebrew)"
  rm -rf node_modules/bun node_modules/@oven
fi

echo "==> Building web assets"
bun run build

echo "==> Syncing Capacitor iOS"
bunx cap sync ios

# Capacitor on Windows writes backslash paths into Package.swift; Swift rejects them.
PACKAGE_SWIFT="ios/App/CapApp-SPM/Package.swift"
if [[ -f "$PACKAGE_SWIFT" ]]; then
  echo "==> Normalizing Package.swift dependency paths (forward slashes)"
  # Only touch lines with path: — leave comments alone.
  sed -i '' '/path:/s|\\|/|g' "$PACKAGE_SWIFT"
fi

# Xcode Cloud enables IDEPackageOnlyUseVersionsFromResolvedFile by default.
# `cap sync` rewrites CapApp-SPM/Package.swift (e.g. capacitor-swift-pm version),
# which invalidates the committed Package.resolved and fails the archive unless
# automatic resolution is allowed and the resolved file is refreshed.
echo "==> Allowing SwiftPM to refresh Package.resolved after cap sync"
defaults delete com.apple.dt.Xcode IDEPackageOnlyUseVersionsFromResolvedFile 2>/dev/null || true
defaults delete com.apple.dt.Xcode IDEDisableAutomaticPackageResolution 2>/dev/null || true

PACKAGE_RESOLVED="ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved"
rm -f "$PACKAGE_RESOLVED"

echo "==> Resolving Swift package dependencies"
(
  cd ios/App
  xcodebuild -resolvePackageDependencies -project App.xcodeproj -scheme App
)

echo "==> Post-clone complete"
