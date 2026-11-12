import { createTheme } from '@mui/material';

// ================================================================
// GLOBAL COLOR PALETTES
// Two complete palettes — light and dark.
// Import `useThemeColors` from ThemeContext in components,
// or import these raw objects for theme building only.
// ================================================================

export const lightColors = {
  // ── Brand / Core ───────────────────────────────────────────────
  primary:   '#1E293B',   // Deep Navy
  accent:    '#EAB308',   // Amber
  highlight: '#FEF08A',   // Soft Canary
  bg:        '#F8FAFC',   // Off-White page background

  // ── Derived shades ─────────────────────────────────────────────
  primaryLight:   '#334155',
  primaryLighter: '#475569',
  primaryMuted:   '#64748B',
  primaryBorder:  'rgba(30,41,59,0.12)',

  accentDark:  '#CA8A04',
  accentLight: '#FDE68A',
  accentMuted: 'rgba(234,179,8,0.15)',

  highlightBorder: 'rgba(254,240,138,0.6)',

  // ── Surface / UI ────────────────────────────────────────────────
  surface:    '#FFFFFF',
  surfaceAlt: '#F1F5F9',
  panelHeader: '#1E293B',
  panelHeaderText: '#F8FAFC',
  border:     '#E2E8F0',
  borderMid:  '#CBD5E1',

  // ── Text ────────────────────────────────────────────────────────
  textPrimary:   '#1E293B',
  textSecondary: '#475569',
  textMuted:     '#94A3B8',
  textOnDark:    '#F8FAFC',
  textOnAccent:  '#1E293B',

  // ── Status ──────────────────────────────────────────────────────
  success: '#22C55E',
  warning: '#F59E0B',
  error:   '#EF4444',
  info:    '#3B82F6',

  // ── Sidebar aliases ─────────────────────────────────────────────
  sidebarBg:           '#FFFFFF',
  sidebarBorder:       '#E2E8F0',
  sidebarText:         '#475569',
  sidebarTextActive:   '#EAB308',
  sidebarIconActive:   '#EAB308',
  sidebarIconIdle:     '#64748B',
  sidebarActiveBg:     'rgba(234,179,8,0.12)',
  sidebarActiveBorder: '#EAB308',
  sidebarHoverBg:      'rgba(234,179,8,0.08)',
  sidebarGroupLabel:   '#94A3B8',
  sidebarScrollThumb:  '#E2E8F0',
  sidebarFooterText:   '#EAB308',

  // ── Login / Auth pages ──────────────────────────────────────────
  loginBg:         '#F8FAFC',
  loginCard:       '#FFFFFF',
  loginCardBorder: '#E2E8F0',
  loginInput:      '#F1F5F9',
  loginInputBorder:'#E2E8F0',

  // ── Misc ────────────────────────────────────────────────────────
  scrollThumb:    '#E2E8F0',
  scrollThumbHov: '#CBD5E1',
  shadowSm:       'rgba(0,0,0,0.06)',
  shadowMd:       'rgba(0,0,0,0.12)',

  // ── Profile / Aura Banner (Matches App Brand Theme) ──────────────
  bannerBg:        'radial-gradient(ellipse at 85% 20%, rgba(234, 179, 8, 0.22) 0%, rgba(104, 105, 255, 0.18) 38%, rgba(30, 41, 59, 0.04) 75%, transparent 100%), linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 50%, #FEF9C3 100%)',
  bannerSparkle:   '#EAB308',
  bannerBadgeText: '#1E293B',
  bannerBorder:    'rgba(234, 179, 8, 0.25)',
};

export const darkColors = {
  // ── Brand / Core ───────────────────────────────────────────────
  primary:   '#F1F5F9',   // Near-white text
  accent:    '#EAB308',   // Amber
  highlight: '#78350F',   // Dark amber highlight
  bg:        '#0E1017',   // Deep rich charcoal-black background (from reference)

  // ── Derived shades ─────────────────────────────────────────────
  primaryLight:   '#CBD5E1',
  primaryLighter: '#94A3B8',
  primaryMuted:   '#475569',
  primaryBorder:  'rgba(241,245,249,0.06)',

  accentDark:  '#CA8A04',
  accentLight: '#451A03',
  accentMuted: 'rgba(234,179,8,0.12)',

  highlightBorder: 'rgba(120,53,15,0.3)',

  // ── Surface / UI ────────────────────────────────────────────────
  surface:    '#161822',   // Slate-blue card background (distinct from bg)
  surfaceAlt: '#1E2230',   // Alternate surface (inputs, search bar background)
  panelHeader: '#25293C',  // Panel header background, never use text colors here
  panelHeaderText: '#F1F5F9',
  border:     '#25293C',   // Subtle slate-blue border (very thin & clean)
  borderMid:  '#2D324A',   // Slightly more defined border

  // ── Text ────────────────────────────────────────────────────────
  textPrimary:   '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted:     '#64748B',
  textOnDark:    '#F8FAFC',
  textOnAccent:  '#0E1017',

  // ── Status ──────────────────────────────────────────────────────
  success: '#4ADE80',
  warning: '#FBBF24',
  error:   '#F87171',
  info:    '#60A5FA',

  // ── Sidebar aliases ─────────────────────────────────────────────
  sidebarBg:           '#0E1017',   // Very dark sidebar matching page bg
  sidebarBorder:       '#1E2230',   // Dark border separating sidebar
  sidebarText:         '#94A3B8',
  sidebarTextActive:   '#EAB308',
  sidebarIconActive:   '#EAB308',
  sidebarIconIdle:     '#475569',
  sidebarActiveBg:     'rgba(234,179,8,0.08)',
  sidebarActiveBorder: '#EAB308',
  sidebarHoverBg:      'rgba(234,179,8,0.04)',
  sidebarGroupLabel:   '#475569',
  sidebarScrollThumb:  '#1E2230',
  sidebarFooterText:   '#EAB308',

  // ── Login / Auth pages ──────────────────────────────────────────
  loginBg:         '#0E1017',
  loginCard:       '#161822',
  loginCardBorder: '#25293C',
  loginInput:      '#1E2230',
  loginInputBorder:'#25293C',

  // ── Misc ────────────────────────────────────────────────────────
  scrollThumb:    '#1E2230',
  scrollThumbHov: '#2D324A',
  shadowSm:       'rgba(0,0,0,0.3)',
  shadowMd:       'rgba(0,0,0,0.5)',

  // ── Profile / Aura Banner (Matches App Brand Theme) ──────────────
  bannerBg:        'radial-gradient(ellipse at 85% 15%, rgba(234, 179, 8, 0.22) 0%, rgba(104, 105, 255, 0.26) 42%, rgba(14, 16, 23, 0.95) 100%), linear-gradient(135deg, #0E1017 0%, #161822 55%, #1E2230 100%)',
  bannerSparkle:   '#EAB308',
  bannerBadgeText: '#F1F5F9',
  bannerBorder:    'rgba(234, 179, 8, 0.2)',
};

