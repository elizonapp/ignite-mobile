# Ignite Client

Official **Ignite** client for web, desktop (Electron), and Android (Capacitor). One codebase, multiple targets — connected to the elizon hosting API at [elizon.app](https://www.elizon.app).

## Repository

| Context | Location |
|---|---|
| Development (monorepo) | [`elizonapp/ignite-2`](https://github.com/elizonapp/ignite-2) → `mobile/ignite/` |
| Mirror (standalone) | [`elizonapp/ignite-mobile`](https://github.com/elizonapp/ignite-mobile) |

Changes are made in the monorepo and mirrored to `ignite-mobile` via **Mirror sync**. CI artifacts (installers, APK) are produced in the mirror repo under **Actions → Build**.

## Stack

- **Runtime / bundler:** [Bun](https://bun.sh) 1.2.x
- **UI:** React 19, Tailwind CSS 4, Radix UI
- **Desktop:** Electron 43 + electron-builder 26
- **Android:** Capacitor 8 (Node.js ≥ 22 for `cap sync`)
- **API:** REST against elizon (`src/lib/api.ts`, resources under `src/api/`)

## Requirements

| Platform | Required |
|---|---|
| Web / desktop | Bun 1.2.x |
| Desktop build (Linux CI) | `sharp` (devDependency, icons from WebP) |
| Android | Node.js 22+, JDK 21, Android SDK |
| macOS desktop | Xcode (local only; no iOS CI build) |

## Quick start (web)

```bash
bun install
bun dev          # Dev server with hot reload (http://localhost:3000)
```

Production bundle:

```bash
bun run build    # Output: dist/
bun start        # Serve dist/ statically
```

Default API base URL: `https://www.elizon.app`. A different base URL can be set in settings or at login (stored in `localStorage`).

Brand assets (logos, fonts, icons) are loaded from the configured website origin at runtime — not duplicated in this repo. Only the app launcher icon (`public/favicon.ico`) ships with the client.

## Desktop (Electron)

```bash
bun run desktop:dev      # Build + Electron window
bun run desktop:build    # All configured desktop targets
```

Platform-specific:

```bash
bun run desktop:build:linux       # AppImage → release/
bun run desktop:build:mac         # DMG → release/
bun run desktop:build:win:builder # NSIS + portable .exe → release/
```

Before each desktop build, `build/icon.png` is generated from `public/favicon.ico` (`bun run icons:desktop`), because electron-builder requires at least 256×256 — the bundled favicon only contains smaller sizes.

### Auto-Updates

Packaged desktop builds check [GitHub Releases](https://github.com/elizonapp/ignite-mobile/releases) for newer versions via `electron-updater`:

- **Automatic check** ~5 seconds after startup (Windows NSIS installer, Linux AppImage)
- **macOS:** only notifies about a new version and opens the GitHub release — manual install via DMG
- **Manual check** in **Einstellungen → Über → Nach Updates suchen**
- **Not supported:** Windows portable build (`PORTABLE_EXECUTABLE_DIR`)

Each release includes `latest.yml` / `latest-linux.yml` / `latest-mac.yml` next to the installer artifacts (original electron-builder filenames). Bump `"version"` in `package.json` before merging to `main`, otherwise clients will not detect a newer build.

Code signing is still disabled in CI; updates work, but Windows SmartScreen / macOS Gatekeeper may show warnings until signing is enabled.

## Android

```bash
bun run build
bunx cap sync android
cd android && ./gradlew assembleDebug
```

Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`

The Capacitor CLI requires **Node.js ≥ 22**. In CI, the Android build runs `./gradlew assembleDebug` inside the `android/` directory after `cap sync`.

## Version

The displayed version combines semver from `package.json` with the git commit:

```text
0.8.2 (ba3559d)
```

- Semver: `"version"` in `package.json`
- Commit: `GITHUB_SHA` in CI or `git rev-parse --short=7 HEAD` locally
- Optional override: `APP_VERSION` in `.env` (semver part only)

Build-time injection happens in `build.ts` → `process.env.APP_VERSION` in `src/lib/config.ts`.

## Project structure

```text
src/                 React app (screens, features, i18n)
src/api/             API resources + error resolution (standalone, mirror-safe)
src/lib/             API client, config, platform helpers
electron/            Electron main/preload/static server
android/             Capacitor Android project
public/              Static assets (logos, icons)
scripts/             Build helpers (icons, version)
.github/workflows/   Reusable CI workflows
build.ts             Bun bundle (dist/)
```

## CI (GitHub Actions)

Workflow **Build** (standalone repo) or **Mobile App** (monorepo orchestrator):

| Job | Artifact |
|---|---|
| web-build | `dist/` (web bundle) |
| desktop-linux | `release/*.AppImage` |
| desktop-windows | NSIS installer + portable `.exe` |
| desktop-macos | `release/*.dmg` |
| android | Debug APK |

Artifacts are available for 14–30 days under **Actions → Run → Artifacts**.

### GitHub Releases

On every push to `main`, the **Build** workflow creates a [GitHub Release](https://github.com/elizonapp/ignite-mobile/releases) after all platform jobs succeed:

- Tag format: `v{semver}-{short-sha}` (e.g. `v0.8.2-ba3559d`)
- Release title: `ignite {semver} ({sha})`
- **Desktop:** `ignite-desktop-{version}-linux.AppImage`, `-windows-setup.exe`, `-windows-portable.exe`, `-macos.dmg`
- **Mobile:** `ignite-mobile-{version}-android-debug.apk`, `-web.zip`

Pull request builds do not publish releases (artifacts only).

## Monorepo development

In the `ignite-2` monorepo, shared types and API logic historically lived under `lib/`. The client is **mirror-standalone**: imports must not point at `../../lib/`. Shared files live under `src/api/` and `src/shared/`.

After changes under `mobile/ignite/**`, push to main; **Mirror sync** updates `ignite-mobile` automatically.

## License

Proprietary — elizon. Not for redistribution without permission.
