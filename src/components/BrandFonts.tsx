import { useEffect } from "react";

import { getBrandAssetUrl } from "../lib/brand-assets";

const STYLE_ID = "elizon-brand-fonts";

function buildFontFaceCss(baseUrl: string): string {
  const font = (file: string) => `${baseUrl}/fonts/${file}`;
  return `
@font-face {
  font-family: "ubuntu-font";
  src: url("${font("Ubuntu-Regular.ttf")}") format("truetype");
  font-display: swap;
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: "noto-sans-font";
  src: url("${font("NotoSans-Regular.ttf")}") format("truetype");
  font-display: swap;
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: "ubuntu-sans-mono-font";
  src: url("${font("UbuntuSansMono-Regular.ttf")}") format("truetype");
  font-display: swap;
  font-weight: 400;
  font-style: normal;
}
`.trim();
}

/** Loads brand fonts from the configured elizon website origin (same paths as the web app). */
export function BrandFonts() {
  useEffect(() => {
    const baseUrl = getBrandAssetUrl("");
    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = buildFontFaceCss(baseUrl);
    document.documentElement.classList.add("fonts-loaded");

    const onBaseChange = () => {
      style!.textContent = buildFontFaceCss(getBrandAssetUrl(""));
    };
    window.addEventListener("elizon:api-base-changed", onBaseChange);

    return () => {
      window.removeEventListener("elizon:api-base-changed", onBaseChange);
      document.documentElement.classList.remove("fonts-loaded");
    };
  }, []);

  return null;
}
