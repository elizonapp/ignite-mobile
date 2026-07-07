export type SupportResponseDisplayKind = "median" | "avg";

/**
 * Für Marketing-Kacheln: niedrigere Kennzahl wählen, wenn Median und Mittelwert
 * beide vorliegen; sonst die verfügbare.
 */
export function pickSupportResponseForDisplay(options: {
  avgFirstResponseMinutes: number | null | undefined;
  medianFirstResponseMinutes: number | null | undefined;
}): { minutes: number; kind: SupportResponseDisplayKind } | null {
  const rawAvg = options.avgFirstResponseMinutes;
  const rawMedian = options.medianFirstResponseMinutes;

  const avg =
    typeof rawAvg === "number" && Number.isFinite(rawAvg) && rawAvg > 0 ? rawAvg : null;
  const median =
    typeof rawMedian === "number" && Number.isFinite(rawMedian) && rawMedian > 0
      ? rawMedian
      : null;

  if (median === null && avg === null) return null;
  if (median === null) return { minutes: avg as number, kind: "avg" };
  if (avg === null) return { minutes: median, kind: "median" };
  if (median < avg) return { minutes: median, kind: "median" };
  if (avg < median) return { minutes: avg, kind: "avg" };
  return { minutes: avg, kind: "avg" };
}