// Global Aura Banner Theme Preset
export const BANNER_THEME = {
  light: {
    bg: lightColors.bannerBg,
    sparkle: lightColors.bannerSparkle,
    badgeText: lightColors.bannerBadgeText,
    border: lightColors.bannerBorder,
  },
  dark: {
    bg: darkColors.bannerBg,
    sparkle: darkColors.bannerSparkle,
    badgeText: darkColors.bannerBadgeText,
    border: darkColors.bannerBorder,
  },
};

// ================================================================
// MUI THEME FACTORY
// Call buildMuiTheme('light') or buildMuiTheme('dark') to get the
// correct MUI theme object for the ThemeProvider.
// ================================================================
export function buildMuiTheme(mode = 'light') {
  const c = mode === 'dark' ? darkColors : lightColors;

  return createTheme({
    palette: {
      mode,
      primary: {
        main:         c.primary,
        light:        c.primaryLight,
        dark:         mode === 'dark' ? '#0F172A' : '#0F172A',
        contrastText: c.textOnDark,
      },
      secondary: {
        main:         c.accent,
        light:        c.accentLight,
        dark:         c.accentDark,
        contrastText: c.textOnAccent,
      },
      background: {
        default: c.bg,
        paper:   c.surface,
      },
      text: {
        primary:   c.textPrimary,
        secondary: c.textSecondary,
        disabled:  c.textMuted,
      },
      success: { main: c.success },
      warning: { main: c.warning },
      error:   { main: c.error },
      info:    { main: c.info },
      divider: c.border,
    },

    typography: {
      fontFamily: '"Google Sans", "Product Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      allVariants: { color: c.textPrimary },
    },

    shape: { borderRadius: 8 },

    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 8,
          },
          containedPrimary: {
            backgroundColor: c.primary,
            color: c.textOnDark,
            '&:hover': { backgroundColor: c.primaryLight },
          },
          containedSecondary: {
            backgroundColor: c.accent,
            color: c.textOnAccent,
            '&:hover': { backgroundColor: c.accentDark },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: c.surface,
            color: c.textPrimary,
            borderBottom: `1px solid ${c.border}`,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            border: `1px solid ${c.border}`,
            boxShadow: `0 1px 4px ${c.shadowSm}`,
            backgroundColor: c.surface,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundColor: c.surface,
            backgroundImage: 'none',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600, fontSize: '11px' },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            backgroundColor: c.surfaceAlt,
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: c.primaryMuted,
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: c.accent,
            },
          },
          notchedOutline: {
            borderColor: c.border,
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            color: c.textPrimary,
            '&:hover': { backgroundColor: c.surfaceAlt },
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: { borderColor: c.border },
        },
      },
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: c.bg,
            color: c.textPrimary,
            transition: 'background-color 0.3s ease, color 0.3s ease',
          },
          '*, *::before, *::after': {
            transition: 'background-color 0.3s ease, border-color 0.3s ease, color 0.15s ease',
          },
        },
      },
    },
  });
}

// ── Centralized Dashboard Chart Pillars Palette (Super Admin, Admin, Student) ──
export const CHART_PILLARS = {
  // Pillar 1: Total Registration / Scheduled Time (Gold / Amber)
  primary: {
    main: '#F59E0B',
    dark: '#D97706',
    gradient: 'linear-gradient(180deg, #F59E0B 0%, #D97706 100%)',
    emptyGradient: 'repeating-linear-gradient(135deg, #FEF3C7 0 4px, #fffbeb 4px 8px)',
    shadow: '0 8px 18px -8px rgba(245, 158, 11, 0.7)',
    pillBg: '#FEF3C7',
    pillText: '#B45309',
  },
  // Pillar 2: Completed Webinar / Attended Time (#6869ff - Royal Indigo)
  secondary: {
    main: '#6869ff',
    dark: '#4f46e5',
    gradient: 'linear-gradient(180deg, #6869ff 0%, #4f46e5 100%)',
    emptyGradient: 'repeating-linear-gradient(135deg, #EEF2FF 0 4px, #F5F7FF 4px 8px)',
    shadow: '0 8px 18px -8px rgba(104, 105, 255, 0.65)',
    pillBg: '#EEF2FF',
    pillText: '#4338CA',
    pillBorder: 'rgba(104, 105, 255, 0.25)',
  },
  referenceLine: '#EAB308',
};

// ── Legacy default export (for any leftover static imports) ──────
// Will be replaced by the dynamic theme from ThemeContext.
export const colors = lightColors;
export default buildMuiTheme('light');
