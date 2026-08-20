import { useLocation } from 'react-router-dom';
import { Box, Typography, Paper } from '@mui/material';
import BuildIcon  from '@mui/icons-material/Build';
import { colors } from '../utils/theme';

const routeLabels = {
  // Student
  'profile':             'My Profile',
  'upcoming':            'Upcoming Webinars',
  'registered':          'Registered Webinars',
  'completed':           'Completed Webinars',
  'certificates':        'My Certificates',
  'recordings':          'Webinar Recordings',
  'payments':            'Payments',
  'notifications':       'Notifications',
  // Admin
  'dashboard':           'Dashboard',
  'webinars':            'Webinars',
  'registrations':       'Registrations',
  'participants':        'Participants',
  'documents':           'Documents & Materials',
  'accounts':            'Admin Accounts',
  'roles':               'Roles & Permissions',
  'access':              'Access Control',
  'certifications':      'Certifications',
  'categories':          'Categories',
  'webinar-types':       'Webinar Types',
  'reminders':           'Reminder Configuration',
  'email-templates':     'Email Templates',
  'sms-templates':       'SMS Templates',
  'whatsapp-templates':  'WhatsApp Templates',
  'reports':             'Reports',
  'analytics':           'Analytics',
};

export default function ModulePlaceholder() {
  const { pathname } = useLocation();
  const lastSegment  = pathname.split('/').filter(Boolean).pop();
  const moduleName   = routeLabels[lastSegment] || lastSegment || 'This Module';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 120px)',
        bgcolor: colors.bg,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          textAlign: 'center',
          px: 6, py: 8,
          borderRadius: 3,
          border: `2px dashed ${colors.border}`,
          maxWidth: 480,
          bgcolor: colors.surface,
        }}
      >
        {/* Icon circle */}
        <Box
          sx={{
            width: 80, height: 80, borderRadius: '50%',
            bgcolor: colors.accentMuted,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            mx: 'auto', mb: 3,
          }}
        >
          <BuildIcon sx={{ fontSize: 36, color: colors.accent }} />
        </Box>

        <Typography
          variant="h5"
          sx={{ fontWeight: 700, color: colors.primary, mb: 1 }}
        >
          {moduleName}
        </Typography>

        <Typography
          sx={{ fontSize: '15px', color: colors.textSecondary, mb: 2, lineHeight: 1.6 }}
        >
          This module is currently under development.
        </Typography>

        {/* Badge */}
        <Box
          sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0.75,
            bgcolor: colors.highlight,
            color:   colors.primary,
            fontSize: '12px', fontWeight: 700,
            px: 2, py: 0.75, borderRadius: 10,
          }}
        >
          🚧&nbsp;Coming Soon
        </Box>

        <Typography sx={{ mt: 3, fontSize: '12px', color: colors.textMuted }}>
          {pathname}
        </Typography>
      </Paper>
    </Box>
  );
}
