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

  echo "==> Installing Bun via Homebrew"
  brew tap oven-sh/bun
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
bun install --frozen-lockfile

PLUGIN_PATH="node_modules/capacitor-secure-storage-plugin"
if [[ ! -d "$PLUGIN_PATH" ]]; then
  echo "ERROR: ${PLUGIN_PATH} missing after bun install (required by CapApp-SPM)"
  ls -la node_modules 2>/dev/null | head -n 50 || true
  exit 1
fi

echo "==> Building web assets"
bun run build

echo "==> Syncing Capacitor iOS"
bunx cap sync ios

echo "==> Post-clone complete"
