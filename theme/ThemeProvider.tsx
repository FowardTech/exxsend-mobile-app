import React, { createContext, useContext, useMemo } from "react";
import { ColorTokens, LIGHT_COLORS } from "./palettes";

// Dark mode has been removed by product decision — the app is light-only.
// This provider/hook still exists so every screen already using useAppTheme()
// keeps working unchanged; it always resolves to the light palette now.
interface ThemeContextValue {
  theme: "light";
  isDark: false;
  colors: ColorTokens;
  ready: true;
}

const VALUE: ThemeContextValue = {
  theme: "light",
  isDark: false,
  colors: LIGHT_COLORS,
  ready: true,
};

const ThemeContext = createContext<ThemeContextValue>(VALUE);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <ThemeContext.Provider value={VALUE}>{children}</ThemeContext.Provider>;
}

/** Returns { theme: "light", isDark: false, colors, ready: true }. Kept as a
 *  hook (rather than a plain import) so every screen already calling
 *  useAppTheme() continues to work unchanged. */
export function useAppTheme() {
  return useContext(ThemeContext);
}


