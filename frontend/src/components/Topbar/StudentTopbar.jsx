import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, AppBar, Toolbar, Typography, IconButton,
  Avatar, Menu, MenuItem, Divider, Badge, Tooltip,
} from '@mui/material';
import NotificationsIcon  from '@mui/icons-material/Notifications';
import LogoutIcon         from '@mui/icons-material/Logout';
import PersonIcon         from '@mui/icons-material/Person';
import LightModeIcon      from '@mui/icons-material/LightMode';
import DarkModeIcon       from '@mui/icons-material/DarkMode';
import { useAuth }        from '../../context/AuthContext';
import { useThemeColors, useAppTheme } from '../../context/ThemeContext';
import CustomSearchBar    from '../CustomSearchBar';

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

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        left: SIDEBAR_WIDTH,
        width: `calc(100% - ${SIDEBAR_WIDTH}px)`,
        bgcolor: colors.surface,
        borderBottom: `1px solid ${colors.border}`,
        boxShadow: 'none',
        zIndex: 99,
      }}
    >
      <Toolbar sx={{ px: 3, gap: 2, minHeight: '64px !important' }}>
        {/* Search */}
        <CustomSearchBar
          placeholder="Search webinars, topics, speakers..."
          maxWidth={420}
          sx={{ flexGrow: 1 }}
        />

        <Box sx={{ flexGrow: 1 }} />

        {/* Notification bell */}
        <IconButton
          size="small"
          onClick={() => navigate('/dashboard/notifications')}
          sx={{ color: colors.textSecondary }}
        >
          <Badge
            badgeContent={3}
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

        {/* Dark / Light mode toggle */}
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
            display: 'flex', alignItems: 'center', gap: 1,
            cursor: 'pointer', px: 1, py: 0.5, borderRadius: 2,
            '&:hover': { bgcolor: colors.surfaceAlt },
            transition: 'background 0.15s',
          }}
        >
          <Avatar
            sx={{
              width: 34,
              height: 34,
              bgcolor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.primary,
              color: isDark ? colors.accent : colors.textOnDark,
              fontSize: '13px',
              fontWeight: 700,
              border: isDark ? `1px solid ${colors.border}` : 'none',
            }}
          >
            {initials}
          </Avatar>
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <Typography sx={{ fontSize: '13px', fontWeight: 600, color: colors.primary, lineHeight: 1.2 }}>
              Hi, {user?.firstName}
            </Typography>
            <Typography sx={{ fontSize: '11px', color: colors.textMuted, lineHeight: 1.2 }}>
              Student
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
              mt: 1, minWidth: 180, borderRadius: 2,
              boxShadow: `0 8px 24px ${colors.shadowMd}`,
              border: `1px solid ${colors.border}`,
              bgcolor: colors.surface,
            },
          }}
        >
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography sx={{ fontSize: '13px', fontWeight: 700, color: colors.primary }}>{fullName}</Typography>
            <Typography sx={{ fontSize: '11px', color: colors.textMuted }}>{user?.email}</Typography>
          </Box>
          <Divider sx={{ borderColor: colors.border }} />
          <MenuItem
            onClick={() => { setAnchorEl(null); navigate('/dashboard/profile'); }}
            sx={{ gap: 1.5, fontSize: '13px', color: colors.textPrimary }}
          >
            <PersonIcon sx={{ fontSize: 18, color: colors.textMuted }} /> My Profile
          </MenuItem>
          <MenuItem
            onClick={() => { setAnchorEl(null); navigate('/dashboard/notifications'); }}
            sx={{ gap: 1.5, fontSize: '13px', color: colors.textPrimary }}
          >
            <NotificationsIcon sx={{ fontSize: 18, color: colors.textMuted }} /> Notifications
          </MenuItem>
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
