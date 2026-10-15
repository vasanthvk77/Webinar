import { useState } from 'react';
import { Box, InputBase, IconButton } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon  from '@mui/icons-material/Close';
import { useThemeColors } from '../context/ThemeContext';

// ─────────────────────────────────────────────────────────
// CustomSearchBar
// Shared search bar used throughout the application.
//
// Props:
//   value       — controlled value (string)
//   onChange    — (newValue: string) => void
//   placeholder — string (default: "Search…")
//   maxWidth    — number or string (default: '100%')
//   size        — 'sm' | 'md' (default: 'md') — controls height/font
//   sx          — additional MUI sx styles on the outer Box
//
// Design:
//   • Fully bordered box — no underline
//   • Idle: light grey border (colors.border)
//   • Hover: amber border (colors.accent)
//   • Focus-within: amber border + subtle amber glow
//   • Clear (×) button appears when value is non-empty
// ─────────────────────────────────────────────────────────
export default function CustomSearchBar({
  value = '',
  onChange,
  placeholder = 'Search…',
  maxWidth = '100%',
  size = 'md',
  sx = {},
}) {
  const [focused, setFocused] = useState(false);
  const colors = useThemeColors();

  const isSmall   = size === 'sm';
  const fontSize  = isSmall ? '12.5px' : '13.5px';
  const iconSize  = isSmall ? 16 : 18;
  const py        = isSmall ? 0.6 : 0.85;
  const px        = isSmall ? 1.25 : 1.75;

  const borderColor = focused
    ? colors.accent
    : value
      ? colors.accent          // keep amber when there's text
      : colors.border;

  const boxShadow = focused
    ? `0 0 0 3px ${colors.accentMuted}`
    : 'none';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        bgcolor: colors.surfaceAlt,
        border: `1.5px solid ${borderColor}`,
        borderRadius: 2,
        px, py,
        maxWidth,
        width: '100%',
        boxShadow,
        transition: 'border-color 0.18s, box-shadow 0.18s',
        '&:hover': {
          borderColor: colors.accent,
        },
        ...sx,
      }}
    >
      <SearchIcon
        sx={{
          fontSize: iconSize,
          color: focused || value ? colors.accent : colors.textMuted,
          flexShrink: 0,
          transition: 'color 0.18s',
        }}
      />
      <InputBase
        value={value}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        sx={{
          flexGrow: 1,
          fontSize,
          color: colors.textPrimary,
          '& input::placeholder': {
            color: colors.textMuted,
            opacity: 1,
          },
          // Remove any browser default outline
          '& input': { padding: 0 },
        }}
      />
      {value ? (
        <IconButton
          size="small"
          onClick={() => onChange?.('')}
          tabIndex={-1}
          sx={{
            p: 0.25,
            color: colors.textMuted,
            '&:hover': { color: colors.primary, bgcolor: 'transparent' },
          }}
        >
          <CloseIcon sx={{ fontSize: isSmall ? 13 : 15 }} />
        </IconButton>
      ) : null}
    </Box>
  );
}
