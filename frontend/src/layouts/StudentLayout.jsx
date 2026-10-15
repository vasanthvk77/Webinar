import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import StudentSidebar      from '../components/Sidebar/StudentSidebar';
import StudentTopbar       from '../components/Topbar/StudentTopbar';
import { useThemeColors }  from '../context/ThemeContext';

const SIDEBAR_WIDTH = 240;
const TOPBAR_HEIGHT = 64;

export default function StudentLayout() {
  const colors = useThemeColors();
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: colors.bg }}>
      <StudentSidebar />

      <Box sx={{ flexGrow: 1, ml: `${SIDEBAR_WIDTH}px`, display: 'flex', flexDirection: 'column' }}>
        <StudentTopbar />

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
