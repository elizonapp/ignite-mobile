import fs from "fs";
import path from "path";
import { app, Notification } from "electron";
import { readSession } from "./session-store.cjs";

const API_BASE = (process.env.ELIZON_API_BASE || "https://www.elizon.app").replace(/\/$/, "");
const POLL_INTERVAL_MS = 20_000;
const SEEN_FILE = "desktop-push-seen.json";
const DEVICE_ID_FILE = "desktop-push-device-id.json";

/** @typedef {{ title?: string, body?: string, tag?: string, data?: Record<string, unknown>, serviceId?: string, notificationId?: string }} DesktopPushPayload */

/**
 * @param {string} filePath
 * @returns {unknown | null}
 */
function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * @param {string} filePath
 * @param {unknown} value
 */
function writeJsonFile(filePath, value) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
  } catch (err) {
    console.error("[desktop-push] failed to write", filePath, err);
  }
}

function storagePaths() {
  const dir = path.join(app.getPath("userData"), "desktop-push");
  return {
    dir,
    seen: path.join(dir, SEEN_FILE),
    deviceId: path.join(dir, DEVICE_ID_FILE),
  };
}

function extractServiceIdFromLink(link) {
  if (typeof link !== "string") return undefined;
  const match = link.match(/\/services\/([^/?#]+)/);
  return match?.[1] || undefined;
}

export class DesktopPushService {
  /** @type {string | null} */
  #authToken = null;
  /** @type {ReturnType<typeof setInterval> | null} */
  #timer = null;
  /** @type {Set<string>} */
  #seenIds = new Set();
  /** @type {boolean} */
  #baselineReady = false;
  /** @type {boolean} */
  #pollInFlight = false;
  /** @type {string | null} */
  #deviceId = null;

  /** @type {((token: string) => void) | null} */
  onToken = null;
  /** @type {((payload: DesktopPushPayload) => void) | null} */
  onNotification = null;
  /** @type {((payload: DesktopPushPayload) => void) | null} */
  onNotificationClick = null;

  getToken() {
    return this.#deviceId;
  }

  isSupported() {
    return Notification.isSupported();
  }

  /**
   * Stable local device id (not an FCM token) — registered with the elizon API as channel ELECTRON.
   */
  ensureDeviceId() {
    if (this.#deviceId) return this.#deviceId;
    const paths = storagePaths();
    const stored = readJsonFile(paths.deviceId);
    if (stored && typeof stored === "object" && typeof stored.id === "string" && stored.id.trim()) {
      this.#deviceId = stored.id.trim();
      return this.#deviceId;
    }
    this.#deviceId = `electron_${app.getVersion()}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    writeJsonFile(paths.deviceId, { id: this.#deviceId });
    return this.#deviceId;
  }

  /**
   * @param {{ authToken?: string | null }} [options]
   * @returns {Promise<{ ok: boolean, token?: string | null, error?: string }>}
   */
  async enable(options = {}) {
    if (!Notification.isSupported()) {
      return { ok: false, error: "notificationsUnsupported" };
    }

    const authToken =
      (typeof options.authToken === "string" && options.authToken.trim()) ||
      readSession().token ||
      null;
    if (!authToken) {
      return { ok: false, error: "notAuthenticated" };
    }

    this.#authToken = authToken;
    const deviceId = this.ensureDeviceId();
    this.#loadSeen();

    if (!this.#timer) {
      this.#baselineReady = false;
      await this.#pollOnce({ establishBaseline: true });
      this.#timer = setInterval(() => {
        void this.#pollOnce({ establishBaseline: false });
      }, POLL_INTERVAL_MS);
      if (typeof this.#timer.unref === "function") this.#timer.unref();
    }

    this.onToken?.(deviceId);
    return { ok: true, token: deviceId };
  }

  /**
   * @param {{ clearCredentials?: boolean }} [options]
   */
  async disable(options = {}) {
    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
    this.#authToken = null;
    this.#pollInFlight = false;
    this.#baselineReady = false;

    if (options.clearCredentials === true) {
      const paths = storagePaths();
      try {
        if (fs.existsSync(paths.seen)) fs.unlinkSync(paths.seen);
        if (fs.existsSync(paths.deviceId)) fs.unlinkSync(paths.deviceId);
      } catch {
        // ignore
      }
      this.#deviceId = null;
      this.#seenIds.clear();
    }
  }

  /** Refresh bearer token while push stays enabled (e.g. after re-login). */
  setAuthToken(token) {
    this.#authToken = typeof token === "string" && token.trim() ? token.trim() : null;
  }

  #loadSeen() {
    const raw = readJsonFile(storagePaths().seen);
    const ids = Array.isArray(raw?.ids) ? raw.ids.filter((id) => typeof id === "string") : [];
    this.#seenIds = new Set(ids.slice(-200));
  }

  #persistSeen() {
    writeJsonFile(storagePaths().seen, { ids: [...this.#seenIds].slice(-200) });
  }

  /**
   * @param {{ establishBaseline: boolean }} options
   */
  async #pollOnce(options) {
    if (this.#pollInFlight) return;
    const token = this.#authToken || readSession().token;
    if (!token) return;

    this.#pollInFlight = true;
    try {
      const response = await fetch(`${API_BASE}/api/user/notifications?limit=20`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "X-Elizon-Client": "desktop",
          "X-Elizon-Platform": process.platform,
        },
      });
      if (!response.ok) return;

      const body = await response.json().catch(() => null);
      const rows = Array.isArray(body?.notifications) ? body.notifications : [];

      if (options.establishBaseline || !this.#baselineReady) {
        for (const row of rows) {
          if (typeof row?.id === "string") this.#seenIds.add(row.id);
        }
        this.#persistSeen();
        this.#baselineReady = true;
        return;
      }

      // Newest first from API — process oldest-first for toast order
      const fresh = [...rows]
        .filter((row) => typeof row?.id === "string" && !this.#seenIds.has(row.id) && row.isRead !== true)
        .reverse();

      for (const row of fresh) {
        this.#seenIds.add(row.id);
        const serviceId = extractServiceIdFromLink(row.link);
        /** @type {DesktopPushPayload} */
        const payload = {
          title: typeof row.title === "string" ? row.title : "elizon",
          body: typeof row.preview === "string" ? row.preview : "",
          tag: row.id,
          notificationId: row.id,
          serviceId,
          data: {
            notificationId: row.id,
            type: row.type,
            link: row.link,
            ...(serviceId ? { serviceId } : {}),
          },
        };
        this.onNotification?.(payload);
        this.#showOsNotification(payload);
      }

      if (fresh.length) this.#persistSeen();
    } catch (err) {
      console.error("[desktop-push] poll failed", err);
    } finally {
      this.#pollInFlight = false;
    }
  }

  /**
   * @param {DesktopPushPayload} payload
   */
  #showOsNotification(payload) {
    if (!Notification.isSupported()) return;

    const notification = new Notification({
      title: payload.title || "elizon",
      body: payload.body || "",
      silent: false,
    });

    notification.on("click", () => {
      this.onNotificationClick?.(payload);
    });

    notification.show();
  }
}

export const desktopPush = new DesktopPushService();
