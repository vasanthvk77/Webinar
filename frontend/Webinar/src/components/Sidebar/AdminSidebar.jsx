import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, List, ListItemButton, ListItemText,
  Typography, Collapse, IconButton, CircularProgress,
} from '@mui/material';
import MenuIcon         from '@mui/icons-material/Menu';
import ChevronLeftIcon  from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon   from '@mui/icons-material/ExpandMore';
import adminTabs        from '../../config/adminTabs';
import { useAuth }      from '../../context/AuthContext';
import { colors }       from '../../utils/theme';
import logo             from '../../assets/logo1.png';

const SIDEBAR_WIDTH   = 260;
const COLLAPSED_WIDTH = 64;

// ─────────────────────────────────────────────────────────
// Icon-Bubble with hover interaction
//
// Active:
//   • Round amber bubble (#FEF3C7 bg, #D97706 icon)
//   • On hover: bubble scales up, stronger amber shadow
//   • Label shifts right 4px, bold dark
//
// Inactive:
//   • Bare icon, muted color, no bubble
//   • On hover: bubble fades in, icon turns amber, scales up
//   • Label shifts right 4px
// ─────────────────────────────────────────────────────────

// Amber bubble constants
const BUBBLE_ACTIVE_BG     = '#FEF3C7';
const BUBBLE_ACTIVE_ICON   = '#D97706';
const BUBBLE_ACTIVE_SHADOW = '0 6px 16px rgba(217,119,6,0.35)';

