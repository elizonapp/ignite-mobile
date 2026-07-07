import type { AuthUser } from "./types";

/** Kunden-Stealth aktiv: elizon+-UI im Panel ausgeblendet. */
export function hideElizonPlusUi(user: AuthUser | null | undefined): boolean {
  return user?.elizonPlusCustomerUiVisible === false;
}

export function isElizonPlusCustomerUiVisible(user: AuthUser | null | undefined): boolean {
  return user?.elizonPlusCustomerUiVisible !== false;
}

/** elizon+-Features (Storage, vRoute, BYOIP-Inhalt) nur bei aktivem Abo und sichtbarer UI. */
export function showElizonPlusFeatures(user: AuthUser | null | undefined): boolean {
  return Boolean(user?.elizonPlusActive) && isElizonPlusCustomerUiVisible(user);
}

/** Routen, die im Kunden-Stealth komplett ausgeblendet werden (wie Web-Dashboard). */
export const STEALTH_HIDDEN_ROUTES = new Set(["elizon-plus", "byoip"]);

/** Routen, die ein aktives elizon+-Abo und sichtbare UI erfordern. */
export const PLUS_FEATURE_ROUTES = new Set(["storage", "vroute"]);

export type StealthRouteName = "elizon-plus" | "byoip" | "storage" | "vroute";

export function isStealthHiddenRoute(routeName: string): routeName is StealthRouteName {
  return STEALTH_HIDDEN_ROUTES.has(routeName) || PLUS_FEATURE_ROUTES.has(routeName);
}

export function isRouteVisibleInStealth(routeName: string, user: AuthUser | null | undefined): boolean {
  if (hideElizonPlusUi(user) && STEALTH_HIDDEN_ROUTES.has(routeName)) return false;
  if (PLUS_FEATURE_ROUTES.has(routeName) && !showElizonPlusFeatures(user)) return false;
  return true;
}

export function shouldShowTrafficPoolingUi(user: AuthUser | null | undefined): boolean {
  return isElizonPlusCustomerUiVisible(user);
}
