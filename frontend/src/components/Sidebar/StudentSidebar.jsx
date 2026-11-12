import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, List, ListItemButton, ListItemText,
  Typography, Button,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import SchoolIcon from '@mui/icons-material/School';
import studentTabs from '../../config/studentTabs';
import { useThemeColors, useAppTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import logo from '../../assets/logo1.png';

const SIDEBAR_WIDTH = 240;

export default function StudentSidebar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const colors = useThemeColors();
  const { isDark } = useAppTheme();
  const { logout } = useAuth();

  const isActive = (route) => {
    if (route === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(route);
  };

  const handleLogout = () => {
    if (logout) logout();
    navigate('/login');
  };

  return (
    <Box
      sx={{
        width: SIDEBAR_WIDTH,
        height: '100vh',
        bgcolor: isDark ? colors.surface : '#FFFFFF',
        borderRight: isDark ? `1px solid ${colors.border}` : '1px solid #F1F5F9',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 100,
        boxShadow: isDark ? '2px 0 12px rgba(0,0,0,0.4)' : '2px 0 16px rgba(0,0,0,0.02)',
      }}
    >
      {/* ── Brand Header with Application Logo ────────────────────── */}
      <Box
        sx={{
          flexShrink: 0,
          px: 2.75,
          py: 2.25,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          minHeight: 70,
        }}
      >
        <Box
          component="img"
          src={logo}
          alt="Weblearn"
          sx={{
            width: 36,
            height: 36,
            objectFit: 'contain',
            filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.1))',
            flexShrink: 0,
          }}
        />
        <Box>
          <Typography
            sx={{
              fontWeight: 850,
              fontSize: '16.5px',
              color: isDark ? colors.textPrimary : '#0F172A',
              lineHeight: 1.15,
              letterSpacing: '-0.3px',
            }}
          >
            Weblearn
          </Typography>
          <Typography
            sx={{
              fontSize: '11px',
              fontWeight: 650,
              color: isDark ? colors.textSecondary : '#64748B',
              lineHeight: 1.1,
              letterSpacing: '0.2px',
            }}
          >
            Webinar Portal
          </Typography>
        </Box>
      </Box>

      {/* ── Navigation Items ────────────────────────────────────── */}
      <List
        sx={{
          px: 1.75,
          py: 1,
          flexGrow: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: 0.6,
          '&::-webkit-scrollbar': { width: 3 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': { background: colors.border, borderRadius: 4 },
        }}
      >
        {studentTabs.map(({ label, route, icon: Icon }) => {
          const active = isActive(route);
          return (
            <ListItemButton
              key={route}
              onClick={() => navigate(route)}
              sx={{
                borderRadius: '14px',
                px: 1.75,
                py: 1,
                bgcolor: active
                  ? (isDark ? 'rgba(234, 88, 12, 0.18)' : '#FFEDD5')
                  : 'transparent',
                color: active
                  ? '#EA580C'
                  : (isDark ? colors.textSecondary : '#475569'),
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: active
                    ? (isDark ? 'rgba(234, 88, 12, 0.22)' : '#FED7AA')
                    : (isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC'),
                  color: active ? '#EA580C' : (isDark ? '#FFFFFF' : '#0F172A'),
                  '& .nav-icon': {
                    color: active ? '#EA580C' : '#0F172A',
                  },
                },
              }}
            >
              <Box
                className="nav-icon"
                sx={{
                  mr: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: active ? '#EA580C' : (isDark ? colors.textMuted : '#64748B'),
                  transition: 'color 0.2s ease',
                }}
              >
                <Icon sx={{ fontSize: 20 }} />
              </Box>

              <ListItemText
                primary={
                  <Typography sx={{ fontSize: '13.5px', fontWeight: active ? 750 : 550, color: 'inherit' }} noWrap>
                    {label}
                  </Typography>
                }
              />
            </ListItemButton>
          );
        })}
      </List>

      {/* ── Bottom Promo Card: Keep Learning! ──────────────────── */}
      <Box
        onClick={() => navigate('/dashboard/webinars')}
        sx={{
          flexShrink: 0,
          mx: 2,
          mb: 1.5,
          p: 2,
          borderRadius: '18px',
          background: isDark
            ? 'linear-gradient(135deg, rgba(234,88,12,0.15) 0%, rgba(20,22,30,0.9) 100%)'
            : 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)',
          border: isDark ? '1px solid rgba(234,88,12,0.25)' : '1px solid #FED7AA',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: '0 4px 14px rgba(234, 88, 12, 0.06)',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 20px rgba(234, 88, 12, 0.12)',
            borderColor: '#FB923C',
          },
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '10px',
            bgcolor: '#EA580C',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 1,
            boxShadow: '0 4px 10px rgba(234,88,12,0.25)',
          }}
        >
          <SchoolIcon sx={{ fontSize: 22 }} />
        </Box>
        <Typography
          sx={{
            fontSize: '13px',
            fontWeight: 800,
            color: isDark ? colors.textPrimary : '#0F172A',
            mb: 0.25,
          }}
        >
          Keep Learning!
        </Typography>
        <Typography
          sx={{
            fontSize: '11px',
            color: isDark ? colors.textSecondary : '#64748B',
            lineHeight: 1.35,
          }}
        >
          Attend webinars and earn certificates.
        </Typography>
      </Box>

      {/* ── Logout Button ──────────────────────────────────────── */}
      <Box sx={{ flexShrink: 0, px: 2, pb: 2 }}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<LogoutIcon sx={{ fontSize: 17 }} />}
          onClick={handleLogout}
          sx={{
            borderRadius: '14px',
            borderColor: isDark ? colors.border : '#E2E8F0',
            color: isDark ? colors.textSecondary : '#334155',
            fontSize: '13px',
            fontWeight: 650,
            textTransform: 'none',
            py: 0.9,
            '&:hover': {
              borderColor: '#EA580C',
              color: '#EA580C',
              bgcolor: isDark ? 'rgba(234,88,12,0.08)' : '#FFF7ED',
            },
          }}
        >
          Logout
        </Button>
      </Box>
    </Box>
  );
}