export default function AdminSidebar({ collapsed, onToggle }) {
  const navigate     = useNavigate();
  const { pathname } = useLocation();
  const { isSuperAdmin, canAccessTab, tabsReady } = useAuth();

  const [openSubMenu, setOpenSubMenu] = useState(() => {
    const open = {};
    adminTabs.forEach((tab) => {
      if (tab.children?.some((c) => pathname.startsWith(c.route))) {
        open[tab.route] = true;
      }
    });
    return open;
  });

  const toggleSubMenu = (parentRoute) =>
    setOpenSubMenu((prev) => (!!prev[parentRoute] ? {} : { [parentRoute]: true }));

  const isActive = (route) => {
    if (route === '/admin/dashboard') return pathname === '/admin/dashboard';
    return pathname.startsWith(route);
  };

  const isParentActive = (tab) => tab.children?.some((c) => isActive(c.route)) ?? false;

  const isVisible = (tab) => {
    if (tab.alwaysShow)     return true;
    if (tab.superAdminOnly) return isSuperAdmin;
    if (tab.children)       return tab.children.some((c) => canAccessTab(c.route));
    return canAccessTab(tab.route);
  };

  // ── Row button sx ─────────────────────────────────────
  // No background on the row. Hover handled via CSS on children.
  const rowSx = (active, indent = false) => ({
    borderRadius: 2,
    mb: 0.5,
    px: indent ? 1 : 1,
    pl: indent ? 2 : 1,
    py: 0.75,
    justifyContent: collapsed ? 'center' : 'flex-start',
    bgcolor: 'transparent',
    color:   active ? colors.primary : colors.textSecondary,
    // Smooth row-level transitions
    transition: 'color 0.2s ease, transform 0.15s ease',

    // Click: slide row right slightly (spring back on release)
    '&:active': {
      transform: 'translateX(6px)',
      transition: 'transform 0.08s ease',
    },

    // Hover: shift label, scale bubble
    '&:hover': {
      bgcolor: 'transparent',
      color:   colors.primary,
      transform: 'translateX(3px)',
      '& .MuiListItemText-primary': {
        transform: 'translateX(2px)',
        transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
      },
      '& .icon-bubble': {
        transform: 'scale(1.15)',
        bgcolor:    BUBBLE_ACTIVE_BG,
        boxShadow:  active ? BUBBLE_ACTIVE_SHADOW : '0 4px 12px rgba(217,119,6,0.2)',
        '& .MuiSvgIcon-root': { color: BUBBLE_ACTIVE_ICON },
      },
    },
  });

  // ── Icon bubble box sx ────────────────────────────────
  const bubbleSx = (active) => ({
    width: 32, height: 32,
    borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    // Spring bounce easing — makes scale feel physical
    transition: 'all 0.4s cubic-bezier(0.34,1.56,0.64,1)',
    bgcolor:   active ? BUBBLE_ACTIVE_BG : 'transparent',
    boxShadow: active ? '0 2px 8px rgba(217,119,6,0.18)' : 'none',
    '& .MuiSvgIcon-root': {
      transition: 'color 0.25s ease',
      color: active ? BUBBLE_ACTIVE_ICON : colors.primaryMuted,
    },
  });

  const width = collapsed ? COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  // ── Render a single tab row ───────────────────────────
  const TabRow = ({ tabRoute, Icon, label, active, onClick, indent = false, extraSx = {} }) => (
    <ListItemButton
      onClick={onClick}
      title={collapsed ? label : undefined}
      sx={{ ...rowSx(active, indent), ...extraSx }}
    >
      {/* Icon bubble — className used as CSS hook for parent hover */}
      <Box
        className="icon-bubble"
        sx={{
          ...bubbleSx(active),
          mr: collapsed ? 0 : 1.25,
        }}
      >
        <Icon sx={{ fontSize: collapsed ? 20 : 18 }} />
      </Box>

      {!collapsed && (
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
      )}
    </ListItemButton>
  );

  return (
    <Box
      sx={{
        width,
        height: '100vh',
        bgcolor: colors.surface,
        borderRight: `1px solid ${colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0, left: 0,
        zIndex: 100,
        transition: 'width 0.2s ease',
        overflow: 'hidden',
        boxShadow: '2px 0 8px rgba(0,0,0,0.04)',
      }}
    >
      {/* ── Header ── */}
      <Box
        sx={{
          flexShrink: 0,
          px: collapsed ? 1 : 2.5,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          minHeight: 64,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        {!collapsed && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <img src={logo} alt="Weblearn" style={{ height: 55, objectFit: 'contain' }} />
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '15px', color: colors.primary, lineHeight: 1.1, letterSpacing: '-0.2px' }}>
                Weblearn
              </Typography>
              <Typography sx={{ fontSize: '10px', fontWeight: 500, color: colors.textMuted, letterSpacing: '0.3px' }}>
                Webinar Portal
              </Typography>
            </Box>
          </Box>
        )}

        {/* Collapsed: show logo only */}
        {collapsed && (
          <img src={logo} alt="Weblearn" style={{ height: 36, objectFit: 'contain' }} />
        )}
        <IconButton
          onClick={onToggle}
          size="small"
          sx={{ color: colors.textMuted, '&:hover': { color: colors.primary, bgcolor: BUBBLE_ACTIVE_BG } }}
        >
          {collapsed ? <MenuIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* ── Nav list ── */}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          py: 1,
          '&::-webkit-scrollbar':             { width: 3 },
          '&::-webkit-scrollbar-track':       { background: 'transparent' },
          '&::-webkit-scrollbar-thumb':       { background: colors.border, borderRadius: 4 },
          '&::-webkit-scrollbar-thumb:hover': { background: colors.borderMid },
        }}
      >
        {!tabsReady ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
            <CircularProgress size={20} sx={{ color: colors.accent }} />
          </Box>
        ) : (
          <List sx={{ px: collapsed ? 0.5 : 1, py: 0 }}>
            {adminTabs.filter(isVisible).map((tab) => {
              const { label, route, icon: Icon, children } = tab;
              const hasChildren = Boolean(children?.length);

              /* ── Parent tab with accordion dropdown ── */
              if (hasChildren) {
                const parentActive = isParentActive(tab);
                const subOpen      = !!openSubMenu[route];
                const highlighted  = parentActive || subOpen;
                const visibleKids  = children.filter((c) => canAccessTab(c.route));

                return (
                  <Box key={route}>
                    <ListItemButton
                      onClick={() => toggleSubMenu(route)}
                      title={collapsed ? label : undefined}
                      sx={rowSx(highlighted)}
                    >
                      <Box className="icon-bubble" sx={{ ...bubbleSx(highlighted), mr: collapsed ? 0 : 1.25 }}>
                        <Icon sx={{ fontSize: collapsed ? 20 : 18 }} />
                      </Box>
                      {!collapsed && (
                        <>
                          <ListItemText
                            primary={label}
                            primaryTypographyProps={{
                              fontSize: '13.5px', fontWeight: highlighted ? 700 : 500,
                              color: 'inherit', noWrap: true,
                              sx: { transition: 'transform 0.3s ease' },
                            }}
                          />
                          {subOpen
                            ? <ExpandMoreIcon   sx={{ fontSize: 17, color: BUBBLE_ACTIVE_ICON, flexShrink: 0 }} />
                            : <ChevronRightIcon sx={{ fontSize: 17, color: colors.primaryMuted, flexShrink: 0 }} />
                          }
                        </>
                      )}
                    </ListItemButton>

                    {!collapsed && (
                      <Collapse in={subOpen} timeout={220} unmountOnExit>
                        <List sx={{ py: 0 }}>
                          {visibleKids.map((child) => {
                            const childActive = isActive(child.route);
                            const ChildIcon   = child.icon;
                            return (
                              <TabRow
                                key={child.route}
                                tabRoute={child.route}
                                Icon={ChildIcon}
                                label={child.label}
                                active={childActive}
                                onClick={() => navigate(child.route)}
                                indent
                                extraSx={{ mb: 0.25 }}
                              />
                            );
                          })}
                        </List>
                      </Collapse>
                    )}
                  </Box>
                );
              }

              /* ── Regular flat tab ── */
              const active = isActive(route);
              return (
                <TabRow
                  key={route}
                  tabRoute={route}
                  Icon={Icon}
                  label={label}
                  active={active}
                  onClick={() => navigate(route)}
                />
              );
            })}
          </List>
        )}
      </Box>

      {/* ── Footer ── */}
      {!collapsed && (
        <Box sx={{ flexShrink: 0, px: 2.5, py: 1.75, borderTop: `1px solid ${colors.border}` }}>
          <Typography sx={{ fontSize: '11px', fontWeight: 550, color: colors.accent, display: 'flex', justifyContent: 'center' }}>
            CONNECT · LEARN · GROW
          </Typography>
        </Box>
      )}
    </Box>
  );
}
