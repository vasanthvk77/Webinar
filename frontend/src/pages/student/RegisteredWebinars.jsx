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
import { webinarService }   from '../../services/api';
import { useAuth }          from '../../context/AuthContext';
import { useThemeColors }   from '../../context/ThemeContext';
import CustomSearchBar      from '../../components/CustomSearchBar';

// Helper: Format Date
const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

// Helper: Format Time (12-hour AM/PM)
const formatTime = (timeStr) => {
  if (!timeStr) return '—';
  try {
    const d = new Date(timeStr);
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return timeStr;
  }
};

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
  const handleAddToCalendar = (w) => {
    try {
      const start = new Date(w.startTime).toISOString().replace(/-|:|\.\d\d\d/g, "");
      const end = new Date(w.endTime).toISOString().replace(/-|:|\.\d\d\d/g, "");
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
        overflow: 'hidden',
        maxWidth: 1600,
        mx: 'auto',
        width: '100%'
      }}
    >
      {/* ── Top Hero Box (Tempting Student Learning Hub Banner) ──────────────── */}
      <Box
        sx={{
          mb: 2.5,
          px: { xs: 2.5, sm: 4 },
          py: { xs: 2.75, sm: 3.25 },
          borderRadius: '20px',
          background: 'radial-gradient(circle at 90% 15%, rgba(242,183,5,0.25) 0%, transparent 40%), radial-gradient(circle at 15% 90%, rgba(56,189,248,0.12) 0%, transparent 35%), linear-gradient(125deg, #0F172A 0%, #1E293B 60%, #172554 100%)',
          color: '#FFFFFF',
          boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.28)',
          border: '1px solid rgba(255,255,255,0.1)',
          position: 'relative',
          overflow: 'hidden',
          '&:before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 6,
            background: 'linear-gradient(180deg, #FDE047 0%, #F2B705 50%, #D97706 100%)',
          },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2.5,
          flexShrink: 0,
        }}
      >
        {/* Left Title & Description */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.25 }}>
          <Box
            sx={{
              width: 60,
              height: 60,
              borderRadius: '18px',
              background: 'linear-gradient(135deg, #FDE047 0%, #F2B705 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 10px 25px rgba(242,183,5,0.35)',
              flexShrink: 0,
            }}
          >
            <BookmarkAddedIcon sx={{ color: '#0F172A', fontSize: 32 }} />
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap', mb: 0.5 }}>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 800,
                  color: '#FFFFFF',
                  letterSpacing: '-0.5px',
                  lineHeight: 1.2,
                  fontSize: { xs: '1.35rem', sm: '1.6rem' }
                }}
              >
                Registered Webinars
              </Typography>
            
            </Box>
            <Typography
              variant="body2"
              sx={{
                color: 'rgba(255,255,255,0.78)',
                fontWeight: 400,
                fontSize: { xs: '0.85rem', sm: '0.92rem' },
                maxWidth: 560,
              }}
            >
              Your enrolled sessions schedule, live meeting rooms, and calendar reminders in one place.
            </Typography>
          </Box>
        </Box>

        {/* Right Quick Stats Cards inside Banner */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(110px, 1fr))',
            gap: 1.5,
            width: { xs: '100%', md: 'auto' },
          }}
        >
          <Paper
            elevation={0}
            sx={{
              px: 2.25,
              py: 1.25,
              borderRadius: '14px',
              bgcolor: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.12)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: { xs: 'center', md: 'flex-start' },
              transition: 'transform 0.2s ease',
              '&:hover': { transform: 'translateY(-2px)', bgcolor: 'rgba(255,255,255,0.09)' }
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: 'rgba(255,255,255,0.65)',
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                fontSize: '0.65rem',
                mb: 0.25
              }}
            >
              Total Enrolled
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#FFFFFF', lineHeight: 1.1 }}>
              {stats.total}
            </Typography>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              px: 2.25,
              py: 1.25,
              borderRadius: '14px',
              bgcolor: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.12)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: { xs: 'center', md: 'flex-start' },
              transition: 'transform 0.2s ease',
              '&:hover': { transform: 'translateY(-2px)', bgcolor: 'rgba(255,255,255,0.09)' }
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: '#FDE047',
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                fontSize: '0.65rem',
                mb: 0.25
              }}
            >
              Upcoming
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#FDE047', lineHeight: 1.1 }}>
              {stats.upcoming}
            </Typography>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              px: 2.25,
              py: 1.25,
              borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(242,183,5,0.22) 0%, rgba(242,183,5,0.08) 100%)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(242,183,5,0.35)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: { xs: 'center', md: 'flex-start' },
              transition: 'transform 0.2s ease',
              '&:hover': { transform: 'translateY(-2px)' }
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: '#FDE047',
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                fontSize: '0.65rem',
                mb: 0.25
              }}
            >
              Learning Hours
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#FFFFFF', lineHeight: 1.1 }}>
              {stats.hours}h
            </Typography>
          </Paper>
        </Box>
      </Box>

      {/* ── Sleek Filter & Search Toolbar ──────────────────────────────────── */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 1.5, sm: 1.75 },
          mb: 2.5,
          borderRadius: '16px',
          bgcolor: colors.surface,
          border: `1px solid ${colors.border}`,
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
          flexShrink: 0,
        }}
      >
        <Box sx={{ flexGrow: 1, minWidth: { xs: '100%', sm: 280 }, maxWidth: { xs: '100%', sm: 420 } }}>
          <CustomSearchBar
            value={search}
            onChange={(val) => setSearch(val)}
            placeholder="Search by session title, instructor, or topic..."
            maxWidth="100%"
            sx={{ width: '100%' }}
          />
        </Box>

        <Box
          sx={{
            display: 'flex',
            gap: 1,
            alignItems: 'center',
            flexWrap: 'wrap',
            width: { xs: '100%', sm: 'auto' },
            justifyContent: { xs: 'flex-start', sm: 'flex-end' }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mr: 0.5, color: colors.textSecondary }}>
            <FilterListIcon sx={{ fontSize: 18 }} />
            <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: { xs: 'none', md: 'inline' } }}>
              Filter:
            </Typography>
          </Box>
          {[
            { id: 'ALL', label: `All (${webinars.length})` },
            { id: 'UPCOMING', label: `Upcoming (${stats.upcoming})` },
            { id: 'PAST', label: `Completed (${stats.completed})` },
          ].map(p => {
            const active = statusFilter === p.id;
            return (
              <Chip
                key={p.id}
                label={p.label}
                size="small"
                clickable
                onClick={() => setStatusFilter(p.id)}
                sx={{
                  fontWeight: active ? 800 : 600,
                  fontSize: '0.78rem',
                  height: 34,
                  px: 0.8,
                  borderRadius: '10px',
                  bgcolor: active ? '#F2B705' : colors.surfaceAlt,
                  color: active ? '#0F172A' : colors.textSecondary,
                  border: `1px solid ${active ? '#EAB308' : colors.border}`,
                  boxShadow: active ? '0 4px 12px rgba(242,183,5,0.28)' : 'none',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: active ? '#EAB308' : colors.surfaceAlt,
                    borderColor: active ? '#CA8A04' : colors.textSecondary,
                  }
                }}
              />
            );
          })}
        </Box>
      </Paper>

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
            <CircularProgress size={42} thickness={4.5} sx={{ color: '#F2B705' }} />
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
              bgcolor: colors.surface,
              border: `1px dashed ${colors.border}`,
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
                bgcolor: 'rgba(242,183,5,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
              }}
            >
              <BookmarkAddedIcon sx={{ fontSize: 36, color: '#D97706' }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 800, color: colors.textPrimary, mb: 0.75 }}>
              {webinars.length === 0 ? "You haven't registered for any webinars yet" : "No sessions match your filter"}
            </Typography>
            <Typography variant="body2" sx={{ color: colors.textSecondary, maxWidth: 420, mx: 'auto', mb: 3, lineHeight: 1.6 }}>
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
                  bgcolor: '#F2B705',
                  color: '#0F172A',
                  fontWeight: 800,
                  textTransform: 'none',
                  px: 3.5,
                  py: 1.1,
                  borderRadius: '12px',
                  boxShadow: '0 6px 16px rgba(242,183,5,0.3)',
                  '&:hover': { bgcolor: '#DDA600', boxShadow: '0 8px 22px rgba(242,183,5,0.4)' }
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
                  color: '#0F172A',
                  borderColor: '#F2B705',
                  bgcolor: '#F2B705',
                  fontWeight: 700,
                  textTransform: 'none',
                  borderRadius: '10px',
                  px: 3,
                  '&:hover': { bgcolor: '#DDA600', borderColor: '#DDA600' }
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
              const isToday = timing.type === 'TODAY';

              return (
                <Grid item xs={12} md={6} lg={4} key={w.id} sx={{ display: 'flex' }}>
                  <Paper
                    elevation={0}
                    sx={{
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      borderRadius: '20px',
                      bgcolor: colors.surface,
                      border: isToday
                        ? '1.5px solid rgba(245, 158, 11, 0.55)'
                        : `1px solid ${colors.border || 'rgba(15, 23, 42, 0.08)'}`,
                      background: isToday
                        ? 'linear-gradient(180deg, #FFFDF5 0%, #FFFFFF 100%)'
                        : 'linear-gradient(180deg, #FFFFFF 0%, #FAFBFD 100%)',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      overflow: 'hidden',
                      position: 'relative',
                      boxShadow: isToday
                        ? '0 10px 28px rgba(245, 158, 11, 0.12)'
                        : '0 6px 20px rgba(15, 23, 42, 0.05)',
                      '&:hover': {
                        transform: 'translateY(-5px)',
                        boxShadow: '0 20px 38px rgba(15, 23, 42, 0.12)',
                        borderColor: isCompleted ? colors.border : '#F2B705',
                      }
                    }}
                  >
                    {/* Top Accent Strip */}
                    <Box
                      sx={{
                        height: 4,
                        width: '100%',
                        background: isToday
                          ? 'linear-gradient(90deg, #F59E0B 0%, #FDE047 100%)'
                          : isCompleted
                          ? '#CBD5E1'
                          : 'linear-gradient(90deg, #1E293B 0%, #3B82F6 100%)',
                      }}
                    />

                    {/* Card Header Bar */}
                    <Box
                      sx={{
                        px: 2.5,
                        py: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                        bgcolor: isToday ? 'rgba(254, 243, 199, 0.55)' : colors.surfaceAlt,
                        borderBottom: `1px solid ${colors.border || 'rgba(15,23,42,0.06)'}`,
                      }}
                    >
                      <Chip
                        label={w.categoryName || 'General'}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          height: 25,
                          borderRadius: '8px',
                          bgcolor: 'rgba(15, 23, 42, 0.07)',
                          color: colors.primary || '#0F172A',
                          maxWidth: '55%',
                        }}
                      />

                      <Chip
                        label={timing.label}
                        size="small"
                        sx={{
                          fontWeight: 800,
                          fontSize: '0.72rem',
                          height: 25,
                          borderRadius: '8px',
                          bgcolor: isToday ? '#FEF3C7' : (isCompleted ? '#F1F5F9' : '#EFF6FF'),
                          color: isToday ? '#B45309' : (isCompleted ? '#64748B' : '#1D4ED8'),
                          border: `1px solid ${isToday ? '#F59E0B' : (isCompleted ? '#CBD5E1' : '#BFDBFE')}`,
                        }}
                      />
                    </Box>

                    {/* Card Body Content */}
                    <Box
                      sx={{
                        p: 2.5,
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      {/* Top Content Group */}
                      <Box>
                        {/* Registered Date Tag */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.25 }}>
                          <CheckCircleIcon sx={{ color: '#16A34A', fontSize: 16 }} />
                          <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 600, fontSize: '0.74rem' }}>
                            Enrolled on {formatDate(w.registeredAt || w.createdAt)}
                          </Typography>
                        </Box>

                        {/* Webinar Title (Fixed 2-line height for strict card alignment) */}
                        <Typography
                          variant="subtitle1"
                          title={w.webinarName}
                          sx={{
                            fontWeight: 700,
                            color: colors.textPrimary,
                            mb: 2,
                            lineHeight: 1.35,
                            fontSize: '1.15rem',
                            letterSpacing: '-0.25px',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            minHeight: '2.7em',
                          }}
                        >
                          {w.webinarName}
                        </Typography>

                        {/* Conductor Profile Pill */}
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            mb: 2,
                            p: 1.25,
                            borderRadius: '12px',
                            bgcolor: 'rgba(15, 23, 42, 0.025)',
                            border: '1px solid rgba(15, 23, 42, 0.05)',
                          }}
                        >
                          <Avatar
                            sx={{
                              width: 40,
                              height: 40,
                              bgcolor: '#1E293B',
                              color: '#FDE047',
                              fontSize: '0.95rem',
                              fontWeight: 800,
                              flexShrink: 0,
                            }}
                          >
                            {w.conductorName?.charAt(0)?.toUpperCase() || 'S'}
                          </Avatar>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography
                              variant="body2"
                              noWrap
                              sx={{ fontWeight: 700, color: colors.textPrimary, fontSize: '0.86rem', lineHeight: 1.2 }}
                            >
                              {w.conductorName}
                            </Typography>
                            <Typography
                              variant="caption"
                              noWrap
                              sx={{ color: colors.textSecondary, fontSize: '0.72rem', display: 'block' }}
                            >
                              Session Instructor
                            </Typography>
                          </Box>
                        </Box>

                        {/* Schedule Ticket Block */}
                        <Box
                          sx={{
                            bgcolor: '#F8FAFC',
                            p: 1.5,
                            borderRadius: '12px',
                            border: '1px solid #E2E8F0',
                            mb: 2.5,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 0.75,
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CalendarMonthIcon sx={{ fontSize: 17, color: '#0F172A', opacity: 0.75 }} />
                            <Typography variant="body2" sx={{ fontWeight: 700, color: colors.textPrimary, fontSize: '0.84rem' }}>
                              {formatDate(w.webinarDate)}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AccessTimeIcon sx={{ fontSize: 17, color: '#D97706' }} />
                            <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 600, fontSize: '0.78rem' }}>
                              {formatTime(w.startTime)} – {formatTime(w.endTime)} • {fmtDuration(w.durationMinutes)}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>

                      {/* Bottom Action Bar (Uniformly Aligned Across All Cards) */}
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', pt: 0.5 }}>
                        {isCompleted ? (
                          <Button
                            fullWidth
                            variant="outlined"
                            onClick={() => setJoinModalWebinar(w)}
                            sx={{
                              height: 40,
                              fontWeight: 700,
                              fontSize: '0.82rem',
                              textTransform: 'none',
                              borderRadius: '10px',
                              borderColor: '#CBD5E1',
                              color: colors.textSecondary,
                              '&:hover': {
                                borderColor: colors.textPrimary,
                                color: colors.textPrimary,
                                bgcolor: 'rgba(15, 23, 42, 0.03)'
                              }
                            }}
                          >
                            Session Details
                          </Button>
                        ) : (
                          <Button
                            fullWidth
                            variant="contained"
                            startIcon={<VideoCameraFrontIcon sx={{ fontSize: '18px !important' }} />}
                            onClick={() => setJoinModalWebinar(w)}
                            sx={{
                              height: 40,
                              fontWeight: 800,
                              fontSize: '0.84rem',
                              bgcolor: '#F2B705',
                              color: '#0F172A',
                              textTransform: 'none',
                              borderRadius: '10px',
                              boxShadow: '0 4px 12px rgba(242, 183, 5, 0.25)',
                              '&:hover': {
                                bgcolor: '#EAB308',
                                boxShadow: '0 6px 16px rgba(242, 183, 5, 0.4)'
                              }
                            }}
                          >
                            Join Webinar
                          </Button>
                        )}

                        <Tooltip title="Add to Google Calendar" arrow>
                          <IconButton
                            onClick={() => handleAddToCalendar(w)}
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: '10px',
                              bgcolor: '#F1F5F9',
                              border: '1px solid #E2E8F0',
                              color: '#475569',
                              flexShrink: 0,
                              transition: 'all 0.2s',
                              '&:hover': {
                                color: '#0F172A',
                                bgcolor: '#FEF08A',
                                borderColor: '#FACC15'
                              }
                            }}
                          >
                            <EventIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Copy Share Link" arrow>
                          <IconButton
                            onClick={(e) => handleCopyLink(w.shareId, e)}
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: '10px',
                              bgcolor: '#F1F5F9',
                              border: '1px solid #E2E8F0',
                              color: '#475569',
                              flexShrink: 0,
                              transition: 'all 0.2s',
                              '&:hover': {
                                color: '#0F172A',
                                bgcolor: '#FEF08A',
                                borderColor: '#FACC15'
                              }
                            }}
                          >
                            <ShareIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </Paper>
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

            <Button
              variant="contained"
              startIcon={<VideoCameraFrontIcon />}
              onClick={() => {
                toast.success('Connecting to webinar room...');
                window.open(`${window.location.origin}/register?trackingId=${joinModalWebinar.shareId}`, '_blank');
              }}
              sx={{
                bgcolor: '#F2B705',
                color: '#0F172A',
                fontWeight: 700,
                textTransform: 'none',
                px: 2.5,
                borderRadius: '10px',
                boxShadow: '0 6px 16px rgba(242,183,5,0.3)',
                '&:hover': { bgcolor: '#DDA600', boxShadow: '0 8px 20px rgba(242,183,5,0.4)' }
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















