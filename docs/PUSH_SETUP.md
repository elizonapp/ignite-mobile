# Native Push Notifications Setup

Native push uses `@capacitor/push-notifications`, FCM (Android) and APNs (iOS). The elizon API stores device tokens via `POST /api/user/push/device-token` and delivers through Firebase Admin (Android) or the APNs HTTP/2 API (iOS).

## 1. Firebase project (required for Android FCM)

1. Create a Firebase project (or reuse an existing one).
2. Add an **Android** app with package name `app.elizon.ignite.mobile`.
3. Download `google-services.json` → place at `android/app/google-services.json` (template: `google-services.json.example`). The real file is gitignored.
4. In Firebase → Project settings → Service accounts → generate a private key JSON for the backend (`FIREBASE_SERVICE_ACCOUNT_JSON`). That server key must never be committed.

Android needs `google-services.json` for FCM. iOS uses APNs only — no Firebase plist on the client.

## 2. Apple Push (APNs)

1. In Apple Developer → Keys → create an **APNs** key (`.p8`).
2. Note Key ID and Team ID.
3. In Xcode: enable **Push Notifications** capability for the App target (entitlements file `App.entitlements` is already wired with `aps-environment`).
4. Upload the APNs key to Firebase (Project settings → Cloud Messaging → Apple app configuration) if you also use FCM for iOS tooling; the elizon backend sends iOS pushes directly via APNs using the env vars below.

## 3. Backend environment

Set on the API server:

```bash
# Firebase Admin (Android / FCM registration tokens)
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'

# APNs (iOS device tokens from Capacitor)
APNS_KEY_ID=XXXXXXXXXX
APNS_TEAM_ID=XXXXXXXXXX
APNS_BUNDLE_ID=app.elizon.ignite.mobile
APNS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
# Optional: "true" for production APNs, anything else uses api.sandbox.push.apple.com
APNS_PRODUCTION=false
```

Also keep existing Web Push VAPID vars (browser dashboard **and** Electron desktop):

```bash
WEB_PUSH_VAPID_PUBLIC_KEY=...
WEB_PUSH_VAPID_PRIVATE_KEY=...
WEB_PUSH_SUBJECT=mailto:support@elizon.app
```

### Eligibility

| Channel | Opt-in | elizon+ required? |
|---------|--------|-------------------|
| Browser web push (`platform=browser`) | `webPushNotifications` | yes |
| Electron desktop (`platform=electron`) | client toggle → endpoint `enabled` | no |
| Mobile native (iOS/Android) | client toggle → endpoint `enabled` | no |

Pushes are only delivered to endpoints with `enabled=true`.

## 4. Client sync

After placing credential files:

```bash
cd mobile/ignite
bun install
bunx cap sync
```

If you run `cap sync` on Windows, check `ios/App/CapApp-SPM/Package.swift`: dependency paths must use forward slashes (`../../../node_modules/...`). Backslash paths break Xcode on macOS.

## 5. Automated checks (CI / local)

```bash
# from monorepo root
bunx vitest run __tests__/nativePushRelay.test.ts __tests__/pushNotifications.nativeRelay.test.ts
```

These cover APNs JWT creation, iOS HTTP delivery (mocked), FCM missing-config handling, and `pushNotificationsService` native relay wiring.

## 6. Manual device check (required before release)

1. Place real `android/app/google-services.json` and set backend env vars (section 3).
2. Build and install on a **physical** device (iOS Simulator push is limited; Android emulator needs a Google Play image + FCM).
3. Sign in → Einstellungen → Benachrichtigungen → enable **Push-Benachrichtigungen**.
4. Confirm the system permission dialog (iOS shows: *Wir senden Ihnen Benachrichtigungen zu neuen Aktivitäten auf Ihrem Konto.*).
5. Verify a row in `push_endpoints` with `channel = MOBILE_NATIVE` and the correct `platform`.
6. Trigger a service-monitoring (or admin test) notification and confirm it appears while the app is backgrounded.
7. Disable the toggle and confirm the endpoint is set to `enabled = false`.
8. For App Store / TestFlight builds, set `aps-environment` in `App.entitlements` to `production` (debug uses `development`).
