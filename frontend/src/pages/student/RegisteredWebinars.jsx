import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, Grid, Chip, IconButton,
  Tooltip, CircularProgress, Divider, Avatar, Dialog, DialogContent, DialogActions
} from '@mui/material';
import BookmarkAddedIcon    from '@mui/icons-material/BookmarkAdded';
import CalendarMonthIcon    from '@mui/icons-material/CalendarMonth';
import AccessTimeIcon       from '@mui/icons-material/AccessTime';
import ShareIcon            from '@mui/icons-material/Share';
import EventIcon            from '@mui/icons-material/Event';
import VideoCameraFrontIcon from '@mui/icons-material/VideoCameraFront';
import FilterListIcon       from '@mui/icons-material/FilterList';
import CheckCircleIcon      from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon     from '@mui/icons-material/ArrowForward';
import SchoolIcon           from '@mui/icons-material/School';
import toast                from 'react-hot-toast';
import { webinarService, calendarService } from '../../services/api';
import { useAuth }          from '../../context/AuthContext';
import { useThemeColors }   from '../../context/ThemeContext';
import CustomSearchBar      from '../../components/CustomSearchBar';
import CardComponent, { WebinarPageHeader } from '../../components/CardComponent';
import { BookOpen, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { formatUtcToLocalDateOnly, formatUtcToLocalTimeOnly, isWebinarStartTimePast } from '../../utils/validation';

// Helper: Format Date
const formatDate = (dateStr) => formatUtcToLocalDateOnly(dateStr);

// Helper: Format Time (12-hour AM/PM)
const formatTime = (timeStr) => formatUtcToLocalTimeOnly(timeStr);

// Helper: Format Duration
const fmtDuration = (mins) => {
  if (!mins || mins <= 0) return '—';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

// Compute timing status
const getWebinarTimingStatus = (webinarDate, startTime) => {
  if (!webinarDate) return { label: 'Scheduled', type: 'UPCOMING', color: 'info' };
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const wDate = new Date(webinarDate);
    wDate.setHours(0, 0, 0, 0);

    const diffDays = Math.round((wDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: 'Completed', type: 'PAST' };
    } else if (diffDays === 0) {
      return { label: 'Happening Today', type: 'TODAY' };
    } else if (diffDays === 1) {
      return { label: 'Tomorrow', type: 'UPCOMING' };
    } else {
      return { label: `In ${diffDays} days`, type: 'UPCOMING' };
    }
  } catch {
    return { label: 'Scheduled', type: 'UPCOMING' };
  }
};

export default function RegisteredWebinars() {
  const colors   = useThemeColors();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [webinars, setWebinars]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'UPCOMING' | 'PAST'
  const [joinModalWebinar, setJoinModalWebinar] = useState(null);

  // Load registered webinars for this student
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await webinarService.getRegistered();
      if (res.data?.success) {
        setWebinars(res.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching registered webinars:', err);
      toast.error('Failed to load registered webinars');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered registrations
  const filteredWebinars = useMemo(() => {
    return webinars.filter((item) => {
      const timing = getWebinarTimingStatus(item.webinarDate, item.startTime);
      if (statusFilter === 'UPCOMING' && timing.type === 'PAST') return false;
      if (statusFilter === 'PAST' && timing.type !== 'PAST') return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = item.webinarName?.toLowerCase().includes(q);
        const matchesCond = item.conductorName?.toLowerCase().includes(q);
        const matchesCat  = item.categoryName?.toLowerCase().includes(q);
        if (!matchesName && !matchesCond && !matchesCat) return false;
      }
      return true;
    });
  }, [webinars, statusFilter, search]);

  // Statistics
  const stats = useMemo(() => {
    const total = webinars.length;
    let upcoming = 0;
    let completed = 0;
    let totalMinutes = 0;
    webinars.forEach(w => {
      const timing = getWebinarTimingStatus(w.webinarDate, w.startTime);
      if (timing.type === 'PAST') completed++;
      else upcoming++;
      totalMinutes += (w.durationMinutes || 0);
    });

    const hours = (totalMinutes / 60).toFixed(1);
    return { total, upcoming, completed, hours };
  }, [webinars]);

  // Share webinar link
  const handleCopyLink = (shareId, e) => {
    e?.stopPropagation();
    const url = `${window.location.origin}/register?trackingId=${shareId}`;
    navigator.clipboard.writeText(url);
    toast.success('Webinar link copied to clipboard!');
  };

  // Add to Google Calendar
  const handleAddToCalendar = async (w) => {
    const wid = w.id || w.webinarId;
    if (!wid) {
      toast.error('Session not found');
      return;
    }

    try {
      const toastId = toast.loading('Connecting to Google Calendar...');
      const res = await calendarService.addEvent(wid, Intl.DateTimeFormat().resolvedOptions().timeZone);

      if (res.data?.success) {
        toast.success(res.data.message || 'Event & reminders saved to your Google Calendar!', { id: toastId });
        if (res.data.eventLink) {
          window.open(res.data.eventLink, '_blank');
        }
      } else if (res.data?.requiresAuth && res.data.authUrl) {
        toast.dismiss(toastId);
        const width = 500;
        const height = 650;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        window.open(
          res.data.authUrl,
          'GoogleCalendarAuth',
          `width=${width},height=${height},top=${top},left=${left}`
        );

        const handleMessage = (event) => {
          if (event.data?.type === 'GOOGLE_CALENDAR_SUCCESS') {
            toast.success('Google Calendar connected! Event has been added with your reminders.');
            window.removeEventListener('message', handleMessage);
          }
        };
        window.addEventListener('message', handleMessage);
      } else {
        toast.error(res.data?.message || 'Failed saving event to Google Calendar', { id: toastId });
      }
    } catch {
      try {
        const start = new Date(w.startTime).toISOString().replace(/-|:|\.\d\d\d/g, "");
        const end = new Date(w.endTime).toISOString().replace(/-|:|\.\d\d\d/g, "");
        const title = encodeURIComponent(w.webinarName);
        const details = encodeURIComponent(`Webinar hosted by ${w.conductorName}.\nWebinar portal: ${window.location.origin}`);
        const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}`;
        window.open(gcalUrl, '_blank');
      } catch {
        toast.error('Could not connect to Google Calendar');
      }
    }
  };

  return (
    <Box
      sx={{
        minHeight: 'calc(100vh - 110px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        maxWidth: 1600,
        mx: 'auto',
        width: '100%'
      }}
    >
      {/* ── Top Row Section: Dashboard Metrics & Controls ───────────── */}
      <WebinarPageHeader
        title="Registered Webinars"
        subtitle="Manage your scheduled video workshops, live links, and attendance details."
        metrics={[
          { label: 'Enrolled Webinars', value: stats.total, type: 'orange' },
          { label: 'Upcoming Sessions', value: stats.upcoming, type: 'blue' },
          { label: 'Completed Sessions', value: stats.completed, type: 'green' },
          { label: 'Total Hours', value: `${stats.hours}h`, type: 'purple' },
        ]}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search registered sessions..."
        filters={[
          { id: 'ALL', label: `All (${webinars.length})` },
          { id: 'UPCOMING', label: `Upcoming (${stats.upcoming})` },
          { id: 'PAST', label: `Completed (${stats.completed})` },
        ]}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
      />


      {/* ── Scrollable Card Area ───────────────────────────────────────────── */}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          pr: 0.5,
          pb: 3,
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': { bgcolor: colors.border, borderRadius: 3 },
        }}
      >
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 10, gap: 2 }}>
            <CircularProgress size={42} thickness={4.5} sx={{ color: '#EA580C' }} />
            <Typography variant="body2" sx={{ color: colors.textSecondary, fontWeight: 600 }}>
              Loading your learning schedule...
            </Typography>
          </Box>
        ) : filteredWebinars.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              py: 8,
              px: 3,
              textAlign: 'center',
              borderRadius: '20px',
              bgcolor: '#FFF7ED',
              border: '2px dashed #FED7AA',
              maxWidth: 580,
              mx: 'auto',
              mt: 2
            }}
          >
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                bgcolor: '#FFEDD5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
              }}
            >
              <BookmarkAddedIcon sx={{ fontSize: 36, color: '#EA580C' }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#9A3412', mb: 0.75 }}>
              {webinars.length === 0 ? "You haven't registered for any webinars yet" : "No sessions match your filter"}
            </Typography>
            <Typography variant="body2" sx={{ color: '#C2410C', maxWidth: 420, mx: 'auto', mb: 3, lineHeight: 1.6 }}>
              {webinars.length === 0
                ? 'Discover live expert sessions on our Upcoming Webinars tab and reserve your seat today!'
                : 'Try clearing your search query or switching filter tabs to view all your enrolled sessions.'}
            </Typography>

            {webinars.length === 0 ? (
              <Button
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/dashboard/upcoming')}
                sx={{
                  bgcolor: '#EA580C',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  textTransform: 'none',
                  px: 3.5,
                  py: 1.1,
                  borderRadius: '12px',
                  boxShadow: '0 6px 16px rgba(234, 88, 12, 0.25)',
                  '&:hover': { bgcolor: '#C2410C' }
                }}
              >
                Explore Upcoming Webinars
              </Button>
            ) : (
              <Button
                variant="outlined"
                size="medium"
                onClick={() => { setSearch(''); setStatusFilter('ALL'); }}
                sx={{
                  color: '#EA580C',
                  borderColor: '#EA580C',
                  bgcolor: 'transparent',
                  fontWeight: 700,
                  textTransform: 'none',
                  borderRadius: '10px',
                  px: 3,
                  '&:hover': { bgcolor: '#FFF7ED', borderColor: '#C2410C' }
                }}
              >
                Reset Filters
              </Button>
            )}
          </Paper>
        ) : (
          <Grid container spacing={2.5} alignItems="stretch">
            {filteredWebinars.map((w) => {
              const timing = getWebinarTimingStatus(w.webinarDate, w.startTime);
              const isCompleted = timing.type === 'PAST';

              return (
                <Grid item xs={12} lg={6} key={w.id} sx={{ display: 'flex' }}>
                  <CardComponent
                    webinar={w}
                    type="registered"
                    statusLabel={isCompleted ? 'Completed' : timing.label}
                    price={w.isPaid ? (w.price ? `$${w.price}` : 'Paid') : 'Free'}
                    primaryLabel={isCompleted ? 'Session Details' : 'Join Webinar'}
                    onPrimaryClick={() => setJoinModalWebinar(w)}
                    secondaryLabel="Details"
                    onSecondaryClick={() => setJoinModalWebinar(w)}
                    onCalendarClick={
                      isWebinarStartTimePast(w.startTime)
                        ? undefined
                        : () => handleAddToCalendar(w)
                    }
                    onShareClick={
                      isWebinarStartTimePast(w.startTime)
                        ? undefined
                        : (e) => handleCopyLink(w.shareId, e)
                    }
                  />
                </Grid>
              );
            })}
          </Grid>
        )}
      </Box>

      {/* ── Join / Details Dialog ────────────────────────────────────────────── */}
      {joinModalWebinar && (
        <Dialog
          open={Boolean(joinModalWebinar)}
          onClose={() => setJoinModalWebinar(null)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: '22px',
              bgcolor: colors.surface,
              overflow: 'hidden',
              boxShadow: '0 25px 70px rgba(15, 23, 42, 0.28)'
            }
          }}
        >
          {/* Modal Top Banner */}
          <Box
            sx={{
              px: 3,
              py: 2,
              background: 'linear-gradient(120deg, #0F172A 0%, #1E293B 100%)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '3px solid #F2B705'
            }}
          >
            <Chip
              label={joinModalWebinar.categoryName || 'General'}
              size="small"
              sx={{
                bgcolor: 'rgba(255,255,255,0.12)',
                color: '#FFFFFF',
                fontWeight: 700,
                borderRadius: '8px',
                fontSize: '12px'
              }}
            />
            <Chip
              icon={<CheckCircleIcon sx={{ fontSize: '14px !important', color: '#15803D !important' }} />}
              label="ENROLLED"
              size="small"
              sx={{
                fontWeight: 700,
                bgcolor: '#DCFCE7',
                color: '#15803D',
                borderRadius: '8px',
                px: 0.5
              }}
            />
          </Box>

          <DialogContent sx={{ pt: 3, pb: 2, px: { xs: 2.5, sm: 3.5 } }}>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 800,
                letterSpacing: '-0.4px',
                color: colors.textPrimary,
                mb: 1,
                lineHeight: 1.3
              }}
            >
              {joinModalWebinar.webinarName}
            </Typography>

            <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2.5 }}>
              Hosted by <strong>{joinModalWebinar.conductorName}</strong> ({joinModalWebinar.conductorEmail || 'Instructor'})
            </Typography>

            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: '16px',
                bgcolor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                mb: 1
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: colors.textPrimary, mb: 0.5 }}>
                Live Stream Access
              </Typography>
              <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2, fontSize: '0.84rem', lineHeight: 1.5 }}>
                Please enter the room at the scheduled time. Ensure your audio and internet connection are ready.
              </Typography>

              <Divider sx={{ mb: 1.75 }} />

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 600 }}>
                    Webinar Date:
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: colors.textPrimary, fontSize: '0.8rem' }}>
                    {formatDate(joinModalWebinar.webinarDate)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 600 }}>
                    Time Window:
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: colors.textPrimary, fontSize: '0.8rem' }}>
                    {formatTime(joinModalWebinar.startTime)} - {formatTime(joinModalWebinar.endTime)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 600 }}>
                    Share ID:
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 700,
                      color: '#0F172A',
                      fontFamily: 'monospace',
                      bgcolor: '#E2E8F0',
                      px: 1,
                      py: 0.25,
                      borderRadius: '6px'
                    }}
                  >
                    {joinModalWebinar.shareId}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </DialogContent>

          <DialogActions
            sx={{
              px: { xs: 2.5, sm: 3.5 },
              pb: 3,
              pt: 1,
              gap: 1,
              flexWrap: 'wrap',
              justifyContent: 'flex-end'
            }}
          >
            <Button
              variant="outlined"
              onClick={() => setJoinModalWebinar(null)}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: '10px',
                borderColor: colors.border,
                color: colors.textSecondary
              }}
            >
              Close
            </Button>

            {!isWebinarStartTimePast(joinModalWebinar.startTime) && (
              <Button
                variant="contained"
                startIcon={<EventIcon />}
                onClick={() => handleAddToCalendar(joinModalWebinar)}
                sx={{
                  bgcolor: '#F1F5F9',
                  color: '#0F172A',
                  border: '1px solid #CBD5E1',
                  fontWeight: 700,
                  textTransform: 'none',
                  borderRadius: '10px',
                  boxShadow: 'none',
                  '&:hover': { bgcolor: '#E2E8F0', boxShadow: 'none' }
                }}
              >
                Add to Calendar
              </Button>
            )}

            <Button
              variant="contained"
              startIcon={<VideoCameraFrontIcon />}
              onClick={() => {
                toast.success('Connecting to webinar room...');
                window.open(`${window.location.origin}/register?trackingId=${joinModalWebinar.shareId}`, '_blank');
              }}
              sx={{
                bgcolor: '#EA580C',
                color: '#FFFFFF',
                fontWeight: 700,
                textTransform: 'none',
                px: 2.5,
                borderRadius: '10px',
                boxShadow: '0 6px 16px rgba(234, 88, 12, 0.28)',
                '&:hover': { bgcolor: '#C2410C', boxShadow: '0 8px 20px rgba(234, 88, 12, 0.38)' }
              }}
            >
              Enter Meeting Room
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}















