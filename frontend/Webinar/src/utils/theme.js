import { createTheme } from '@mui/material';

// ================================================================
// GLOBAL COLOR PALETTE
// Single source of truth — import `colors` into any component
// instead of hardcoding hex values.
// ================================================================
export const colors = {
  // ── Brand / Core ───────────────────────────────────────────────
  primary:   '#1E293B',   // Deep Navy    — text, navbars, main headers
  accent:    '#EAB308',   // Amber Orange — CTA buttons, active states
  highlight: '#FEF08A',   // Soft Canary  — card backgrounds, text highlights
  bg:        '#F8FAFC',   // Off-White    — page background

  // ── Derived shades (computed from core palette) ─────────────────
  primaryLight:  '#334155',   // lighter navy  — hover states, secondary text
  primaryLighter:'#475569',   // even lighter  — placeholder text, icons
  primaryMuted:  '#64748B',   // muted navy    — disabled, borders
  primaryBorder: 'rgba(30,41,59,0.12)', // subtle border on light backgrounds

  accentDark:    '#CA8A04',   // darker amber  — button hover
  accentLight:   '#FDE68A',   // pale amber    — badge backgrounds
  accentMuted:   'rgba(234,179,8,0.15)', // translucent amber — active tab bg

  highlightBorder: 'rgba(254,240,138,0.6)', // subtle canary border

  // ── Surface / UI ────────────────────────────────────────────────
  surface:      '#FFFFFF',          // card / paper background
  surfaceAlt:   '#F1F5F9',          // slightly darker bg (dividers, inputs)
  border:       '#E2E8F0',          // light separator lines
  borderMid:    '#CBD5E1',          // medium separator

  // ── Text ────────────────────────────────────────────────────────
  textPrimary:   '#1E293B',   // same as primary — main body text
  textSecondary: '#475569',   // secondary body text
  textMuted:     '#94A3B8',   // placeholders, captions
  textOnDark:    '#F8FAFC',   // text on dark (navy) backgrounds
  textOnAccent:  '#1E293B',   // text on amber buttons

  // ── Status ──────────────────────────────────────────────────────
  success:  '#22C55E',
  warning:  '#F59E0B',
  error:    '#EF4444',
  info:     '#3B82F6',

  // ── Sidebar (uses same surface/border/accent as the rest of the app) ──
  // No special dark tokens — sidebar bg = colors.surface (white)
  // Active tab bg = colors.accentMuted, border = colors.accent
  // These aliases kept for any legacy references during migration:
  sidebarBg:          '#FFFFFF',          // same as surface
  sidebarBorder:      '#E2E8F0',          // same as border
  sidebarText:        '#475569',          // same as textSecondary
  sidebarTextActive:  '#EAB308',          // same as accent
  sidebarIconActive:  '#EAB308',          // same as accent
  sidebarIconIdle:    '#64748B',          // same as primaryMuted
  sidebarActiveBg:    'rgba(234,179,8,0.12)',
  sidebarActiveBorder:'#EAB308',
  sidebarHoverBg:     'rgba(234,179,8,0.08)',
  sidebarGroupLabel:  '#94A3B8',          // same as textMuted
  sidebarScrollThumb: '#E2E8F0',          // same as border
  sidebarFooterText:  '#EAB308',          // accent
};

// ================================================================
// MUI THEME
// Plugs the palette into MUI so MUI components automatically
// use the brand colors (Button primary, etc.).
// ================================================================
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main:         colors.primary,
      light:        colors.primaryLight,
      dark:         '#0F172A',
      contrastText: colors.textOnDark,
    },
    secondary: {
      main:         colors.accent,
      light:        colors.accentLight,
      dark:         colors.accentDark,
      contrastText: colors.textOnAccent,
    },
    background: {
      default: colors.bg,
      paper:   colors.surface,
    },
    text: {
      primary:   colors.textPrimary,
      secondary: colors.textSecondary,
      disabled:  colors.textMuted,
    },
    success: { main: colors.success },
    warning: { main: colors.warning },
    error:   { main: colors.error },
    info:    { main: colors.info },
    divider: colors.border,
  },

  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
    allVariants: { color: colors.textPrimary },
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
          backgroundColor: colors.primary,
          color: colors.textOnDark,
          '&:hover': { backgroundColor: colors.primaryLight },
        },
        containedSecondary: {
          backgroundColor: colors.accent,
          color: colors.textOnAccent,
          '&:hover': { backgroundColor: colors.accentDark },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: colors.surface,
          color: colors.textPrimary,
          borderBottom: `1px solid ${colors.border}`,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: `1px solid ${colors.border}`,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
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
          backgroundColor: colors.surfaceAlt,
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: colors.primaryMuted,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: colors.accent,
          },
        },
        notchedOutline: {
          borderColor: colors.border,
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: colors.bg,
          color: colors.textPrimary,
        },
      },
    },
  },
});

export default theme;
