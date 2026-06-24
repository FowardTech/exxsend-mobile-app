/**
 * Locale-safe numeric parsing helpers.
 *
 * Why: some backend/provider fields occasionally come back as formatted strings
 * (e.g. "1,234.56" or "1.234,56" or "$1,234.56"). Using Number() or
 * parseFloat() directly can yield NaN or truncated values, which then causes
 * stale cache fallbacks and wrong balances shown in the UI.
 */

export function parseLocalizedNumber(value: unknown, fallback: number = NaN): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;

  const raw = String(value).trim();
  if (!raw) return fallback;

  // Remove currency symbols and whitespace
  let s = raw.replace(/[¤$\u20AC£¥\s]/g, "");

  // If both comma and dot exist, decide which is decimal by the last occurrence.
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  const commaIsDecimal = lastComma > lastDot;

  if (commaIsDecimal) {
    // "1.234,56" -> "1234.56"
    s = s.replace(/\./g, "");
    s = s.replace(/,/g, ".");
  } else {
    // "1,234.56" -> "1234.56"
    s = s.replace(/,/g, "");
  }

  const parsed = parseFloat(s);
  return Number.isFinite(parsed) ? parsed : fallback;
}
