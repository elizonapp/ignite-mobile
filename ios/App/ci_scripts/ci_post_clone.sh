#!/usr/bin/env bash
set -euo pipefail

# Xcode Cloud: runs after clone, before resolving Swift packages.
# Needed because public/, capacitor.config.json, config.xml are gitignored
# and CapApp-SPM depends on node_modules via a local path.

cd "${CI_PRIMARY_REPOSITORY_PATH:-$(cd "$(dirname "$0")/../../.." && pwd)}"

export HOMEBREW_NO_INSTALL_CLEANUP=TRUE

echo "==> Installing Bun"
curl -fsSL https://bun.sh/install | bash
export BUN_INSTALL="${HOME}/.bun"
export PATH="${BUN_INSTALL}/bin:${PATH}"

echo "==> Installing JS dependencies"
bun install --frozen-lockfile

echo "==> Building web assets"
bun run build

echo "==> Syncing Capacitor iOS"
bunx cap sync ios

echo "==> Post-clone complete"
