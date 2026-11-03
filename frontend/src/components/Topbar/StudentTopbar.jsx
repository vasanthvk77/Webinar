import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, AppBar, Toolbar, Typography, IconButton,
  Avatar, Menu, MenuItem, Divider, Badge, Tooltip,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useAuth } from '../../context/AuthContext';
import { useThemeColors, useAppTheme } from '../../context/ThemeContext';
import CustomSearchBar from '../CustomSearchBar';

const SIDEBAR_WIDTH = 240;

export default function StudentTopbar() {
  const { user, logout } = useAuth();
  const colors = useThemeColors();
  const { isDark, toggleTheme } = useAppTheme();
  const navigate = useNavigate();

  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : 'U';

  const fullName = user ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'User';

  const iconButtonSx = {
    width: 40,
    height: 40,
    color: colors.textSecondary,
    border: `1px solid ${colors.border}`,
    bgcolor: isDark ? colors.surfaceAlt : '#FFFFFF',
    borderRadius: '13px',
    transition: 'all 180ms ease',
    '&:hover': {
      color: colors.primary,
      bgcolor: colors.surfaceAlt,
      borderColor: colors.borderMid ?? colors.border,
      transform: 'translateY(-1px)',
    },
  };

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        left: SIDEBAR_WIDTH,
        width: `calc(100% - ${SIDEBAR_WIDTH}px)`,
        bgcolor: colors.surface,
        color: colors.textPrimary,
        borderBottom: `1px solid ${colors.border}`,
        boxShadow: isDark
          ? '0 4px 18px rgba(0,0,0,0.12)'
          : '0 4px 22px rgba(23,35,56,0.035)',
        zIndex: 99,
        transition: 'background-color 180ms ease, border-color 180ms ease',
      }}
    >
      <Toolbar
        sx={{
          px: { xs: 1.5, sm: 2.5, lg: 3 },
          gap: { xs: 1, sm: 1.5 },
          minHeight: '72px !important',
        }}
      >
        {/* Search */}
        <Box
          sx={{
            flex: '1 1 420px',
            minWidth: 0,
            maxWidth: 560,
            '& > *': { width: '100%' },
            '& input': { fontSize: '13px' },
          }}
        >
          <CustomSearchBar
            placeholder="Search webinars, topics, speakers..."
            maxWidth={560}
            sx={{
              width: '100%',
              '& .MuiOutlinedInput-root': {
                minHeight: 42,
                borderRadius: '14px',
                bgcolor: isDark ? colors.surfaceAlt : '#F5F7FB',
                transition: 'all 180ms ease',
                '& fieldset': { borderColor: colors.border },
                '&:hover fieldset': { borderColor: colors.borderMid ?? colors.border },
                '&.Mui-focused': {
                  bgcolor: colors.surface,
                  boxShadow: '0 0 0 3px rgba(242,183,5,0.12)',
                },
                '&.Mui-focused fieldset': { borderColor: colors.accent },
              },
            }}
          />
        </Box>

        <Box sx={{ flexGrow: 1, minWidth: { xs: 0, sm: 12 } }} />

        {/* Notification bell */}
        <Tooltip title="Notifications" arrow>
          <IconButton
            size="small"
            onClick={() => navigate('/dashboard/notifications')}
            aria-label="Open notifications"
            sx={{ ...iconButtonSx, position: 'relative' }}
          >
            <Badge
              badgeContent={3}
              sx={{
                '& .MuiBadge-badge': {
                  bgcolor: colors.error,
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: 700,
                  minWidth: 17,
                  height: 17,
                  border: `2px solid ${colors.surface}`,
                  top: 1,
                  right: 1,
                },
              }}
            >
              <NotificationsIcon sx={{ fontSize: 21 }} />
            </Badge>
          </IconButton>
        </Tooltip>

        {/* Dark / Light mode toggle */}
        <Tooltip title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'} arrow>
          <IconButton
            size="small"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            sx={{
              ...iconButtonSx,
              color: isDark ? colors.accent : colors.textSecondary,
              '&:hover': {
                bgcolor: colors.accentMuted,
                color: colors.accent,
                borderColor: colors.accent,
                transform: 'translateY(-1px)',
              },
            }}
          >
            {isDark
              ? <LightModeIcon sx={{ fontSize: 21 }} />
              : <DarkModeIcon sx={{ fontSize: 21 }} />}
          </IconButton>
        </Tooltip>

        {/* Avatar button */}
        <Box
          onClick={(e) => setAnchorEl(e.currentTarget)}
          aria-haspopup="menu"
          aria-expanded={menuOpen ? 'true' : undefined}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setAnchorEl(e.currentTarget);
            }
          }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.1,
            cursor: 'pointer',
            ml: { xs: 0, sm: 0.5 },
            pl: 0.75,
            pr: { xs: 0.5, sm: 1.1 },
            py: 0.65,
            borderRadius: '15px',
            border: `1px solid ${menuOpen ? (colors.borderMid ?? colors.border) : 'transparent'}`,
            bgcolor: menuOpen ? colors.surfaceAlt : 'transparent',
            transition: 'all 180ms ease',
            '&:hover': { bgcolor: colors.surfaceAlt, borderColor: colors.border },
            '&:focus-visible': {
              outline: `2px solid ${colors.accent}`,
              outlineOffset: 2,
            },
          }}
        >
          <Avatar
            sx={{
              width: 38,
              height: 38,
              bgcolor: isDark ? colors.surfaceAlt : colors.primary,
              color: isDark ? colors.accent : colors.textOnDark,
              fontSize: '13px',
              fontWeight: 800,
              letterSpacing: '0.2px',
              border: isDark ? `1px solid ${colors.border}` : '2px solid rgba(242,183,5,0.28)',
              boxShadow: isDark ? 'none' : '0 3px 8px rgba(23,35,56,0.12)',
            }}
          >
            {initials}
          </Avatar>
          <Box sx={{ display: { xs: 'none', sm: 'block' }, minWidth: 88 }}>
            <Typography
              sx={{
                fontSize: '13px',
                fontWeight: 750,
                color: colors.textPrimary,
                lineHeight: 1.25,
                letterSpacing: '-0.1px',
                whiteSpace: 'nowrap',
              }}
            >
              Hi, {user?.firstName}
            </Typography>
            <Typography sx={{ fontSize: '11px', color: colors.textMuted, lineHeight: 1.35, mt: 0.15 }}>
              Student
            </Typography>
          </Box>
          <KeyboardArrowDownIcon
            sx={{
              display: { xs: 'none', sm: 'block' },
              fontSize: 18,
              color: colors.textMuted,
              transition: 'transform 180ms ease',
              transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </Box>

        {/* Dropdown menu */}
        <Menu
          anchorEl={anchorEl}
          open={menuOpen}
          onClose={() => setAnchorEl(null)}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          PaperProps={{
            sx: {
              mt: 1.2,
              width: 272,
              maxWidth: 'calc(100vw - 24px)',
              overflow: 'hidden',
              borderRadius: '18px 18px 18px 7px',
              boxShadow: isDark
                ? '0 18px 48px rgba(0,0,0,0.32)'
                : '0 18px 48px rgba(23,35,56,0.16)',
              border: `1px solid ${colors.border}`,
              bgcolor: colors.surface,
              backgroundImage: 'none',
              '& .MuiMenu-list': { py: 0.75 },
            },
          }}
        >
          {/* Profile identity */}
          <Box
            sx={{
              px: 2.25,
              py: 2,
              background: isDark
                ? `linear-gradient(135deg, ${colors.surfaceAlt} 0%, ${colors.surface} 100%)`
                : 'linear-gradient(135deg, #F6F8FC 0%, #FFFFFF 100%)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1 }}>
              <Avatar
                sx={{
                  width: 38,
                  height: 38,
                  bgcolor: colors.primary,
                  color: colors.textOnDark,
                  fontSize: '12px',
                  fontWeight: 800,
                  border: '2px solid rgba(242,183,5,0.45)',
                }}
              >
                {initials}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: '13px', fontWeight: 800, color: colors.textPrimary, lineHeight: 1.3 }}>
                  {fullName}
                </Typography>
                <Typography
                  sx={{
                    mt: 0.25,
                    fontSize: '11.5px',
                    color: colors.textMuted,
                    lineHeight: 1.4,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {user?.email}
                </Typography>
              </Box>
            </Box>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                px: 1,
                py: 0.4,
                borderRadius: '7px',
                bgcolor: colors.accentMuted,
                color: colors.primary,
                fontSize: '10px',
                fontWeight: 800,
                letterSpacing: '0.55px',
                textTransform: 'uppercase',
              }}
            >
              Student account
            </Box>
          </Box>

          <Divider sx={{ borderColor: colors.border }} />

          <Box sx={{ px: 0.75, py: 0.65 }}>
            <MenuItem
              onClick={() => { setAnchorEl(null); navigate('/dashboard/profile'); }}
              sx={{
                gap: 1.5, minHeight: 44, px: 1.5, borderRadius: '10px',
                fontSize: '13px', fontWeight: 550, color: colors.textPrimary,
                '&:hover': { bgcolor: colors.surfaceAlt },
                '& .menu-icon': {
                  width: 32, height: 32, display: 'grid', placeItems: 'center',
                  borderRadius: '9px', bgcolor: colors.surfaceAlt, color: colors.textSecondary,
                },
              }}
            >
              <Box className="menu-icon"><PersonIcon sx={{ fontSize: 18 }} /></Box>
              <Box sx={{ flex: 1 }}>My Profile</Box>
            </MenuItem>

            <MenuItem
              onClick={() => { setAnchorEl(null); navigate('/dashboard/notifications'); }}
              sx={{
                gap: 1.5, minHeight: 44, px: 1.5, borderRadius: '10px',
                fontSize: '13px', fontWeight: 550, color: colors.textPrimary,
                '&:hover': { bgcolor: colors.surfaceAlt },
                '& .menu-icon': {
                  width: 32, height: 32, display: 'grid', placeItems: 'center',
                  borderRadius: '9px', bgcolor: colors.surfaceAlt, color: colors.textSecondary,
                },
              }}
            >
              <Box className="menu-icon"><NotificationsIcon sx={{ fontSize: 18 }} /></Box>
              <Box sx={{ flex: 1 }}>Notifications</Box>
              <Box
                sx={{
                  minWidth: 21, height: 21, px: 0.5, display: 'grid', placeItems: 'center',
                  borderRadius: '7px', bgcolor: colors.accentMuted, color: colors.primary,
                  fontSize: '10px', fontWeight: 800,
                }}
              >
                3
              </Box>
            </MenuItem>
          </Box>

          <Divider sx={{ borderColor: colors.border }} />

          <Box sx={{ p: 0.75 }}>
            <MenuItem
              onClick={() => { setAnchorEl(null); logout(); }}
              sx={{
                gap: 1.5, minHeight: 44, px: 1.5, borderRadius: '10px',
                fontSize: '13px', fontWeight: 650, color: colors.error,
                '&:hover': {
                  bgcolor: isDark ? 'rgba(255,82,82,0.12)' : 'rgba(220,38,38,0.06)',
                },
                '& .menu-icon': {
                  width: 32, height: 32, display: 'grid', placeItems: 'center',
                  borderRadius: '9px',
                  bgcolor: isDark ? 'rgba(255,82,82,0.1)' : 'rgba(220,38,38,0.07)',
                  color: colors.error,
                },
              }}
            >
              <Box className="menu-icon"><LogoutIcon sx={{ fontSize: 18 }} /></Box>
              Log Out
            </MenuItem>
          </Box>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}

