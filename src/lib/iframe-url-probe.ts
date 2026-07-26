import { isElizonAppUrl } from "./app-url-router";

const ELIZON_URL_RE = /https?:\/\/(?:www\.)?elizon\.app[^\s"'<>)\\|]*/gi;

function cleanUrlCandidate(raw: string): string {
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[.,;:)\]}>]+$/g, "");
}

/** Pull the first elizon.app URL out of arbitrary text / HTML. */
export function extractElizonUrlFromText(text: string): string | null {
  if (!text) return null;
  const matches = text.match(ELIZON_URL_RE);
  if (!matches?.length) return null;
  for (const match of matches) {
    const cleaned = cleanUrlCandidate(match);
    if (isElizonAppUrl(cleaned)) return cleaned;
  }
  return null;
}

export function iframeLooksBlocked(iframe: HTMLIFrameElement | null): boolean {
  if (!iframe) return false;
  try {
    const doc = iframe.contentDocument;
    const text = `${doc?.title ?? ""}\n${doc?.body?.innerText ?? ""}`;
    return (
      /webpage not available/i.test(text) ||
      /ERR_BLOCKED_BY_RESPONSE/i.test(text) ||
      /refused to connect/i.test(text) ||
      /X-Frame-Options/i.test(text)
    );
  } catch {
    return false;
  }
}

/**
 * Best-effort: discover which elizon URL an iframe navigated to.
 * After X-Frame-Options / ERR_BLOCKED_BY_RESPONSE, `iframe.src` often still
 * points at the previous (third-party) URL while the error document body
 * contains the blocked elizon URL — so we scrape the document too.
 */
export function probeIframeForElizonUrl(iframe: HTMLIFrameElement | null): string | null {
  if (!iframe) return null;

  if (iframe.src && isElizonAppUrl(iframe.src)) {
    return iframe.src;
  }

  try {
    const href = iframe.contentWindow?.location?.href;
    if (href && isElizonAppUrl(href)) return href;
  } catch {
    // cross-origin
  }

  try {
    const doc = iframe.contentDocument;
    if (doc) {
      const fromHtml = extractElizonUrlFromText(doc.documentElement?.outerHTML ?? "");
      if (fromHtml) return fromHtml;
      const fromText = extractElizonUrlFromText(doc.body?.innerText ?? "");
      if (fromText) return fromText;
    }
  } catch {
    // cross-origin or opaque error page
  }

  return null;
}
