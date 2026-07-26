import { isMobileNative } from "./platform";

export type CameraPermissionState = "granted" | "denied" | "unsupported" | "prompt";

/**
 * Request camera access for KYC (manual capture + Enjyn® third-party flow).
 * Triggers the OS permission dialog on native when NSCameraUsageDescription /
 * Android CAMERA are declared.
 */
export async function ensureCameraPermission(): Promise<CameraPermissionState> {
  if (!isMobileNative()) {
    // Browser / desktop: OS or browser prompt happens on first getUserMedia/capture.
    return "granted";
  }

  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return "unsupported";
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    for (const track of stream.getTracks()) {
      track.stop();
    }
    return "granted";
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "";
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "unsupported";
    }
    if (
      name === "NotAllowedError" ||
      name === "PermissionDeniedError" ||
      name === "SecurityError"
    ) {
      return "denied";
    }
    return "denied";
  }
}
