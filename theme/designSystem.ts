/**
 * Design system foundation: spacing, radius, and typography scales.
 *
 * Every redesigned screen pulls from these instead of inventing pixel
 * values inline. The goal is the same visual discipline top-tier fintech
 * apps (Trust Wallet, Coinbase) have: a small, consistent set of spacing
 * steps, one radius family, and a confident type scale where a few large
 * numbers carry the hierarchy instead of many same-sized labels.
 */

// ── Spacing scale ───────────────────────────────────────────────────────
// 4px base unit. Use these instead of arbitrary margin/padding numbers.
export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
};

// Standard screen-edge horizontal padding. Every screen uses this same
// value so content aligns consistently when navigating between screens.
export const SCREEN_PADDING = 20;

// ── Radius scale ────────────────────────────────────────────────────────
// One family, used consistently: small controls get `sm`, cards get `lg`,
// hero/feature cards get `xl`, fully-rounded pills/avatars get `full`.
export const RADIUS = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  full: 999,
};

// ── Typography scale ────────────────────────────────────────────────────
// Named by role, not by size, so intent stays clear at the call site.
export const TYPE = {
  /** The single biggest number on a screen — a balance, a transfer amount. */
  heroNumber: { fontSize: 40, fontWeight: "700" as const, letterSpacing: -1 },
  /** Section/page titles. */
  title: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.3 },
  /** Card titles, list-item primary text. */
  subtitle: { fontSize: 16, fontWeight: "600" as const },
  /** Standard body text. */
  body: { fontSize: 15, fontWeight: "400" as const },
  /** Secondary/supporting text under a title or value. */
  caption: { fontSize: 13, fontWeight: "500" as const },
  /** Smallest text — timestamps, fine print, badge labels. */
  micro: { fontSize: 11, fontWeight: "600" as const, letterSpacing: 0.3 },
  /** Uppercase section eyebrow labels ("TOTAL BALANCE", "QUICK ACTIONS"). */
  eyebrow: { fontSize: 12, fontWeight: "700" as const, letterSpacing: 0.6 },
};

// ── Elevation ────────────────────────────────────────────────────────────
// Previously a real shadow recipe; now intentionally a no-op. Every card
// across the app reads its edge from GLASS_BORDER's solid border instead —
// matching the notification-center card style (border only, no shadow).
// Left as an object (rather than deleted) so the many `...CARD_SHADOW`
// spreads across the app don't need to be touched individually.
export const CARD_SHADOW = {
  shadowColor: "transparent",
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0,
  shadowRadius: 0,
  elevation: 0,
};

// ── Glass border ─────────────────────────────────────────────────────────
// A solid, visible border for white cards and input fields — matching the
// notification-center card style exactly (border only, no shadow). This
// used to be a near-invisible white-on-white border that depended on
// CARD_SHADOW to read as a card edge at all; now that shadows are gone
// everywhere, the border itself has to do all the work of defining the
// card's boundary, so it needs to actually be visible.
export const GLASS_BORDER = {
  borderWidth: 1,
  borderColor: "#EEF3FA",
};

// Same idea but for elements sitting directly on the page background
// rather than needing the full card shadow (e.g. input fields) — a
// slightly more visible edge since there's no shadow to help define the
// boundary.
export const GLASS_BORDER_SUBTLE = {
  borderWidth: 1,
  borderColor: "rgba(180,195,225,0.35)",
};
