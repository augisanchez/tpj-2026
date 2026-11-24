export type Season = "spring" | "summer" | "autumn" | "winter";

/** Meteorological season (northern hemisphere) for the accent color. */
export function currentSeason(date = new Date()): Season {
  const m = date.getUTCMonth(); // 0 = Jan
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "autumn";
  return "winter";
}
