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
      {/* ── Banner Header Section ─────────────────────────────────── */}
      <Box
        sx={{
          mb: 2.5,
          px: { xs: 2.5, sm: 3.5 },
          py: { xs: 2.5, sm: 3 },
          borderRadius: '24px',
          background: 'linear-gradient(135deg, #052E16 0%, #064E3B 60%, #047857 100%)',
          color: '#FFFFFF',
          boxShadow: '0 12px 28px rgba(6, 78, 59, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: '16px',
              bgcolor: '#10B981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 16px rgba(16, 185, 129, 0.3)'
            }}
          >
            <BookmarkAddedIcon sx={{ color: '#FFFFFF', fontSize: 28 }} />
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.5px' }}>
                Registered Webinars
              </Typography>
             
            </Box>
            <Typography variant="body2" sx={{ color: '#D1FAE5', fontWeight: 400, mt: 0.2 }}>
              Your scheduled video workshops, live links, and attendance details.
            </Typography>
          </Box>
        </Box>

        {/* Quick Metrics */}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <Paper
            elevation={0}
            sx={{
              px: 2,
              py: 1,
              borderRadius: '14px',
              bgcolor: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#A7F3D0', textTransform: 'uppercase', fontSize: '0.68rem' }}>
              Enrolled
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#FFFFFF', lineHeight: 1 }}>
              {stats.total}
            </Typography>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              px: 2,
              py: 1,
              borderRadius: '14px',
              bgcolor: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#34D399', textTransform: 'uppercase', fontSize: '0.68rem' }}>
              Upcoming
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#34D399', lineHeight: 1 }}>
              {stats.upcoming}
            </Typography>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              px: 2,
              py: 1,
              borderRadius: '14px',
              bgcolor: 'rgba(16, 185, 129, 0.25)',
              border: '1px solid rgba(52, 211, 153, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#E6F4EA', textTransform: 'uppercase', fontSize: '0.68rem' }}>
              Total Hours
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#FFFFFF', lineHeight: 1 }}>
              {stats.hours}h
            </Typography>
          </Paper>
        </Box>
      </Box>

      {/* ── Toolbar: Search & Chips ──────────────────────────────── */}
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          mb: 3,
          borderRadius: '16px',
          bgcolor: colors.surface,
          border: `1px solid ${colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1.5
        }}
      >
        <CustomSearchBar
          value={search}
          onChange={(val) => setSearch(val)}
          placeholder="Search registered sessions..."
          maxWidth={380}
          sx={{ flexGrow: 1 }}
        />

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <FilterListIcon sx={{ color: colors.textSecondary, fontSize: 18 }} />
          {[
            { id: 'ALL', label: `All (${webinars.length})` },
            { id: 'UPCOMING', label: `Upcoming (${stats.upcoming})` },
            { id: 'PAST', label: `Completed (${stats.completed})` }
          ].map((p) => (
            <Chip
              key={p.id}
              label={p.label}
              size="small"
              clickable
              onClick={() => setStatusFilter(p.id)}
              sx={{
                fontWeight: statusFilter === p.id ? 800 : 600,
                fontSize: '0.78rem',
                height: 32,
                borderRadius: '10px',
                bgcolor: statusFilter === p.id ? '#059669' : '#F0FDF4',
                color: statusFilter === p.id ? '#FFFFFF' : '#166534',
                border: '1px solid #BBF7D0',
                '&:hover': {
                  bgcolor: statusFilter === p.id ? '#047857' : '#DCFCE7'
                }
              }}
            />
          ))}
        </Box>
      </Paper>

      {/* ── Grid Content / Empty State ───────────────────────────── */}
      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 10, gap: 1.5 }}>
          <CircularProgress size={38} sx={{ color: '#059669' }} />
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
            bgcolor: '#F0FDF4',
            border: '2px dashed #86EFAC'
          }}
        >
          <BookmarkAddedIcon sx={{ fontSize: 54, color: '#10B981', mb: 1, opacity: 0.8 }} />
          <Typography variant="h6" sx={{ fontWeight: 800, color: '#064E3B', mb: 0.5 }}>
            {webinars.length === 0 ? "You haven't registered for any webinars yet" : 'No sessions match your search'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#047857', maxWidth: 440, mx: 'auto', mb: 2.5 }}>
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
                bgcolor: '#059669',
                color: '#FFFFFF',
                fontWeight: 800,
                textTransform: 'none',
                px: 3.5,
                py: 1,
                borderRadius: '12px',
                boxShadow: '0 6px 16px rgba(5, 150, 105, 0.25)',
                '&:hover': { bgcolor: '#047857' }
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
              sx={{ borderColor: '#059669', color: '#059669', fontWeight: 700, borderRadius: '10px' }}
            >
              Reset Filters
            </Button>
          )}
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {filteredWebinars.map((w) => {
            const timing = getWebinarTimingStatus(w.webinarDate, w.startTime);
            const isCompleted = timing.type === 'PAST';

            return (
              <Grid item xs={12} md={6} lg={4} key={w.id} sx={{ display: 'flex' }}>
                {/* 
                   Card Design: Light green container tint, rounded green full border, 
                   top bar with category & free badge, speaker info container, schedule block & primary action button.
                */}
                <Paper
                  elevation={0}
                  sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: '24px',
                    bgcolor: '#F2FAF5',
                    border: '1.5px solid #80E3A7',
                    p: 2.2,
                    position: 'relative',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 4px 14px rgba(6, 78, 59, 0.04)',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 12px 28px rgba(6, 78, 59, 0.12)',
                      borderColor: '#10B981'
                    }
                  }}
                >
                  {/* Top Bar: Category Tag, FREE / Status Badge & Share button */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Chip
                      label={w.categoryName || 'Artificial Intelligence'}
                      size="small"
                      sx={{
                        bgcolor: '#D1F4E0',
                        color: '#114D2D',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        height: 28,
                        borderRadius: '8px',
                        px: 0.5
                      }}
                    />

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                      <Chip
                        label={w.price ? `$${w.price}` : 'FREE'}
                        size="small"
                        sx={{
                          bgcolor: '#DCFCE7',
                          color: '#0F766E',
                          fontWeight: 800,
                          fontSize: '0.72rem',
                          height: 26,
                          borderRadius: '8px',
                          border: '1px solid #86EFAC'
                        }}
                      />

                      <Tooltip title="Share Link">
                        <IconButton
                          size="small"
                          onClick={(e) => handleCopyLink(w.shareId, e)}
                          sx={{
                            bgcolor: '#E2F7EB',
                            color: '#15803D',
                            p: 0.8,
                            borderRadius: '8px',
                            '&:hover': { bgcolor: '#C6F0D6' }
                          }}
                        >
                          <ShareIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  {/* Seat Reserved Line */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1 }}>
                    <CheckCircleIcon sx={{ color: '#059669', fontSize: 18 }} />
                    <Typography
                      variant="caption"
                      sx={{ color: '#047857', fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', fontSize: '0.72rem' }}
                    >
                      SEAT RESERVED • ENROLLED
                    </Typography>
                  </Box>

                  {/* Title */}
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 700,
                      color: '#0B291A',
                      mb: 2,
                      lineHeight: 1.3,
                      fontSize: '1.05rem',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      minHeight: 48
                    }}
                  >
                    {w.webinarName}
                  </Typography>

                  {/* Speaker Block */}
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      borderRadius: '16px',
                      bgcolor: '#E9F7EF',
                      border: '1px solid #D1F0DD',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      mb: 1.8
                    }}
                  >
                    <Avatar
                      sx={{
                        width: 42,
                        height: 42,
                        bgcolor: '#111827',
                        color: '#FACC15',
                        fontWeight: 800,
                        fontSize: '1.05rem'
                      }}
                    >
                      {w.conductorName?.charAt(0) || 'L'}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#0F172A', lineHeight: 1.2, fontSize: '0.92rem' }}>
                        {w.conductorName || 'Instructor'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#4B5563', fontWeight: 500, fontSize: '0.75rem' }}>
                        Speaker & Host
                      </Typography>
                    </Box>
                  </Paper>

                  {/* Schedule Block */}
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.8,
                      borderRadius: '16px',
                      bgcolor: '#F6FAF8',
                      border: '1px solid #E2EDE7',
                      mb: 2.5,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                      <CalendarMonthIcon sx={{ fontSize: 18, color: '#374151' }} />
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#1F2937', fontSize: '0.88rem' }}>
                        {formatDate(w.webinarDate)}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                      <AccessTimeIcon sx={{ fontSize: 18, color: '#D97706' }} />
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#374151', fontSize: '0.82rem' }}>
                        {formatTime(w.startTime)} – {formatTime(w.endTime)} • {fmtDuration(w.durationMinutes)}
                      </Typography>
                    </Box>
                  </Paper>

                  {/* Action Buttons Footer */}
                  <Box sx={{ mt: 'auto', display: 'flex', gap: 1.2, alignItems: 'center' }}>
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={isCompleted ? undefined : <CheckCircleIcon sx={{ fontSize: '18px !important' }} />}
                      onClick={() => setJoinModalWebinar(w)}
                      sx={{
                        bgcolor: isCompleted ? '#475569' : '#059669',
                        color: '#FFFFFF',
                        fontWeight: 800,
                        fontSize: '0.88rem',
                        textTransform: 'none',
                        py: 1.2,
                        borderRadius: '12px',
                        boxShadow: 'none',
                        '&:hover': {
                          bgcolor: isCompleted ? '#334155' : '#047857'
                        }
                      }}
                    >
                      {isCompleted ? 'View Session' : 'View in Registered'}
                    </Button>

                    <Button
                      variant="outlined"
                      onClick={() => setJoinModalWebinar(w)}
                      sx={{
                        px: 2.5,
                        py: 1.1,
                        borderRadius: '12px',
                        borderColor: '#9CA3AF',
                        color: '#111827',
                        fontWeight: 700,
                        textTransform: 'none',
                        fontSize: '0.85rem',
                        whiteSpace: 'nowrap',
                        '&:hover': { borderColor: '#111827', bgcolor: '#F3F4F6' }
                      }}
                    >
                      Details
                    </Button>

                    <Tooltip title="Add to Google Calendar">
                      <IconButton
                        onClick={() => handleAddToCalendar(w)}
                        sx={{
                          p: 1.1,
                          borderRadius: '12px',
                          border: '1px solid #D1D5DB',
                          color: '#374151',
                          '&:hover': { bgcolor: '#F3F4F6', color: '#059669' }
                        }}
                      >
                        <EventIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Paper>
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
                bgcolor: '#059669',
                color: '#FFFFFF',
                fontWeight: 700,
                textTransform: 'none',
                px: 3,
                borderRadius: '10px',
                boxShadow: 'none',
                '&:hover': { bgcolor: '#047857' }
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