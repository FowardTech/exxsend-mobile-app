/**
 * Unified typography scale – used everywhere for consistency.
 * Matches the reference: tight, clean, modern fintech.
 */
import { COLORS } from "./colors";

export const T = {
  // Labels & captions
  xs:   { fontSize: 11, fontWeight: "500" as const, color: COLORS.muted },
  sm:   { fontSize: 12, fontWeight: "500" as const, color: COLORS.muted },
  smBold:{ fontSize: 12, fontWeight: "700" as const, color: COLORS.text },

  // Body
  body: { fontSize: 13, fontWeight: "400" as const, color: COLORS.textSecondary, lineHeight: 20 },
  bodyMed:{ fontSize: 13, fontWeight: "600" as const, color: COLORS.text },
  bodyBold:{ fontSize: 13, fontWeight: "700" as const, color: COLORS.text },

  // UI Labels
  label: { fontSize: 14, fontWeight: "600" as const, color: COLORS.text },
  labelBold:{ fontSize: 14, fontWeight: "700" as const, color: COLORS.text },

  // Titles
  title:    { fontSize: 16, fontWeight: "700" as const, color: COLORS.text },
  titleLg:  { fontSize: 18, fontWeight: "700" as const, color: COLORS.text },
  titleXl:  { fontSize: 22, fontWeight: "700" as const, color: COLORS.text },

  // Numerics
  balance:  { fontSize: 28, fontWeight: "700" as const, color: COLORS.text, letterSpacing: -0.5 },
  balanceLg:{ fontSize: 34, fontWeight: "700" as const, color: COLORS.text, letterSpacing: -1 },

  // Links
  link:  { fontSize: 13, fontWeight: "600" as const, color: COLORS.primary },
  linkSm:{ fontSize: 12, fontWeight: "600" as const, color: COLORS.primary },
};
