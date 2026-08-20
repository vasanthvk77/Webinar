import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, List, ListItemButton, ListItemText,
  Typography,
} from '@mui/material';
import studentTabs from '../../config/studentTabs';
import { colors }  from '../../utils/theme';
import logo        from '../../assets/logo1.png';

const SIDEBAR_WIDTH = 240;

// Amber bubble constants — same as AdminSidebar
const BUBBLE_ACTIVE_BG     = '#FEF3C7';
const BUBBLE_ACTIVE_ICON   = '#D97706';
const BUBBLE_ACTIVE_SHADOW = '0 6px 16px rgba(217,119,6,0.35)';

export default function StudentSidebar() {
  const navigate     = useNavigate();
  const { pathname } = useLocation();

  const isActive = (route) => {
    if (route === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(route);
  };

  // ── Row sx — same pattern as AdminSidebar ─────────────
  const rowSx = (active) => ({
    borderRadius: 2,
    mb: 0.5,
    px: 1,
    py: 0.75,
    bgcolor: 'transparent',
    color:   active ? colors.primary : colors.textSecondary,
    transition: 'color 0.2s ease, transform 0.15s ease',

    // Click: snap right then spring back
    '&:active': {
      transform: 'translateX(6px)',
      transition: 'transform 0.08s ease',
    },

    // Hover: row shifts right, label slides, bubble pops
    '&:hover': {
      bgcolor:   'transparent',
      color:     colors.primary,
      transform: 'translateX(3px)',
      '& .MuiListItemText-primary': {
        transform:  'translateX(2px)',
        transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
      },
      '& .icon-bubble': {
        transform:  'scale(1.15)',
        bgcolor:    BUBBLE_ACTIVE_BG,
        boxShadow:  active ? BUBBLE_ACTIVE_SHADOW : '0 4px 12px rgba(217,119,6,0.2)',
        '& .MuiSvgIcon-root': { color: BUBBLE_ACTIVE_ICON },
      },
    },
  });

  // ── Bubble sx — spring bounce ─────────────────────────
  const bubbleSx = (active) => ({
    width: 32, height: 32,
    borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    mr: 1.25,
    transition: 'all 0.4s cubic-bezier(0.34,1.56,0.64,1)',
    bgcolor:   active ? BUBBLE_ACTIVE_BG : 'transparent',
    boxShadow: active ? '0 2px 8px rgba(217,119,6,0.18)' : 'none',
    '& .MuiSvgIcon-root': {
      transition: 'color 0.25s ease',
      color: active ? BUBBLE_ACTIVE_ICON : colors.primaryMuted,
    },
  });

  return (
    <Box
      sx={{
        width: SIDEBAR_WIDTH,
        height: '100vh',
        bgcolor: colors.surface,
        borderRight: `1px solid ${colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0, left: 0,
        zIndex: 100,
        boxShadow: '2px 0 8px rgba(0,0,0,0.04)',
      }}
    >
      {/* ── Header — same amber "W" logo as AdminSidebar ── */}
      <Box
        sx={{
          flexShrink: 0,
          px: 2.5, py: 2,
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 64,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <img src={logo} alt="Weblearn" style={{ height:55, objectFit: 'contain' }} />
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '15px', color: colors.primary, lineHeight: 1.1, letterSpacing: '-0.2px' }}>
              Weblearn
            </Typography>
            <Typography sx={{ fontSize: '10px', fontWeight: 500, color: colors.textMuted, letterSpacing: '0.3px' }}>
              Webinar Portal
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ── Nav items — scrollable ── */}
      <List
        sx={{
          px: 1, py: 1, flexGrow: 1,
          overflowY: 'auto', overflowX: 'hidden',
          '&::-webkit-scrollbar':             { width: 3 },
          '&::-webkit-scrollbar-track':       { background: 'transparent' },
          '&::-webkit-scrollbar-thumb':       { background: colors.border, borderRadius: 4 },
          '&::-webkit-scrollbar-thumb:hover': { background: colors.borderMid },
        }}
      >
        {studentTabs.map(({ label, route, icon: Icon }) => {
          const active = isActive(route);
          return (
            <ListItemButton
              key={route}
              onClick={() => navigate(route)}
              sx={rowSx(active)}
            >
              {/* Icon bubble */}
              <Box className="icon-bubble" sx={bubbleSx(active)}>
                <Icon sx={{ fontSize: 18 }} />
              </Box>

              <ListItemText
                primary={label}
                primaryTypographyProps={{
                  fontSize: '13.5px',
                  fontWeight: active ? 700 : 500,
                  color: 'inherit',
                  noWrap: true,
                  sx: { transition: 'transform 0.3s ease' },
                }}
              />
            </ListItemButton>
          );
        })}
      </List>

      {/* ── Bottom promo card ── */}
      <Box
        sx={{
          flexShrink: 0, m: 2, p: 2, borderRadius: 2,
          bgcolor: colors.primary,
          color: colors.textOnDark,
          textAlign: 'center',
        }}
      >
        <Typography sx={{ fontSize: '12px', fontWeight: 700, mb: 0.5 }}>
          Keep Learning,
        </Typography>
        <Typography sx={{ fontSize: '12px', fontWeight: 700, mb: 1.5, color: colors.highlight }}>
          Keep Growing!
        </Typography>
        <Typography sx={{ fontSize: '11px', opacity: 0.8, mb: 1.5, lineHeight: 1.4 }}>
          Join live sessions, gain knowledge and earn certificates.
        </Typography>
        <Box
          onClick={() => navigate('/dashboard/upcoming')}
          sx={{
            bgcolor: colors.accent,
            color:   colors.textOnAccent,
            fontSize: '11px', fontWeight: 700,
            py: 0.75, borderRadius: 1.5, cursor: 'pointer',
            '&:hover': { bgcolor: colors.accentDark },
            transition: 'background 0.15s',
          }}
        >
          Explore Webinars
        </Box>
      </Box>

      {/* ── Footer tagline ── */}
      <Box sx={{ flexShrink: 0, px: 2.5, py: 1.5, borderTop: `1px solid ${colors.border}` }}>
        <Typography sx={{ fontSize: '11px', fontWeight: 600, color: colors.accent, textAlign: 'center' }}>
          CONNECT · LEARN · GROW
        </Typography>
      </Box>
    </Box>
  );
}
