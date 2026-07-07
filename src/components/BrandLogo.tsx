import {
  getBrandLogoFallbackUrl,
  getBrandLogoUrl,
} from "../lib/brand-assets";
import { cn } from "../lib/utils";

type BrandLogoProps = {
  width: number;
  height: number;
  alt?: string;
  className?: string;
  priority?: boolean;
};

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

function applyOriginFallback(
  event: React.SyntheticEvent<HTMLImageElement>,
  theme: "dark" | "light",
) {
  const img = event.currentTarget;
  if (img.dataset.fallbackApplied === "true") return;
  img.dataset.fallbackApplied = "true";
  img.src = getBrandLogoFallbackUrl(theme);
}

export function BrandLogo({
  width,
  height,
  alt = "elizon",
  className,
  priority = false,
}: BrandLogoProps) {
  const sharedProps = {
    alt,
    width,
    height,
    decoding: "async" as const,
    ...(priority ? { fetchPriority: "high" as const } : {}),
    style: { width, height: "auto", maxHeight: height },
  };

  return (
    <>
      <img
        {...sharedProps}
        src={getBrandLogoUrl("dark")}
        onError={(event) => applyOriginFallback(event, "dark")}
        className={joinClassNames("theme-logo-dark object-contain", className)}
      />
      <img
        {...sharedProps}
        src={getBrandLogoUrl("light")}
        onError={(event) => applyOriginFallback(event, "light")}
        className={joinClassNames("theme-logo-light object-contain", className)}
      />
    </>
  );
}

export function BrandLogoLink({
  width,
  height,
  alt = "elizon",
  className,
  onClick,
}: BrandLogoProps & { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("inline-flex shrink-0 cursor-pointer items-center border-0 bg-transparent p-0", className)}
      aria-label={alt}
    >
      <BrandLogo width={width} height={height} alt={alt} priority />
    </button>
  );
}
