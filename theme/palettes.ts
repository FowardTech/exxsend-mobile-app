/**
 * Theme-aware color tokens.
 *
 * Two full palettes — dark (default) and light — keyed identically so any
 * screen using COLORS.xxx keeps working unchanged; only how COLORS resolves
 * changes based on the active theme. Dark is modeled after Kraken/Trust
 * Wallet: near-black surfaces, high contrast white/gray text, color used only
 * for the brand accent and semantic states — not for soft background tints.
 */

export type ThemeName = "dark" | "light";

export interface ColorTokens {
  primary: string;
  primaryLight: string;
  primaryMid: string;
  primaryDark: string;

  actionBg: string;
  actionBgDark: string;
  actionText: string;

  accent: string;
  accentLight: string;
  accentDark: string;

  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  card: string;

  text: string;
  textSecondary: string;
  muted: string;

  border: string;
  borderLight: string;
  line: string;

  green: string;
  greenSoft: string;
  greenLight: string;
  greenDark: string;

  red: string;
  error: string;
  errorLight: string;

  yellow: string;

  white: string;
  black: string;
  overlay: string;
  gray: string;
}

export const DARK_COLORS: ColorTokens = {
  primary: "#5C7DFE",
  primaryLight: "#1B2440",
  primaryMid: "#7A95FF",
  primaryDark: "#2E45A8",

  actionBg: "#2E45A8",
  actionBgDark: "#253889",
  actionText: "#FFFFFF",

  accent: "#F5A623",
  accentLight: "#241C0C",
  accentDark: "#FFC15E",

  bg: "#0B0E14",
  bgSecondary: "#141821",
  bgTertiary: "#1B202B",
  card: "#161B26",

  text: "#F4F6FA",
  textSecondary: "#A6AEBF",
  muted: "#6B7385",

  border: "#262C3A",
  borderLight: "#1D222E",
  line: "#21262F",

  green: "#1FCF7D",
  greenSoft: "#0F2A1E",
  greenLight: "#4FE3A0",
  greenDark: "#A7F3D0",

  red: "#FF5C5C",
  error: "#FF5C5C",
  errorLight: "#2A1414",

  yellow: "#FFD400",

  white: "#FFFFFF",
  black: "#0B0E14",
  overlay: "rgba(0,0,0,0.65)",
  gray: "#6B7385",
};

export const LIGHT_COLORS: ColorTokens = {
  primary: "#315CFD",
  primaryLight: "#E7ECFF",
  primaryMid: "#5C7DFE",
  primaryDark: "#1E3FBF",

  actionBg: "#1E3FBF",
  actionBgDark: "#18339C",
  actionText: "#FFFFFF",

  accent: "#E08A00",
  accentLight: "#FFF3DC",
  accentDark: "#7A4A00",

  bg: "#F1F3F6",
  bgSecondary: "#FFFFFF",
  bgTertiary: "#ECEFF5",
  card: "#FFFFFF",

  text: "#0B0E14",
  textSecondary: "#4A5163",
  muted: "#8089A0",

  border: "#DCE0EA",
  borderLight: "#E8EAF0",
  line: "#E2E5EC",

  green: "#0E9F62",
  greenSoft: "#E7F8EF",
  greenLight: "#4FE3A0",
  greenDark: "#075C39",

  red: "#E0383E",
  error: "#E0383E",
  errorLight: "#FCE8E8",

  yellow: "#FFD400",

  white: "#FFFFFF",
  black: "#0B0E14",
  overlay: "rgba(11,14,20,0.55)",
  gray: "#8089A0",
};

export const THEMES: Record<ThemeName, ColorTokens> = {
  dark: DARK_COLORS,
  light: LIGHT_COLORS,
};
