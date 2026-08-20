import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { lightColors, darkColors, buildMuiTheme } from '../utils/theme';

// ================================================================
// ThemeContext
// Central theme management for the entire application.
//
// Features:
//   - Toggle between 'light' and 'dark' modes
//   - Persists to localStorage so the choice survives page refresh
//   - Provides `colors` object matching the current mode
//   - Provides `muiTheme` to pass into MUI's ThemeProvider
//   - `useThemeColors()` hook — use in ANY component
// ================================================================

const STORAGE_KEY = 'webinar_theme';

const ThemeContext = createContext(null);

// ── Read initial mode from localStorage (or default to 'light') ──
function readStoredMode() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch { /* ignore */ }
  return 'light';
}

// ────────────────────────────────────────────────────────────────
export function ThemeContextProvider({ children }) {
  const [mode, setMode] = useState(readStoredMode);

  const toggleTheme = useCallback(() => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const isDark = mode === 'dark';

  // Colors object for the current mode — memoized so references stay stable
  const colors = useMemo(() => (isDark ? darkColors : lightColors), [isDark]);

  // MUI theme — rebuilt only when mode changes
  const muiTheme = useMemo(() => buildMuiTheme(mode), [mode]);

  const value = useMemo(() => ({
    mode,
    isDark,
    colors,
    muiTheme,
    toggleTheme,
  }), [mode, isDark, colors, muiTheme, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ────────────────────────────────────────────────────────────────
// useAppTheme — full context (mode, toggle, muiTheme)
// eslint-disable-next-line react-refresh/only-export-components
export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAppTheme must be used inside <ThemeContextProvider>');
  return ctx;
}

// ────────────────────────────────────────────────────────────────
// useThemeColors — shorthand: just the colors object
// Use this in most components instead of importing lightColors directly.
// eslint-disable-next-line react-refresh/only-export-components
export function useThemeColors() {
  return useAppTheme().colors;
}
