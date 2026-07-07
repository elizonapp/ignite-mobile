import { getApiBaseUrl } from "./config";

const DEFAULT_ORIGIN = "https://www.elizon.app";

/** Canonical static assets (logos, fonts, icons) from the elizon website — single source of truth. */
export function getBrandAssetUrl(path: string): string {
  const base = getApiBaseUrl().replace(/\/+$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

export function getDefaultBrandAssetUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${DEFAULT_ORIGIN}${normalized}`;
}

export function getBrandLogoUrl(theme: "dark" | "light"): string {
  return getBrandAssetUrl(`/logo-${theme}.webp`);
}

export function getBrandLogoFallbackUrl(theme: "dark" | "light"): string {
  const current = getApiBaseUrl().replace(/\/+$/, "");
  if (current === DEFAULT_ORIGIN) return getBrandLogoUrl(theme);
  return getDefaultBrandAssetUrl(`/logo-${theme}.webp`);
}
