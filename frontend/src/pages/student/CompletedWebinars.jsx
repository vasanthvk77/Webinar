import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, Grid, Chip, IconButton,
  Tooltip, CircularProgress, Divider, Avatar
} from '@mui/material';
import CheckCircleIcon       from '@mui/icons-material/CheckCircle';
import WorkspacePremiumIcon  from '@mui/icons-material/WorkspacePremium';
import CalendarMonthIcon     from '@mui/icons-material/CalendarMonth';
import AccessTimeIcon        from '@mui/icons-material/AccessTime';
import DownloadIcon          from '@mui/icons-material/Download';
import FilterListIcon        from '@mui/icons-material/FilterList';
import ArrowForwardIcon      from '@mui/icons-material/ArrowForward';
import TimerIcon             from '@mui/icons-material/Timer';
import toast                 from 'react-hot-toast';

import { webinarService }    from '../../services/api';
import { useAuth }           from '../../context/AuthContext';
import { useThemeColors }    from '../../context/ThemeContext';
import CustomSearchBar       from '../../components/CustomSearchBar';

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

// Helper: Format Duration (Seconds to mins/hrs)
const fmtAttendedDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '0 min';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

export default function CompletedWebinars() {
  const colors   = useThemeColors();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [webinars, setWebinars]          = useState([]);
  const [loading, setLoading]            = useState(true);
  const [search, setSearch]              = useState('');
  const [filterType, setFilterType]    = useState('ALL'); // 'ALL' | 'CERTIFIED' | 'NO_CERT'
  const [downloadingId, setDownloadingId] = useState(null);

  // Load completed webinars
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await webinarService.getCompleted();
      if (res.data?.success) {
        setWebinars(res.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching completed webinars:', err);
      toast.error('Failed to load completed webinars');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered webinars
  const filteredWebinars = useMemo(() => {
    return webinars.filter((item) => {
      if (filterType === 'CERTIFIED' && !item.canDownloadCertificate) return false;
      if (filterType === 'NO_CERT' && item.canDownloadCertificate) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = item.webinarName?.toLowerCase().includes(q);
        const matchesCond = item.conductorName?.toLowerCase().includes(q);
        const matchesCat  = item.categoryName?.toLowerCase().includes(q);
        if (!matchesName && !matchesCond && !matchesCat) return false;
      }
      return true;
    });
  }, [webinars, filterType, search]);

  // Statistics
  const stats = useMemo(() => {
    const total = webinars.length;
    const certified = webinars.filter(w => w.canDownloadCertificate).length;
    const totalSeconds = webinars.reduce((acc, w) => acc + (w.attendedDuration || 0), 0);
    const hours = (totalSeconds / 3600).toFixed(1);
    return { total, certified, hours };
  }, [webinars]);

  // Trigger blob download
  const triggerBlobDownload = (blobData, filename) => {
    const url = window.URL.createObjectURL(new Blob([blobData], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  // Download Certificate PDF
  const handleDownloadCertificate = async (webinar) => {
    setDownloadingId(webinar.webinarId);
    try {
      const res = await webinarService.downloadStudentCertificate(webinar.webinarId);
      const safeName = (webinar.webinarName || 'Webinar').replace(/[^a-zA-Z0-9]/g, '_');
      triggerBlobDownload(res.data, `${safeName}-Certificate.pdf`);
      toast.success('Certificate downloaded successfully! 🎓');
    } catch (err) {
      console.error('Error downloading certificate:', err);
      toast.error('Failed to download certificate');
    } finally {
      setDownloadingId(null);
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
        bgcolor: 'transparent',
        mx: 'auto',
        width: '100%'
      }}
    >
      {/* ── Top Hero Banner (Consistent Dark Navy Palette) ────────────────── */}
      <Box
        sx={{
          mb: 2,
          px: { xs: 2.5, sm: 3.5 },
          py: { xs: 2.5, sm: 3 },
          borderRadius: '20px',
          background: 'radial-gradient(circle at 90% 15%, rgba(242,183,5,0.22) 0%, transparent 42%), radial-gradient(circle at 15% 90%, rgba(56,189,248,0.12) 0%, transparent 35%), linear-gradient(125deg, #172338 0%, #202D43 60%, #26364D 100%)',
          color: '#FFFFFF',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 16px 36px rgba(23, 35, 56, 0.16)',
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.25 }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #FDE047 0%, #F2B705 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 22px rgba(242,183,5,0.35)',
              flexShrink: 0,
            }}
          >
            <CheckCircleIcon sx={{ color: '#172338', fontSize: 30 }} />
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
                Completed Webinars
              </Typography>
        
            </Box>
            <Typography
              variant="body2"
              sx={{
                color: 'rgba(255,255,255,0.78)',
                fontWeight: 400,
                fontSize: { xs: '0.85rem', sm: '0.92rem' },
                maxWidth: 540,
              }}
            >
              Track your attended learning milestones and download accredited completion certificates.
            </Typography>
          </Box>
        </Box>

        {/* Quick Stats Cards inside Banner */}
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
              Completed
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
              bgcolor: 'rgba(34, 197, 94, 0.14)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(74, 222, 128, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: { xs: 'center', md: 'flex-start' },
              transition: 'transform 0.2s ease',
              '&:hover': { transform: 'translateY(-2px)', bgcolor: 'rgba(34, 197, 94, 0.2)' }
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: '#8BE0A7',
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                fontSize: '0.65rem',
                mb: 0.25
              }}
            >
              Certificates
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#8BE0A7', lineHeight: 1.1 }}>
              {stats.certified}
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
                color: '#FFD45A',
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                fontSize: '0.65rem',
                mb: 0.25
              }}
            >
              Hours Attended
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
        <Box sx={{ flexGrow: 1, minWidth: { xs: '100%', sm: 280 }, maxWidth: { xs: '100%', sm: 400 } }}>
          <CustomSearchBar
            value={search}
            onChange={(val) => setSearch(val)}
            placeholder="Search completed webinars, topics..."
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
            { id: 'CERTIFIED', label: `Certificate Available (${stats.certified})` },
            { id: 'NO_CERT', label: `Attended Only (${stats.total - stats.certified})` },
          ].map(p => {
            const active = filterType === p.id;
            return (
              <Chip
                key={p.id}
                label={p.label}
                size="small"
                clickable
                onClick={() => setFilterType(p.id)}
                sx={{
                  fontWeight: active ? 800 : 600,
                  fontSize: '0.78rem',
                  height: 34,
                  px: 0.8,
                  borderRadius: '10px',
                  bgcolor: active ? '#F2B705' : colors.surfaceAlt,
                  color: active ? '#1e2e49ff' : colors.textSecondary,
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

      {/* ── Scrollable Card Area ──────────────────────────────────────────── */}
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
              Checking webinar completions and certificate eligibility...
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
              <CheckCircleIcon sx={{ fontSize: 36, color: '#D97706' }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 800, color: colors.textPrimary, mb: 0.75 }}>
              {webinars.length === 0 ? 'No completed webinars yet' : 'No webinars matching your filter'}
            </Typography>
            <Typography variant="body2" sx={{ color: colors.textSecondary, maxWidth: 420, mx: 'auto', mb: 3, lineHeight: 1.6 }}>
              {webinars.length === 0
                ? 'Join upcoming sessions, participate in webinars, and complete them to earn your accredited certificates!'
                : 'Try adjusting your search criteria or resetting filters to view all completed sessions.'}
            </Typography>

            {webinars.length === 0 ? (
              <Button
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/dashboard/upcoming')}
                sx={{
                  bgcolor: '#F2B705',
                  color: '#172338',
                  fontWeight: 800,
                  textTransform: 'none',
                  px: 3.5,
                  py: 1.1,
                  borderRadius: '12px',
                  boxShadow: '0 6px 16px rgba(242,183,5,0.3)',
                  '&:hover': { bgcolor: '#DDA600', boxShadow: '0 8px 22px rgba(242,183,5,0.4)' }
                }}
              >
                Browse Upcoming Webinars
              </Button>
            ) : (
              <Button
                variant="outlined"
                size="medium"
                onClick={() => { setSearch(''); setFilterType('ALL'); }}
                sx={{
                  color: '#172338',
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
              const isEligible = w.canDownloadCertificate;
              const isDownloading = downloadingId === w.webinarId;

              return (
                <Grid item xs={12} md={6} lg={4} key={w.webinarId} sx={{ display: 'flex' }}>
                  <Paper
                    elevation={0}
                    sx={{
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      borderRadius: '20px',
                      bgcolor: colors.surface,
                      border: isEligible
                        ? '1.5px solid rgba(22, 163, 74, 0.45)'
                        : `1px solid ${colors.border || 'rgba(15, 23, 42, 0.08)'}`,
                      background: isEligible
                        ? 'linear-gradient(180deg, #F0FDF4 0%, #FFFFFF 100%)'
                        : 'linear-gradient(180deg, #FFFFFF 0%, #FAFBFD 100%)',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      overflow: 'hidden',
                      position: 'relative',
                      boxShadow: isEligible
                        ? '0 10px 28px rgba(22, 163, 74, 0.1)'
                        : '0 6px 20px rgba(15, 23, 42, 0.05)',
                      '&:hover': {
                        transform: 'translateY(-5px)',
                        boxShadow: '0 20px 38px rgba(15, 23, 42, 0.12)',
                        borderColor: isEligible ? '#16A34A' : '#F2B705',
                      }
                    }}
                  >
                    {/* Top Milestone Banner */}
                    <Box
                      sx={{
                        position: 'relative',
                        overflow: 'hidden',
                        minHeight: 76,
                        px: 2.5,
                        py: 1.7,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1.5,
                        color: '#FFFFFF',
                        background: 'linear-gradient(115deg, #172338 0%, #24344C 72%, #31445D 100%)',
                        '&:after': {
                          content: '""',
                          position: 'absolute',
                          width: 112,
                          height: 112,
                          right: -34,
                          top: -54,
                          borderRadius: '50%',
                          border: '18px solid rgba(242,183,5,0.13)',
                          pointerEvents: 'none',
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.3, minWidth: 0, position: 'relative', zIndex: 1 }}>
                        <Box sx={{
                          width: 38, height: 38, flexShrink: 0, borderRadius: '13px',
                          display: 'grid', placeItems: 'center',
                          color: '#172338', bgcolor: '#F2B705',
                          boxShadow: '0 5px 15px rgba(242,183,5,0.22)',
                        }}>
                          <CheckCircleIcon sx={{ fontSize: 23 }} />
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontSize: '0.68rem', lineHeight: 1.2, letterSpacing: '1.15px', fontWeight: 800, color: '#F7C92F', mb: 0.45 }}>
                            LEARNING MILESTONE
                          </Typography>
                          <Typography sx={{ fontSize: '0.82rem', lineHeight: 1.25, fontWeight: 650, color: '#FFFFFF' }}>
                            Session completed
                          </Typography>
                        </Box>
                      </Box>

                      <Box sx={{
                        position: 'relative', zIndex: 1, flexShrink: 0,
                        display: 'flex', alignItems: 'center', gap: 0.65,
                        px: 1.15, py: 0.7, borderRadius: '10px',
                        bgcolor: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.12)',
                      }}>
                        <TimerIcon sx={{ fontSize: 15, color: '#F7C92F' }} />
                        <Typography sx={{ fontSize: '0.73rem', fontWeight: 700, color: '#FFFFFF' }}>
                          {fmtAttendedDuration(w.attendedDuration)}
                        </Typography>
                      </Box>
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
                      <Box>
                        {/* Status Line */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.25, minHeight: 20 }}>
                          {isEligible ? (
                            <>
                              <WorkspacePremiumIcon sx={{ color: '#16A34A', fontSize: 16 }} />
                              <Typography variant="caption" sx={{ color: '#15803D', fontWeight: 700, letterSpacing: '0.3px', fontSize: '0.72rem' }}>
                                ACCREDITED • CERTIFICATE READY
                              </Typography>
                            </>
                          ) : (
                            <>
                              <CheckCircleIcon sx={{ color: '#64748B', fontSize: 16 }} />
                              <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 600, fontSize: '0.74rem' }}>
                                Attended Session • No Certificate
                              </Typography>
                            </>
                          )}
                        </Box>

                        {/* Webinar Title (Fixed 2-line height for alignment) */}
                        <Typography
                          variant="subtitle1"
                          title={w.webinarName}
                          sx={{
                            fontWeight: 700,
                            color: colors.textPrimary,
                            mb: 2,
                            lineHeight: 1.35,
                            fontSize: '1.10rem',
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

                        {/* Speaker Profile Pill */}
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
                              Lead Instructor
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
                              Total Duration: {w.durationMinutes} min
                            </Typography>
                          </Box>

                          {isEligible && (w.certificateCode || w.certificateId) && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pt: 0.5, borderTop: '1px dashed #CBD5E1' }}>
                              <WorkspacePremiumIcon sx={{ fontSize: 16, color: '#16A34A' }} />
                              <Typography variant="caption" sx={{ color: '#15803D', fontWeight: 800, fontSize: '0.76rem' }}>
                                Code: {w.certificateCode || w.certificateId}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </Box>

                      {/* Bottom Action Bar (Uniform 40px Height) */}
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', pt: 0.5 }}>
                        {isEligible ? (
                          <Button
                            fullWidth
                            variant="contained"
                            disabled={isDownloading}
                            startIcon={isDownloading ? <CircularProgress size={16} sx={{ color: '#172338' }} /> : <DownloadIcon sx={{ fontSize: '18px !important' }} />}
                            onClick={() => handleDownloadCertificate(w)}
                            sx={{
                              height: 40,
                              fontWeight: 700,
                              fontSize: '0.84rem',
                              bgcolor: '#F2B705',
                              color: '#161b44ff',
                              textTransform: 'none',
                              borderRadius: '10px',
                              boxShadow: '0 4px 12px rgba(242, 183, 5, 0.25)',
                              '&:hover': {
                                bgcolor: '#EAB308',
                                boxShadow: '0 6px 16px rgba(242, 183, 5, 0.4)'
                              }
                            }}
                          >
                            {isDownloading ? 'Generating...' : 'Download Certificate (PDF)'}
                          </Button>
                        ) : (
                          <Box
                            sx={{
                              width: '100%',
                              height: 40,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '10px',
                              bgcolor: '#F1F5F9',
                              border: '1px solid #CBD5E1',
                            }}
                          >
                            <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 700, fontSize: '0.76rem' }}>
                              Session Completed (No Certificate)
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Box>
    </Box>
  );
}