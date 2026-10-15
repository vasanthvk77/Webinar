import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Typography,
  Box
} from '@mui/material';
import { AlertCircle, Clock } from 'lucide-react';
import { useThemeColors } from '../context/ThemeContext';

/**
 * SessionExpiredModal
 * Shows a friendly countdown dialog when the JWT expires.
 * - User can click "Login Now" to go to /login immediately
 * - Auto-redirects after 5 seconds if no action
 * - Shows live countdown timer
 */
export default function SessionExpiredModal({ open, onClose }) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!open) {
      setCountdown(5);
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Auto-redirect after countdown ends
          window.location.href = '/login';
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [open]);

  const handleLoginNow = () => {
    window.location.href = '/login';
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      disableBackdropClick
      disableEscapeKeyDown
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          color: colors.error,
          fontWeight: 700,
          fontSize: '1.25rem',
          px: 3,
          py: 2,
        }}
      >
        <AlertCircle
          sx={{ color: colors.error, fontSize: 24 }}
          aria-hidden="true"
        />
        Session Expired
      </DialogTitle>

      <DialogContent
        sx={{
          px: 3,
          pb: 1,
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Typography
            variant="body1"
            color="textPrimary"
            textAlign="center"
            sx={{ lineHeight: 1.6 }}
          >
            Your session has expired. Please log in again to continue.
          </Typography>

          {/* Countdown Timer */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              padding: '12px 24px',
              backgroundColor: colors.error + '15',
              borderRadius: 2,
              border: `1px solid ${colors.error}40`,
            }}
          >
            <Clock sx={{ color: colors.error, fontSize: 20 }} aria-hidden="true" />
            <Typography
              variant="h6"
              color={colors.error}
              fontWeight={700}
              fontVariant="tabular-nums"
            >
              Redirecting in {countdown}s
            </Typography>
          </Box>

          <Typography
            variant="caption"
            color="textSecondary"
            textAlign="center"
          >
            You will be redirected to the login page automatically.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          pb: 2,
          justifyContent: 'center',
        }}
      >
        <Button
          variant="contained"
          color="error"
          size="large"
          onClick={handleLoginNow}
          startIcon={<AlertCircle sx={{ fontSize: 18 }} />}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            padding: '12px 32px',
            fontSize: '1rem',
          }}
        >
          Login Now
        </Button>
      </DialogActions>
    </Dialog>
  );
}