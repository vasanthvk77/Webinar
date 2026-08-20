import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, AppBar, Toolbar, Typography, IconButton,
  Avatar, Menu, MenuItem, Divider, Badge, Chip, Tooltip,
} from '@mui/material';
import NotificationsIcon      from '@mui/icons-material/Notifications';
import CalendarMonthIcon      from '@mui/icons-material/CalendarMonth';
import ChatBubbleOutlineIcon  from '@mui/icons-material/ChatBubbleOutlineOutlined';
import LogoutIcon             from '@mui/icons-material/Logout';
import PersonIcon             from '@mui/icons-material/Person';
import SettingsIcon           from '@mui/icons-material/Settings';
import LightModeIcon          from '@mui/icons-material/LightMode';
import DarkModeIcon           from '@mui/icons-material/DarkMode';
import { useAuth }            from '../../context/AuthContext';
import { useThemeColors, useAppTheme } from '../../context/ThemeContext';
import CustomSearchBar        from '../CustomSearchBar';

export default function AdminTopbar({ sidebarWidth }) {
  const { user, logout, isSuperAdmin } = useAuth();
  const colors = useThemeColors();
  const { isDark, toggleTheme } = useAppTheme();
  const navigate = useNavigate();

  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : 'A';

  const fullName = user ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'Admin';
  const roleName = isSuperAdmin ? 'Super Admin' : 'Admin';

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        left: sidebarWidth,
        width: `calc(100% - ${sidebarWidth}px)`,
        bgcolor: colors.surface,
        borderBottom: `1px solid ${colors.border}`,
        zIndex: 99,
        transition: 'left 0.2s ease, width 0.2s ease, background-color 0.3s ease',
        boxShadow: 'none',
      }}
    >
      <Toolbar sx={{ px: 3, gap: 2, minHeight: '64px !important' }}>
        {/* Search */}
        <CustomSearchBar
          placeholder="Search webinars, participants, payments..."
          maxWidth={480}
          sx={{ flexGrow: 1 }}
        />

        <Box sx={{ flexGrow: 1 }} />

        {/* Icons */}
        <IconButton size="small" sx={{ color: colors.textSecondary }}>
          <Badge
            badgeContent={5}
            sx={{
              '& .MuiBadge-badge': {
                bgcolor: colors.error, color: '#fff',
                fontSize: '10px', minWidth: 16, height: 16,
              },
            }}
          >
            <NotificationsIcon sx={{ fontSize: 22 }} />
          </Badge>
        </IconButton>

        <IconButton size="small" sx={{ color: colors.textSecondary }}>
          <Badge
            badgeContent={2}
            sx={{
              '& .MuiBadge-badge': {
                bgcolor: colors.accent, color: colors.textOnAccent,
                fontSize: '10px', minWidth: 16, height: 16,
              },
            }}
          >
            <CalendarMonthIcon sx={{ fontSize: 22 }} />
          </Badge>
        </IconButton>

        <IconButton size="small" sx={{ color: colors.textSecondary }}>
          <ChatBubbleOutlineIcon sx={{ fontSize: 22 }} />
        </IconButton>

        {/* ── Dark / Light mode toggle ── */}
        <Tooltip title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
          <IconButton
            size="small"
            onClick={toggleTheme}
            sx={{
              color: isDark ? colors.accent : colors.textSecondary,
              bgcolor: isDark ? colors.accentMuted : 'transparent',
              borderRadius: '50%',
              transition: 'all 0.25s ease',
              '&:hover': {
                bgcolor: colors.accentMuted,
                color: colors.accent,
                transform: 'rotate(20deg) scale(1.1)',
              },
            }}
          >
            {isDark ? <LightModeIcon sx={{ fontSize: 22 }} /> : <DarkModeIcon sx={{ fontSize: 22 }} />}
          </IconButton>
        </Tooltip>

        {/* Avatar button */}
        <Box
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            cursor: 'pointer', px: 1.5, py: 0.75, borderRadius: 2,
            border: `1px solid ${colors.border}`,
            '&:hover': { bgcolor: colors.surfaceAlt },
            transition: 'background 0.15s',
          }}
        >
          <Avatar
            sx={{
              width: 34,
              height: 34,
              bgcolor: isSuperAdmin ? colors.accent : (isDark ? 'rgba(255, 255, 255, 0.08)' : colors.primary),
              color: isSuperAdmin ? colors.textOnAccent : (isDark ? colors.accent : colors.textOnDark),
              fontSize: '13px',
              fontWeight: 700,
              border: isDark ? `1px solid ${colors.border}` : 'none',
            }}
          >
            {initials}
          </Avatar>
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <Typography sx={{ fontSize: '13px', fontWeight: 600, color: colors.primary, lineHeight: 1.2 }}>
              {user?.firstName} {user?.lastName ?? ''}
            </Typography>
            <Typography sx={{ fontSize: '11px', color: colors.textMuted, lineHeight: 1.2 }}>
              {roleName}
            </Typography>
          </Box>
        </Box>

        {/* Dropdown menu */}
        <Menu
          anchorEl={anchorEl}
          open={menuOpen}
          onClose={() => setAnchorEl(null)}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          PaperProps={{
            sx: {
              mt: 1, minWidth: 200, borderRadius: 2,
              boxShadow: `0 8px 24px ${colors.shadowMd}`,
              border: `1px solid ${colors.border}`,
              bgcolor: colors.surface,
            },
          }}
        >
          <Box sx={{ px: 2, py: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography sx={{ fontSize: '13px', fontWeight: 700, color: colors.primary }}>
                {fullName}
              </Typography>
              <Chip
                label={roleName}
                size="small"
                sx={{
                  height: 18, fontSize: '9px', fontWeight: 700,
                  bgcolor: isSuperAdmin ? colors.accentLight : colors.highlight,
                  color: colors.primary,
                }}
              />
            </Box>
            <Typography sx={{ fontSize: '11px', color: colors.textMuted }}>{user?.email}</Typography>
          </Box>

          <Divider sx={{ borderColor: colors.border }} />

          {/* Theme toggle in menu */}
          <MenuItem
            onClick={() => { setAnchorEl(null); toggleTheme(); }}
            sx={{ gap: 1.5, fontSize: '13px', color: colors.textPrimary }}
          >
            {isDark
              ? <LightModeIcon sx={{ fontSize: 18, color: colors.accent }} />
              : <DarkModeIcon  sx={{ fontSize: 18, color: colors.textMuted }} />
            }
            {isDark ? 'Light Mode' : 'Dark Mode'}
          </MenuItem>

          <Divider sx={{ borderColor: colors.border }} />

          <MenuItem
            onClick={() => { setAnchorEl(null); navigate('/admin/accounts'); }}
            sx={{ gap: 1.5, fontSize: '13px', color: colors.textPrimary }}
          >
            <PersonIcon sx={{ fontSize: 18, color: colors.textMuted }} /> Profile
          </MenuItem>

          {isSuperAdmin && (
            <MenuItem
              onClick={() => { setAnchorEl(null); navigate('/admin/access'); }}
              sx={{ gap: 1.5, fontSize: '13px', color: colors.textPrimary }}
            >
              <SettingsIcon sx={{ fontSize: 18, color: colors.textMuted }} /> Access Control
            </MenuItem>
          )}

          <Divider sx={{ borderColor: colors.border }} />

          <MenuItem
            onClick={() => { setAnchorEl(null); logout(); }}
            sx={{ gap: 1.5, fontSize: '13px', color: colors.error }}
          >
            <LogoutIcon sx={{ fontSize: 18, color: colors.error }} /> Log Out
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
