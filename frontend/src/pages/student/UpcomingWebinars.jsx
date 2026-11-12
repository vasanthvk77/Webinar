import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Avatar,
  Dialog,
  DialogContent,
  DialogActions
} from '@mui/material';

import BookmarkAddedIcon from '@mui/icons-material/BookmarkAdded';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ShareIcon from '@mui/icons-material/Share';
import EventIcon from '@mui/icons-material/Event';
import VideoCameraFrontIcon from '@mui/icons-material/VideoCameraFront';
import FilterListIcon from '@mui/icons-material/FilterList';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SchoolIcon from '@mui/icons-material/School';
import toast from 'react-hot-toast';

import { webinarService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useThemeColors } from '../../context/ThemeContext';
import CustomSearchBar from '../../components/CustomSearchBar';
import CardComponent, { WebinarPageHeader } from '../../components/CardComponent';
import { BookOpen, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { formatUtcToLocalDateOnly, formatUtcToLocalTimeOnly } from '../../utils/validation';

const formatDate = (dateStr) => formatUtcToLocalDateOnly(dateStr);

const formatTime = (timeStr) => formatUtcToLocalTimeOnly(timeStr);

const fmtDuration = (mins) => {
  if (!mins || mins <= 0) return '—';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

const getWebinarTimingStatus = (webinarDate, startTime) => {
  if (!webinarDate) return { label: 'Scheduled', type: 'UPCOMING' };
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
  const colors = useThemeColors();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [webinars, setWebinars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [joinModalWebinar, setJoinModalWebinar] = useState(null);

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

  const filteredWebinars = useMemo(() => {
    return webinars.filter((item) => {
      const timing = getWebinarTimingStatus(item.webinarDate, item.startTime);
      if (statusFilter === 'UPCOMING' && timing.type === 'PAST') return false;
      if (statusFilter === 'PAST' && timing.type !== 'PAST') return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = item.webinarName?.toLowerCase().includes(q);
        const matchesCond = item.conductorName?.toLowerCase().includes(q);
        const matchesCat = item.categoryName?.toLowerCase().includes(q);
        if (!matchesName && !matchesCond && !matchesCat) return false;
      }
      return true;
    });
  }, [webinars, statusFilter, search]);

  const stats = useMemo(() => {
    const total = webinars.length;
    let upcoming = 0;
    let completed = 0;
    let totalMinutes = 0;

    webinars.forEach((w) => {
      const timing = getWebinarTimingStatus(w.webinarDate, w.startTime);
      if (timing.type === 'PAST') completed++;
      else upcoming++;
      totalMinutes += w.durationMinutes || 0;
    });

    const hours = (totalMinutes / 60).toFixed(1);
    return { total, upcoming, completed, hours };
  }, [webinars]);

  const handleCopyLink = (shareId, e) => {
    e?.stopPropagation();
    const url = `${window.location.origin}/register?trackingId=${shareId}`;
    navigator.clipboard.writeText(url);
    toast.success('Webinar link copied to clipboard!');
  };

  const handleAddToCalendar = (w) => {
    try {
      const start = new Date(w.startTime).toISOString().replace(/-|:|\.\d\d\d/g, '');
      const end = new Date(w.endTime).toISOString().replace(/-|:|\.\d\d\d/g, '');
      const title = encodeURIComponent(w.webinarName);
      const details = encodeURIComponent(`Webinar hosted by ${w.conductorName}.\nWebinar portal: ${window.location.origin}`);
      const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}`;
      window.open(gcalUrl, '_blank');
    } catch {
      toast.error('Could not generate calendar link');
    }
  };

  return (
    <Box
      sx={{
        minHeight: 'calc(100vh - 110px)',
        display: 'flex',
        flexDirection: 'column',
        maxWidth: 1600,
        mx: 'auto',
        p: { xs: 2, sm: 3 }
      }}
    >
      {/* ── Top Row Section: Dashboard Metrics & Controls ───────────── */}
      <WebinarPageHeader
        title="Upcoming Webinars"
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

      {/* ── Grid Content / Empty State ───────────────────────────── */}
      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 10, gap: 1.5 }}>
          <CircularProgress size={38} sx={{ color: '#EA580C' }} />
          <Typography variant="body2" sx={{ color: colors.textSecondary, fontWeight: 600 }}>
            Loading registered webinars...
          </Typography>
        </Box>
      ) : filteredWebinars.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            py: 7,
            px: 3,
            textAlign: 'center',
            borderRadius: '20px',
            bgcolor: '#FFF7ED',
            border: '2px dashed #FED7AA'
          }}
        >
          <BookmarkAddedIcon sx={{ fontSize: 54, color: '#EA580C', mb: 1, opacity: 0.85 }} />
          <Typography variant="h6" sx={{ fontWeight: 800, color: '#9A3412', mb: 0.5 }}>
            {webinars.length === 0 ? "You haven't registered for any webinars yet" : 'No sessions match your search'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#C2410C', maxWidth: 440, mx: 'auto', mb: 2.5 }}>
            {webinars.length === 0
              ? 'Discover upcoming live masterclasses and elevate your skills today!'
              : 'Try clearing your search keyword or switching status filters.'}
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
                py: 1,
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
              size="small"
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
              }}
              sx={{ borderColor: '#EA580C', color: '#EA580C', fontWeight: 700, borderRadius: '10px', '&:hover': { bgcolor: '#FFF7ED' } }}
            >
              Reset Filters
            </Button>
          )}
        </Paper>
      ) : (
        <Grid container spacing={3} alignItems="stretch">
          {filteredWebinars.map((w) => {
            const timing = getWebinarTimingStatus(w.webinarDate, w.startTime);
            const isCompleted = timing.type === 'PAST';

            return (
              <Grid item xs={12} lg={6} key={w.id} sx={{ display: 'flex' }}>
                <CardComponent
                  webinar={w}
                  type="upcoming"
                  statusLabel={isCompleted ? 'Completed' : timing.label}
                  price={w.isPaid ? (w.price ? `$${w.price}` : 'Paid') : 'Free'}
                  primaryLabel={isCompleted ? 'View Session' : 'Join Webinar'}
                  onPrimaryClick={() => setJoinModalWebinar(w)}
                  secondaryLabel="Details"
                  onSecondaryClick={() => setJoinModalWebinar(w)}
                  onCalendarClick={() => handleAddToCalendar(w)}
                  onShareClick={(e) => handleCopyLink(w.shareId, e)}
                />
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* ── Details & Join Dialog ────────────────────────────────── */}
      {joinModalWebinar && (
        <Dialog
          open={Boolean(joinModalWebinar)}
          onClose={() => setJoinModalWebinar(null)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: '24px',
              p: 1,
              bgcolor: '#FFFFFF'
            }
          }}
        >
          <DialogContent sx={{ pt: 2.5, px: { xs: 2.5, sm: 3.5 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Chip
                label={joinModalWebinar.categoryName || 'Workshop'}
                size="small"
                sx={{ bgcolor: '#DCFCE7', color: '#166534', fontWeight: 700 }}
              />
              <Chip label="SEAT RESERVED" size="small" sx={{ fontWeight: 800, bgcolor: '#10B981', color: '#FFFFFF' }} />
            </Box>

            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F172A', mb: 1.5, letterSpacing: '-0.4px' }}>
              {joinModalWebinar.webinarName}
            </Typography>

            <Typography variant="body2" sx={{ color: '#475569', mb: 2.5 }}>
              Hosted by <strong>{joinModalWebinar.conductorName}</strong> ({joinModalWebinar.conductorEmail || 'Host Instructor'})
            </Typography>

            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: '16px',
                bgcolor: '#F0FDF4',
                border: '1px solid #BBF7D0',
                mb: 2.5
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#064E3B', mb: 1 }}>
                Live Room Information
              </Typography>
              <Typography variant="body2" sx={{ color: '#047857', mb: 2, fontSize: '0.85rem' }}>
                Connect to the live webinar room at the scheduled date and time.
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" sx={{ color: '#047857', fontWeight: 600 }}>Webinar Date:</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#064E3B' }}>
                    {formatDate(joinModalWebinar.webinarDate)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" sx={{ color: '#047857', fontWeight: 600 }}>Time Window:</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#064E3B' }}>
                    {formatTime(joinModalWebinar.startTime)} - {formatTime(joinModalWebinar.endTime)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" sx={{ color: '#047857', fontWeight: 600 }}>Share Reference ID:</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#064E3B', fontFamily: 'monospace' }}>
                    {joinModalWebinar.shareId}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </DialogContent>

          <DialogActions sx={{ px: 3.5, pb: 2.5, gap: 1 }}>
            <Button
              variant="outlined"
              onClick={() => setJoinModalWebinar(null)}
              sx={{ textTransform: 'none', fontWeight: 700, borderColor: '#CBD5E1', color: '#475569', borderRadius: '10px' }}
            >
              Close
            </Button>

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
                px: 3,
                borderRadius: '10px',
                boxShadow: 'none',
                '&:hover': { bgcolor: '#C2410C' }
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