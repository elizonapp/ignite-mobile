# Native Push Notifications Setup

Native push uses `@capacitor/push-notifications`, FCM (Android) and APNs (iOS). The **desktop Electron app does not use Firebase** — it stays in the system tray and pulls notifications from the normal elizon API (`https://www.elizon.app`), then shows them via the OS notification APIs.

The elizon API stores device tokens via `POST /api/user/push/device-token` and delivers through Firebase Admin (Android), APNs (iOS), Web Push VAPID (browser), or an in-app notification row that Electron polls (desktop).

## 1. Firebase project (required for Android FCM only)

1. Create a Firebase project (or reuse an existing one).
2. Add an **Android** app with package name `app.elizon.ignite.mobile`.
3. Download `google-services.json` → place at `android/app/google-services.json` (template: `google-services.json.example`). The real file is gitignored.
4. In Firebase → Project settings → Service accounts → generate a private key JSON for the backend (`FIREBASE_SERVICE_ACCOUNT_JSON`). That server key must never be committed.

Android needs `google-services.json` for FCM. iOS uses APNs only — no Firebase plist on the client. Electron desktop needs **no** Firebase client config.

## 2. Apple Push (APNs)

1. In Apple Developer → Keys → create an **APNs** key (`.p8`).
2. Note Key ID and Team ID.
3. In Xcode: enable **Push Notifications** capability for the App target (entitlements file `App.entitlements` is already wired with `aps-environment`).
4. Upload the APNs key to Firebase (Project settings → Cloud Messaging → Apple app configuration) if you also use FCM for iOS tooling; the elizon backend sends iOS pushes directly via APNs using the env vars below.

## 3. Backend environment

Set on the API server:

```bash
# Firebase Admin (Android FCM registration tokens only)
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'

# APNs (iOS device tokens from Capacitor)
APNS_KEY_ID=XXXXXXXXXX
APNS_TEAM_ID=XXXXXXXXXX
APNS_BUNDLE_ID=app.elizon.ignite.mobile
APNS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
# Optional: "true" for production APNs, anything else uses api.sandbox.push.apple.com
APNS_PRODUCTION=false
```

Also keep existing Web Push VAPID vars for the **browser dashboard** (not Electron):

```bash
WEB_PUSH_VAPID_PUBLIC_KEY=...
WEB_PUSH_VAPID_PRIVATE_KEY=...
WEB_PUSH_SUBJECT=mailto:support@elizon.app
```

### Eligibility

| Channel | Opt-in | elizon+ required? |
|---------|--------|-------------------|
| Browser web push (`platform=browser`) | `webPushNotifications` | yes |
| Electron desktop (`channel=ELECTRON`, platform `win32` / `linux` / `darwin`) | client toggle → endpoint `enabled` | no |
| Mobile native (iOS/Android) | client toggle → endpoint `enabled` | no |

Pushes are only delivered to endpoints with `enabled=true`.

### Desktop behaviour (Electron)

Electron has no Chrome push service, so Web Push / FCM client registration is not used.

1. Closing the window hides the app to the **system tray**; the process stays alive.
2. With push enabled, the main process polls `/api/user/notifications` on the elizon API (same origin as the rest of the app).
3. New unread rows become OS toasts (Windows Action Center, Linux notification daemon, macOS Notification Center).
4. The backend writes those rows for `channel=ELECTRON` instead of calling FCM.
5. Quit only from the tray menu (or Cmd+Q on macOS) — then polling stops until the app is started again.

Optional: set `ELIZON_API_BASE` for non-production API hosts (defaults to `https://www.elizon.app`).

## 4. Client sync

After placing credential files (mobile only):

```bash
cd mobile/ignite
bun install
bunx cap sync
```

If you run `cap sync` on Windows, check `ios/App/CapApp-SPM/Package.swift`: dependency paths must use forward slashes (`../../../node_modules/...`). Backslash paths break Xcode on macOS.

For desktop:

```bash
bun run desktop:dev
# or
bun run desktop:build:win
```

## 5. Automated checks (CI / local)

```bash
# from monorepo root
bunx vitest run __tests__/nativePushRelay.test.ts __tests__/pushNotifications.nativeRelay.test.ts
```

These cover APNs JWT creation, iOS HTTP delivery (mocked), FCM missing-config handling, and `pushNotificationsService` native relay wiring.

## 6. Manual device check (required before release)

### Mobile

1. Place real `android/app/google-services.json` and set backend env vars (section 3).
2. Build and install on a **physical** device (iOS Simulator push is limited; Android emulator needs a Google Play image + FCM).
3. Sign in → Einstellungen → Benachrichtigungen → enable **Push-Benachrichtigungen**.
4. Confirm the system permission dialog (iOS shows: *Wir senden Ihnen Benachrichtigungen zu neuen Aktivitäten auf Ihrem Konto.*).
5. Verify a row in `push_endpoints` with `channel = MOBILE_NATIVE` and the correct `platform`.
6. Trigger a service-monitoring (or admin test) notification and confirm it appears while the app is backgrounded.
7. Disable the toggle and confirm the endpoint is set to `enabled = false`.
8. For App Store / TestFlight builds, set `aps-environment` in `App.entitlements` to `production` (debug uses `development`).

### Desktop (Windows / Linux / macOS)

1. No Firebase client config required — only a normal login against the elizon API.
2. Run or install the desktop build; enable Push in Einstellungen → Benachrichtigungen.
3. Verify `push_endpoints` with `channel = ELECTRON` and platform `win32`, `linux`, or `darwin`.
4. Close the window (app stays in tray) and trigger a monitoring push — toast must appear in the OS notification center.
5. Click the toast — the main window should open again.
6. Quit from the tray menu — further toasts stop until the app is started again.
7. Disable the toggle and confirm the endpoint is set to `enabled = false`.
