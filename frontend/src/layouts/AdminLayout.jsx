import { useState } from 'react';
import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import AdminSidebar         from '../components/Sidebar/AdminSidebar';
import AdminTopbar          from '../components/Topbar/AdminTopbar';
import { useThemeColors }   from '../context/ThemeContext';

const SIDEBAR_WIDTH_EXPANDED = 260;
const SIDEBAR_WIDTH_COLLAPSED = 64;
const TOPBAR_HEIGHT = 64;

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const sidebarWidth = collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;
  const colors = useThemeColors();

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: colors.bg }}>
      <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      <Box
        sx={{
          flexGrow: 1,
          ml: `${sidebarWidth}px`,
          display: 'flex',
          flexDirection: 'column',
          transition: 'margin-left 0.2s ease',
        }}
      >
        <AdminTopbar sidebarWidth={sidebarWidth} />

        <Box
          component="main"
          sx={{
            mt: `${TOPBAR_HEIGHT}px`,
            p: 3,
            flexGrow: 1,
            minHeight: `calc(100vh - ${TOPBAR_HEIGHT}px)`,
            bgcolor: colors.bg,
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
