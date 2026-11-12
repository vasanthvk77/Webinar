import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Chip, Avatar, Button,
  Tooltip, Skeleton, CircularProgress, IconButton
} from '@mui/material';

// Icons
import BookmarkAddedIcon from '@mui/icons-material/BookmarkAdded';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TimerIcon from '@mui/icons-material/Timer';
import VideoCameraFrontIcon from '@mui/icons-material/VideoCameraFront';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import RefreshIcon from '@mui/icons-material/Refresh';
import BoltIcon from '@mui/icons-material/Bolt';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import SchoolIcon from '@mui/icons-material/School';
import ShareIcon from '@mui/icons-material/Share';
import EventIcon from '@mui/icons-material/Event';
import DownloadIcon from '@mui/icons-material/Download';
import toast from 'react-hot-toast';

import { dashboardService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useThemeColors, CHART_PILLARS } from '../../context/ThemeContext';
import {
  formatUtcToLocalDateOnly,
  formatUtcToLocalTimeOnly,
  isWebinarStartTimePast
} from '../../utils/validation';

// ── Brand Palette ────────────────────────────────────────────
const GOLD = '#eab308';
const GOLD_SOFT = '#fef3c7';
const GOLD_DEEP = '#a16207';
const EMERALD = '#10b981';
const EMERALD_SOFT = '#d1fae5';
const EMERALD_DEEP = '#047857';

// Helper: Format Duration (seconds -> hours/mins)
const fmtDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '0 min';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

// ── Executive Stat Tile Component (Unified Amber/Gold Look matching Admin) ──
function StatTile({ icon, label, value, sub, loading, colors }) {
  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        p: 2.25,
        minHeight: 128,
        borderRadius: '16px',
        bgcolor: colors.surface,
        border: `1px solid ${colors.border}`,
        boxShadow: '0 1px 3px rgba(15,23,42,0.03), 0 8px 20px -14px rgba(15,23,42,0.08)',
        transition: 'all 0.22s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          borderColor: GOLD,
          boxShadow: `0 12px 28px -12px ${GOLD}50`
        }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography noWrap sx={{ fontSize: '12.5px', fontWeight: 600, color: colors.textMuted }}>
          {label}
        </Typography>
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: '10px',
            bgcolor: GOLD_SOFT,
            color: GOLD_DEEP,
            border: `1px solid ${GOLD}30`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          {icon}
        </Box>
      </Box>

      <Box sx={{ mt: 1 }}>
        {loading ? (
          <Skeleton width={68} height={40} />
        ) : (
          <Typography sx={{ fontSize: '28px', fontWeight: 800, color: colors.primary, letterSpacing: '-0.8px', lineHeight: 1.15 }}>
            {value}
          </Typography>
        )}
        {!loading && sub && (
          <Typography noWrap sx={{ fontSize: '11.5px', color: colors.textMuted, mt: 0.5, lineHeight: 1.35 }}>
            {sub}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export default function StudentDashboard() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    summary: {
      totalRegistrations: 0,
      freeRegistrations: 0,
      paidRegistrations: 0,
      completedWebinars: 0,
      upcomingWebinars: 0,
      certificatesCount: 0,
      totalAttendedDurationSeconds: 0,
      avgAttendedDurationSeconds: 0,
      avgAttendedCompletedDurationSeconds: 0
    },
    latestWebinar: null,
    webinarAttendances: [],
    categoryBreakdowns: [],
    recentCertificates: []
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dashboardService.getStudentStats();
      if (res.data?.success) {
        setData(res.data.data);
      } else {
        toast.error(res.data?.message || 'Failed to load your learning dashboard');
      }
    } catch (err) {
      console.error('[StudentDashboard] Fetch error:', err);
      toast.error('Unable to retrieve dashboard metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived metrics
  const completionRate = useMemo(() => {
    const total = data.summary?.totalRegistrations || 0;
    const completed = data.summary?.completedWebinars || 0;
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  }, [data.summary]);

  const latest = data.latestWebinar;

  // Max value for dual bar comparison chart
  const maxDurationMinutes = useMemo(() => {
    if (!data.webinarAttendances || data.webinarAttendances.length === 0) return 60;
    const maxVal = Math.max(
      ...data.webinarAttendances.map(w => Math.max(w.scheduledDurationMinutes || 0, Math.round((w.attendedDurationSeconds || 0) / 60)))
    );
    return Math.max(maxVal, 60);
  }, [data.webinarAttendances]);

  // Handle direct join
  const handleJoinWebinar = (joinUrl) => {
    if (!joinUrl) {
      toast.error('Join link is not available yet. Please wait until room opens.');
      return;
    }
    toast.success('Opening webinar session...');
    window.open(joinUrl, '_blank', 'noopener,noreferrer');
  };

  // Handle Share link copy
  const handleCopyShare = (shareId, e) => {
    e.stopPropagation();
    if (!shareId) return;
    const url = `${window.location.origin}/register?trackingId=${shareId}`;
    navigator.clipboard.writeText(url);
    toast.success('Webinar link copied to clipboard!');
  };

  return (
    <Box
      sx={{
        p: { xs: 2, sm: 3, md: 3.5 },
        bgcolor: colors.bg,
        minHeight: '100vh',
        maxWidth: 1600,
        mx: 'auto'
      }}
    >
      {/* ── Top Executive Welcome Card ────────────────────────────── */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 3 },
          mb: 3,
          borderRadius: '20px',
          bgcolor: colors.surface,
          border: `1px solid ${colors.border}`,
          boxShadow: '0 1px 3px rgba(15,23,42,0.04), 0 10px 24px -18px rgba(15,23,42,0.08)',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'flex-start', md: 'center' },
          justifyContent: 'space-between',
          gap: 2.5
        }}
      >
        <Box sx={{ maxWidth: 720 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 0.75, flexWrap: 'wrap' }}>
            <Chip
              icon={<FiberManualRecordIcon sx={{ fontSize: '10px !important', color: `${EMERALD} !important` }} />}
              label="Student Learning Hub"
              size="small"
              sx={{
                bgcolor: EMERALD_SOFT,
                color: EMERALD_DEEP,
                fontWeight: 700,
                fontSize: '11.5px',
                height: 24,
                borderRadius: '6px',
                border: `1px solid ${EMERALD}40`
              }}
            />
            <Chip
              label={`${completionRate}% Completed`}
              size="small"
              sx={{
                bgcolor: GOLD_SOFT,
                color: GOLD_DEEP,
                fontWeight: 700,
                fontSize: '11.5px',
                height: 24,
                borderRadius: '6px',
                border: `1px solid ${GOLD}40`
              }}
            />
            <Typography variant="caption" sx={{ color: colors.textMuted, fontWeight: 500 }}>
              Live Telemetry
            </Typography>
          </Box>

          <Typography
            variant="h4"
            sx={{
              fontWeight: 750,
              color: colors.primary,
              letterSpacing: '-0.8px',
              fontSize: { xs: '1.6rem', sm: '1.9rem', md: '2.1rem' },
              lineHeight: 1.2,
              mb: 0.75
            }}
          >
            Welcome back, {user?.firstName ? `${user.firstName}!` : 'Student!'}
          </Typography>

          <Typography sx={{ fontSize: '13.5px', color: colors.textSecondary, lineHeight: 1.5 }}>
            Track your enrolled webinars, join live sessions, review your attendance records, and download earned completion certificates.
          </Typography>
        </Box>

        {/* Right Action Buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' } }}>
          <Button
            variant="outlined"
            size="medium"
            startIcon={<RefreshIcon />}
            onClick={loadData}
            disabled={loading}
            sx={{
              height: 42,
              px: 2,
              borderRadius: '10px',
              borderColor: colors.border,
              color: colors.primary,
              fontWeight: 600,
              fontSize: '13px',
              textTransform: 'none',
              bgcolor: colors.surface,
              '&:hover': {
                borderColor: GOLD,
                bgcolor: `${GOLD}08`
              }
            }}
          >
            Refresh
          </Button>

          <Button
            variant="contained"
            size="medium"
            endIcon={<ArrowForwardIcon />}
            onClick={() => navigate('/dashboard/webinars?tab=available')}
            sx={{
              height: 42,
              px: 2.25,
              borderRadius: '10px',
              bgcolor: GOLD,
              color: '#0F172A',
              fontWeight: 700,
              fontSize: '13px',
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': {
                bgcolor: '#ca8a04',
                boxShadow: 'none'
              }
            }}
          >
            Explore Webinars
          </Button>
        </Box>
      </Paper>

      {/* ── Spotlight Banner: Priority Webinar ──────────── */}
      {latest ? (() => {
        const isEnrolledActive = latest.spotlightType === 'ACTIVE_ENROLLED' || (!latest.isCompleted && !latest.isAttended && new Date(latest.endTime || latest.startTime) >= new Date());
        const isCompletedSession = latest.spotlightType === 'LATEST_COMPLETED' || latest.isCompleted || latest.isAttended;
        const isAvailableOngoing = latest.spotlightType === 'ONGOING_AVAILABLE' || (!latest.isRegistered && !isCompletedSession);
        const canJoinLatest = isEnrolledActive && latest.hasJoinLink && latest.joinLink;

        // Banner chip tag definition
        let bannerTag = 'Next Up / Enrolled Session';
        let bannerTagIcon = <BookmarkAddedIcon sx={{ fontSize: '13px !important', color: `${GOLD_DEEP} !important` }} />;
        let bannerTagBg = GOLD_SOFT;
        let bannerTagColor = GOLD_DEEP;

        if (isCompletedSession) {
          bannerTag = 'Recent Completed Session';
          bannerTagIcon = <CheckCircleIcon sx={{ fontSize: '13px !important', color: `${EMERALD_DEEP} !important` }} />;
          bannerTagBg = EMERALD_SOFT;
          bannerTagColor = EMERALD_DEEP;
        } else if (isAvailableOngoing) {
          bannerTag = 'Ongoing / Upcoming Webinar';
          bannerTagIcon = <EventIcon sx={{ fontSize: '13px !important', color: '#1D4ED8 !important' }} />;
          bannerTagBg = '#EFF6FF';
          bannerTagColor = '#1D4ED8';
        }

        return (
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.5, sm: 3 },
              mb: 3,
              borderRadius: '20px',
              bgcolor: colors.surface,
              border: `1.5px solid ${canJoinLatest ? `${EMERALD}80` : (isCompletedSession ? `${GOLD}60` : colors.border)}`,
              background: canJoinLatest
                ? `linear-gradient(135deg, ${colors.surface} 0%, ${EMERALD_SOFT}25 100%)`
                : colors.surface,
              boxShadow: canJoinLatest
                ? `0 12px 30px -10px ${EMERALD}30`
                : '0 1px 3px rgba(15,23,42,0.03), 0 8px 20px -14px rgba(15,23,42,0.08)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', gap: 2.5 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1, flexWrap: 'wrap' }}>
                  <Chip
                    icon={bannerTagIcon}
                    label={bannerTag}
                    size="small"
                    sx={{
                      bgcolor: bannerTagBg,
                      color: bannerTagColor,
                      fontWeight: 800,
                      fontSize: '11.5px',
                      height: 24,
                      borderRadius: '6px',
                      border: `1px solid ${bannerTagBg}`
                    }}
                  />

                  <Chip
                    label={latest.categoryName || 'General'}
                    size="small"
                    sx={{
                      bgcolor: 'rgba(15, 23, 42, 0.06)',
                      color: colors.primary,
                      fontWeight: 700,
                      fontSize: '11px',
                      height: 24,
                      borderRadius: '6px'
                    }}
                  />

                  <Chip
                    label={latest.isPaid ? `Paid • ₹${latest.price || 0}` : 'Free Webinar'}
                    size="small"
                    sx={{
                      bgcolor: latest.isPaid ? '#fee2e2' : '#f0fdf4',
                      color: latest.isPaid ? '#991b1b' : '#166534',
                      fontWeight: 700,
                      fontSize: '11px',
                      height: 24,
                      borderRadius: '6px'
                    }}
                  />

                  {isCompletedSession ? (
                    <Chip
                      icon={<CheckCircleIcon sx={{ fontSize: '13px !important', color: `${EMERALD_DEEP} !important` }} />}
                      label="Session Completed"
                      size="small"
                      sx={{
                        bgcolor: EMERALD_SOFT,
                        color: EMERALD_DEEP,
                        fontWeight: 800,
                        fontSize: '11px',
                        height: 24,
                        borderRadius: '6px',
                        border: `1px solid ${EMERALD}60`
                      }}
                    />
                  ) : canJoinLatest ? (
                    <Chip
                      icon={<FiberManualRecordIcon sx={{ fontSize: '10px !important', color: `${EMERALD} !important` }} />}
                      label="Join Link Ready"
                      size="small"
                      sx={{
                        bgcolor: EMERALD_SOFT,
                        color: EMERALD_DEEP,
                        fontWeight: 800,
                        fontSize: '11px',
                        height: 24,
                        borderRadius: '6px',
                        border: `1px solid ${EMERALD}60`
                      }}
                    />
                  ) : isEnrolledActive ? (
                    <Chip
                      label="Room Preparing"
                      size="small"
                      sx={{
                        bgcolor: '#f1f5f9',
                        color: '#475569',
                        fontWeight: 600,
                        fontSize: '11px',
                        height: 24,
                        borderRadius: '6px'
                      }}
                    />
                  ) : (
                    <Chip
                      label="Open for Registration"
                      size="small"
                      sx={{
                        bgcolor: '#EFF6FF',
                        color: '#1D4ED8',
                        fontWeight: 700,
                        fontSize: '11px',
                        height: 24,
                        borderRadius: '6px'
                      }}
                    />
                  )}
                </Box>

                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 800,
                    color: colors.primary,
                    letterSpacing: '-0.5px',
                    lineHeight: 1.25,
                    mb: 1
                  }}
                >
                  {latest.webinarName}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap', mt: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <CalendarMonthIcon sx={{ fontSize: 18, color: GOLD_DEEP }} />
                    <Typography sx={{ fontSize: '13px', fontWeight: 600, color: colors.primary }}>
                      {formatUtcToLocalDateOnly(latest.webinarDate)}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <AccessTimeIcon sx={{ fontSize: 18, color: '#0284c7' }} />
                    <Typography sx={{ fontSize: '13px', fontWeight: 600, color: colors.textSecondary }}>
                      {formatUtcToLocalTimeOnly(latest.startTime)} – {formatUtcToLocalTimeOnly(latest.endTime)} ({latest.durationMinutes}m)
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <SchoolIcon sx={{ fontSize: 18, color: '#6366f1' }} />
                    <Typography sx={{ fontSize: '13px', fontWeight: 600, color: colors.textSecondary }}>
                      Instructor: {latest.conductorName || 'Weblearn Faculty'}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Action Area: Priority based button */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0, width: { xs: '100%', md: 'auto' } }}>
                {isCompletedSession ? (
                  latest.isCertificateEligible ? (
                    <Button
                      variant="contained"
                      size="large"
                      startIcon={<WorkspacePremiumIcon sx={{ fontSize: 20 }} />}
                      onClick={() => navigate('/dashboard/certificates')}
                      sx={{
                        height: 48,
                        px: 3.5,
                        borderRadius: '12px',
                        bgcolor: GOLD,
                        color: '#0F172A',
                        fontWeight: 800,
                        fontSize: '14px',
                        textTransform: 'none',
                        boxShadow: `0 8px 20px -4px ${GOLD}80`,
                        '&:hover': { bgcolor: '#d97706', color: '#fff' }
                      }}
                    >
                      View Certificate
                    </Button>
                  ) : (
                    <Button
                      variant="outlined"
                      size="large"
                      startIcon={<CheckCircleIcon sx={{ fontSize: 18 }} />}
                      onClick={() => navigate('/dashboard/webinars?tab=completed')}
                      sx={{
                        height: 48,
                        px: 3,
                        borderRadius: '12px',
                        borderColor: colors.border,
                        color: colors.primary,
                        fontWeight: 700,
                        fontSize: '13.5px',
                        textTransform: 'none',
                        bgcolor: colors.surface
                      }}
                    >
                      Completed Details
                    </Button>
                  )
                ) : isEnrolledActive ? (
                  canJoinLatest ? (
                    <Button
                      variant="contained"
                      size="large"
                      startIcon={<VideoCallIcon sx={{ fontSize: 22 }} />}
                      onClick={() => handleJoinWebinar(latest.joinLink)}
                      sx={{
                        height: 48,
                        px: 3.5,
                        borderRadius: '12px',
                        bgcolor: EMERALD,
                        color: '#FFFFFF',
                        fontWeight: 800,
                        fontSize: '14px',
                        textTransform: 'none',
                        boxShadow: `0 8px 20px -4px ${EMERALD}80`,
                        '&:hover': { bgcolor: EMERALD_DEEP }
                      }}
                    >
                      Join Webinar
                    </Button>
                  ) : (
                    <Button
                      variant="outlined"
                      size="large"
                      startIcon={<EventIcon />}
                      onClick={() => navigate('/dashboard/webinars?tab=registered')}
                      sx={{
                        height: 48,
                        px: 3,
                        borderRadius: '12px',
                        borderColor: colors.border,
                        color: colors.primary,
                        fontWeight: 700,
                        fontSize: '13.5px',
                        textTransform: 'none',
                        bgcolor: colors.surface
                      }}
                    >
                      View Schedule
                    </Button>
                  )
                ) : isAvailableOngoing ? (
                  <Button
                    variant="contained"
                    size="large"
                    endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}
                    onClick={() => {
                      if (latest.isPaid) {
                        navigate(`/register?trackingId=${latest.shareId}`);
                      } else {
                        navigate('/dashboard/webinars?tab=available');
                      }
                    }}
                    sx={{
                      height: 48,
                      px: 3.5,
                      borderRadius: '12px',
                      bgcolor: '#EA580C',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      fontSize: '14px',
                      textTransform: 'none',
                      boxShadow: '0 8px 20px -4px rgba(234, 88, 12, 0.45)',
                      '&:hover': { bgcolor: '#C2410C' }
                    }}
                  >
                    Register Now
                  </Button>
                ) : null}

                {/* Only show share button if StartTime < Current has NOT passed */}
                {!isWebinarStartTimePast(latest.startTime) && (
                  <Tooltip title="Copy Share Link" arrow>
                    <IconButton
                      onClick={(e) => handleCopyShare(latest.shareId, e)}
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: '12px',
                        bgcolor: colors.surface,
                        border: `1px solid ${colors.border}`,
                        color: colors.textSecondary,
                        '&:hover': {
                          color: GOLD_DEEP,
                          bgcolor: GOLD_SOFT,
                          borderColor: GOLD
                        }
                      }}
                    >
                      <ShareIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>
          </Paper>
        );
      })() : null}

      {/* ── 5 Professional Executive KPI Stat Tiles (Unified Amber/Gold) ── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(1, 1fr)',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            lg: 'repeat(5, 1fr)'
          },
          gap: 2,
          mb: 3
        }}
      >
        <StatTile
          icon={<BookmarkAddedIcon sx={{ fontSize: 20 }} />}
          label="Total Registrations"
          value={data.summary.totalRegistrations}
          sub={`${data.summary.freeRegistrations} Free • ${data.summary.paidRegistrations} Paid`}
          loading={loading}
          colors={colors}
        />

        <StatTile
          icon={<CheckCircleIcon sx={{ fontSize: 20 }} />}
          label="Completed Webinars"
          value={data.summary.completedWebinars}
          sub={`${completionRate}% Completed • ${data.summary.upcomingWebinars} Pending`}
          loading={loading}
          colors={colors}
        />

        <StatTile
          icon={<WorkspacePremiumIcon sx={{ fontSize: 20 }} />}
          label="Certificates Earned"
          value={data.summary.certificatesCount}
          sub="Verified & Downloadable"
          loading={loading}
          colors={colors}
        />

        <StatTile
          icon={<AccessTimeIcon sx={{ fontSize: 20 }} />}
          label="Total Attended Time"
          value={fmtDuration(data.summary.totalAttendedDurationSeconds)}
          sub="Combined across all sessions"
          loading={loading}
          colors={colors}
        />

        <StatTile
          icon={<TimerIcon sx={{ fontSize: 20 }} />}
          label="Average Attended Time"
          value={fmtDuration(data.summary.avgAttendedDurationSeconds)}
          sub="Avg per registered webinar"
          loading={loading}
          colors={colors}
        />
      </Box>

      {/* ── Middle Grid: Attended Time Chart & Categories ───────────── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
          gap: 3,
          mb: 3
        }}
      >
        {/* Dual-bar Chart: Scheduled vs Attended Duration (Same as Admin Dashboard) */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: '20px',
            bgcolor: colors.surface,
            border: `1px solid ${colors.border}`,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: '18px', fontWeight: 700, color: colors.primary, letterSpacing: '-0.3px' }}>
                Webinar Duration vs Attended Time
              </Typography>
              <Chip
                label={`${data.webinarAttendances.length} ${data.webinarAttendances.length === 1 ? 'webinar' : 'webinars'}`}
                size="small"
                sx={{ height: 24, fontSize: '11px', fontWeight: 700, bgcolor: GOLD_SOFT, color: GOLD_DEEP }}
              />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '4px', background: CHART_PILLARS.primary.gradient }} />
                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: colors.primary }}>Scheduled time</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '4px', background: CHART_PILLARS.secondary.gradient }} />
                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: colors.primary }}>Attended time</Typography>
              </Box>
            </Box>
          </Box>

          {loading ? (
            <Skeleton variant="rounded" height={260} sx={{ borderRadius: '14px' }} />
          ) : data.webinarAttendances.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <Typography sx={{ color: colors.textMuted, fontSize: '13px', mb: 1.5 }}>
                No webinar attendance records available yet.
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => navigate('/dashboard/webinars?tab=available')}
                sx={{ borderRadius: '8px', textTransform: 'none', borderColor: colors.border, color: colors.primary }}
              >
                Enroll in a Webinar
              </Button>
            </Box>
          ) : (
            <Box sx={{ overflowX: 'auto', pb: 0.5 }}>
              <Box sx={{ position: 'relative', minWidth: Math.max(data.webinarAttendances.length * 110, 360) }}>
                <Box sx={{ position: 'relative', height: 250 }}>
                  {/* Grid lines: baseline, 1/3, 2/3 and max (dashed) */}
                  {[0, 26, 52].map((b) => (
                    <Box
                      key={b}
                      sx={{ position: 'absolute', left: 0, right: 0, bottom: `${b}%`, borderTop: `1px solid ${colors.border}`, pointerEvents: 'none' }}
                    />
                  ))}
                  <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: '78%', borderTop: `1.5px dashed ${GOLD}`, opacity: 0.8, pointerEvents: 'none' }} />
                  <Box
                    sx={{
                      position: 'absolute',
                      right: 0,
                      bottom: 'calc(78% + 6px)',
                      px: 1.1,
                      py: 0.2,
                      borderRadius: '999px',
                      bgcolor: GOLD,
                      color: '#1c1917',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      zIndex: 3
                    }}
                  >
                    max {maxDurationMinutes}m
                  </Box>

                  {/* Dual Vertical Bars Container */}
                  <Box sx={{ position: 'absolute', inset: 0, display: 'flex', gap: 1.5, justifyContent: 'space-evenly' }}>
                    {data.webinarAttendances.map((w) => {
                      const scheduledMins = w.scheduledDurationMinutes || 60;
                      const attendedMins = Math.round((w.attendedDurationSeconds || 0) / 60);
                      const schedPct = (scheduledMins / maxDurationMinutes) * 78;
                      const attPct = (attendedMins / maxDurationMinutes) * 78;
                      const rate = scheduledMins > 0 ? Math.round((attendedMins / scheduledMins) * 100) : 0;

                      return (
                        <Tooltip
                          key={w.webinarId}
                          arrow
                          title={
                            <Box sx={{ p: 0.5 }}>
                              <Typography sx={{ fontSize: '12px', fontWeight: 700, mb: 0.5 }}>{w.webinarName}</Typography>
                              <Typography sx={{ fontSize: '11px', color: '#fef3c7' }}>Category: {w.categoryName}</Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: CHART_PILLARS.primary.main }} />
                                <Typography sx={{ fontSize: '11px' }}>Scheduled: <strong>{scheduledMins} min</strong></Typography>
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
                                <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: CHART_PILLARS.secondary.main }} />
                                <Typography sx={{ fontSize: '11px' }}>Attended: <strong>{attendedMins} min</strong></Typography>
                              </Box>
                              <Typography sx={{ fontSize: '10.5px', color: '#fde68a', mt: 0.5 }}>Attendance: {rate}%</Typography>
                            </Box>
                          }
                        >
                          <Box sx={{ position: 'relative', flex: '1 1 0', minWidth: 70, maxWidth: 120, height: '100%', cursor: 'default' }}>
                            <Box
                              sx={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                display: 'flex',
                                alignItems: 'flex-end',
                                justifyContent: 'center',
                                gap: { xs: 0.5, sm: 0.8 },
                                height: '100%'
                              }}
                            >
                              {/* 1. Scheduled Duration Bar (Gold) */}
                              <Box
                                sx={{
                                  position: 'relative',
                                  flex: '1 1 0',
                                  maxWidth: 32,
                                  height: `${Math.max(schedPct, scheduledMins > 0 ? 8 : 4)}%`,
                                  borderRadius: '9px 9px 3px 3px',
                                  background: scheduledMins > 0
                                    ? CHART_PILLARS.primary.gradient
                                    : CHART_PILLARS.primary.emptyGradient,
                                  boxShadow: scheduledMins > 0 ? CHART_PILLARS.primary.shadow : 'none',
                                  transition: 'all 0.2s ease',
                                  '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-2px)' }
                                }}
                              >
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    left: '50%',
                                    bottom: 'calc(100% + 4px)',
                                    transform: 'translateX(-50%)',
                                    px: 0.75,
                                    py: 0.15,
                                    borderRadius: '999px',
                                    bgcolor: CHART_PILLARS.primary.pillBg,
                                    color: CHART_PILLARS.primary.pillText,
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    lineHeight: 1.2,
                                    zIndex: 2,
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {scheduledMins}m
                                </Box>
                              </Box>

                              {/* 2. Attended Time Bar (Royal Indigo #6869ff) */}
                              <Box
                                sx={{
                                  position: 'relative',
                                  flex: '1 1 0',
                                  maxWidth: 32,
                                  height: `${Math.max(attPct, attendedMins > 0 ? 8 : 4)}%`,
                                  borderRadius: '9px 9px 3px 3px',
                                  background: attendedMins > 0
                                    ? CHART_PILLARS.secondary.gradient
                                    : CHART_PILLARS.secondary.emptyGradient,
                                  boxShadow: attendedMins > 0 ? CHART_PILLARS.secondary.shadow : 'none',
                                  transition: 'all 0.2s ease',
                                  '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-2px)' }
                                }}
                              >
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    left: '50%',
                                    bottom: 'calc(100% + 4px)',
                                    transform: 'translateX(-50%)',
                                    px: 0.75,
                                    py: 0.15,
                                    borderRadius: '999px',
                                    bgcolor: CHART_PILLARS.secondary.pillBg,
                                    color: CHART_PILLARS.secondary.pillText,
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    lineHeight: 1.2,
                                    zIndex: 2,
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {attendedMins}m
                                </Box>
                              </Box>
                            </Box>
                          </Box>
                        </Tooltip>
                      );
                    })}
                  </Box>
                </Box>

                {/* X axis labels */}
                <Box sx={{ display: 'flex', gap: 1.5, mt: 1.5, justifyContent: 'space-evenly' }}>
                  {data.webinarAttendances.map((w) => {
                    const isEnded = Boolean(w.isCompleted) || (w.endTime && new Date(w.endTime) < new Date());
                    const isAttendedCompleted = Boolean(w.isAttended);

                    // User exact logic:
                    // 1) Registered && Attended (IsCompleted / IsAttended) && EndTime < Current === "Completed"
                    // 2) Registered && NOT Attended && EndTime < Current === "Missed to Attend"
                    // 3) Else upcoming / live === "Live Ready" / "Upcoming"
                    let statusLabel = 'Upcoming';
                    let statusColor = colors.textMuted;
                    let isBold = false;

                    if (isEnded) {
                      if (isAttendedCompleted) {
                        statusLabel = 'Completed';
                        statusColor = '#059669';
                        isBold = true;
                      } else {
                        statusLabel = 'Missed to Attend';
                        statusColor = '#DC2626';
                        isBold = true;
                      }
                    } else if (w.hasJoinLink) {
                      statusLabel = 'Live Ready';
                      statusColor = '#0284c7';
                    }

                    return (
                      <Box key={w.webinarId} sx={{ flex: '1 1 0', minWidth: 70, maxWidth: 120, textAlign: 'center' }}>
                        <Tooltip title={w.webinarName} arrow>
                          <Typography
                            noWrap
                            sx={{ fontSize: '12px', fontWeight: 600, color: colors.primary, cursor: 'default', '&:hover': { color: GOLD_DEEP } }}
                          >
                            {w.webinarName}
                          </Typography>
                        </Tooltip>
                        <Typography
                          noWrap
                          sx={{
                            fontSize: '10.5px',
                            color: statusColor,
                            fontWeight: isBold ? 700 : 500
                          }}
                        >
                          {statusLabel}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            </Box>
          )}
        </Paper>

        {/* Subjects & Categories Enrolled */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: '20px',
            bgcolor: colors.surface,
            border: `1px solid ${colors.border}`,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <Typography sx={{ fontSize: '16px', fontWeight: 800, color: colors.primary, mb: 0.5 }}>
            Subjects Enrolled
          </Typography>
          <Typography sx={{ fontSize: '12.5px', color: colors.textMuted, mb: 2.5 }}>
            Breakdown of your registered webinar categories.
          </Typography>

          {loading ? (
            <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={30} sx={{ color: GOLD }} />
            </Box>
          ) : data.categoryBreakdowns.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '13px', color: colors.textMuted }}>
                No category data available.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {data.categoryBreakdowns.map((cat) => (
                <Box
                  key={cat.categoryId}
                  sx={{
                    p: 1.75,
                    borderRadius: '14px',
                    bgcolor: colors.surfaceAlt || 'rgba(15,23,42,0.02)',
                    border: `1px solid ${colors.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <Box>
                    <Typography sx={{ fontSize: '13.5px', fontWeight: 700, color: colors.primary }}>
                      {cat.categoryName}
                    </Typography>
                    <Typography sx={{ fontSize: '11.5px', color: colors.textMuted, mt: 0.25 }}>
                      {cat.completedCount} completed • {fmtDuration(cat.totalAttendedSeconds)} learning
                    </Typography>
                  </Box>
                  <Chip
                    label={`${cat.enrolledCount} enrolled`}
                    size="small"
                    sx={{
                      bgcolor: GOLD_SOFT,
                      color: GOLD_DEEP,
                      fontWeight: 800,
                      fontSize: '11.5px',
                      borderRadius: '8px'
                    }}
                  />
                </Box>
              ))}
            </Box>
          )}

          {/* Quick Shortcuts */}
          <Box sx={{ mt: 'auto', pt: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => navigate('/dashboard/webinars?tab=registered')}
              endIcon={<ArrowForwardIcon />}
              sx={{
                justifyContent: 'space-between',
                borderRadius: '10px',
                borderColor: colors.border,
                color: colors.primary,
                fontWeight: 600,
                fontSize: '12.5px',
                textTransform: 'none',
                py: 1.25,
                '&:hover': {
                  borderColor: GOLD,
                  bgcolor: `${GOLD}08`
                }
              }}
            >
              View All Registered Sessions
            </Button>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => navigate('/dashboard/certificates')}
              endIcon={<ArrowForwardIcon />}
              sx={{
                justifyContent: 'space-between',
                borderRadius: '10px',
                borderColor: colors.border,
                color: colors.primary,
                fontWeight: 600,
                fontSize: '12.5px',
                textTransform: 'none',
                py: 1.25,
                '&:hover': {
                  borderColor: GOLD,
                  bgcolor: `${GOLD}08`
                }
              }}
            >
              My Certificate Vault
            </Button>
          </Box>
        </Paper>
      </Box>

      {/* ── Bottom Section: Registered Webinars List & Attendance Log ── */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: '20px',
          bgcolor: colors.surface,
          border: `1px solid ${colors.border}`
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5, flexWrap: 'wrap', gap: 1.5 }}>
          <Box>
            <Typography sx={{ fontSize: '16px', fontWeight: 800, color: colors.primary }}>
              Enrolled Sessions & Attendance Log
            </Typography>
            <Typography sx={{ fontSize: '12.5px', color: colors.textMuted }}>
              Detailed breakdown of each enrolled webinar, attendance duration, and join link availability.
            </Typography>
          </Box>

          <Button
            size="small"
            variant="text"
            endIcon={<ArrowForwardIcon />}
            onClick={() => navigate('/dashboard/webinars?tab=registered')}
            sx={{ fontWeight: 700, color: GOLD_DEEP, textTransform: 'none' }}
          >
            Manage Enrolled ({data.summary.totalRegistrations})
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={32} sx={{ color: GOLD }} />
          </Box>
        ) : data.webinarAttendances.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '14px', color: colors.textMuted }}>
              No webinars registered yet. Explore upcoming topics and enroll today!
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {data.webinarAttendances.map((w) => {
              const attendedMins = Math.round((w.attendedDurationSeconds || 0) / 60);
              const isEnded = Boolean(w.isCompleted) || (w.endTime && new Date(w.endTime) < new Date());
              const isAttendedCompleted = Boolean(w.isAttended);

              // Exact Student Status Logic:
              // 1) Registered && Attended (IsCompleted / IsAttended) && EndTime < Current === "Completed"
              // 2) Registered && NOT Attended && EndTime < Current === "Missed to Attend"
              // 3) Else upcoming / live === "Link Ready" / "Scheduled"
              let statusType = 'UPCOMING';
              if (isEnded) {
                statusType = isAttendedCompleted ? 'COMPLETED' : 'MISSED';
              } else if (w.hasJoinLink && w.joinLink) {
                statusType = 'LIVE';
              }

              return (
                <Paper
                  key={w.webinarId}
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: '14px',
                    bgcolor: colors.surfaceAlt || 'rgba(15,23,42,0.02)',
                    border: `1px solid ${colors.border}`,
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                    alignItems: { xs: 'flex-start', md: 'center' },
                    justifyContent: 'space-between',
                    gap: 2,
                    transition: 'border-color 0.2s',
                    '&:hover': { borderColor: GOLD }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0, flex: 1 }}>
                    <Avatar
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: '12px',
                        bgcolor: statusType === 'COMPLETED' ? EMERALD_SOFT : statusType === 'MISSED' ? '#fee2e2' : GOLD_SOFT,
                        color: statusType === 'COMPLETED' ? EMERALD_DEEP : statusType === 'MISSED' ? '#dc2626' : GOLD_DEEP,
                        fontWeight: 800,
                        fontSize: '16px'
                      }}
                    >
                      {w.webinarName?.charAt(0)?.toUpperCase() || 'W'}
                    </Avatar>

                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.25 }}>
                        <Typography noWrap sx={{ fontSize: '14px', fontWeight: 800, color: colors.primary }}>
                          {w.webinarName}
                        </Typography>
                        <Chip
                          label={w.categoryName || 'General'}
                          size="small"
                          sx={{
                            fontSize: '10.5px',
                            fontWeight: 700,
                            height: 20,
                            bgcolor: 'rgba(15,23,42,0.05)',
                            color: colors.textSecondary
                          }}
                        />
                      </Box>

                      <Typography sx={{ fontSize: '12px', color: colors.textMuted }}>
                        {formatUtcToLocalDateOnly(w.webinarDate)} • {formatUtcToLocalTimeOnly(w.startTime)} – {formatUtcToLocalTimeOnly(w.endTime)} • Instructor: {w.conductorName}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Center Telemetry: Attended Time */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                    <Box sx={{ textAlign: { xs: 'left', md: 'right' } }}>
                      <Typography sx={{ fontSize: '11px', fontWeight: 600, color: colors.textMuted }}>
                        Attended Time
                      </Typography>
                      <Typography sx={{ fontSize: '13px', fontWeight: 800, color: attendedMins > 0 ? EMERALD_DEEP : colors.primary }}>
                        {fmtDuration(w.attendedDurationSeconds)} / {w.scheduledDurationMinutes}m
                      </Typography>
                    </Box>

                    {/* Status Pill */}
                    {statusType === 'COMPLETED' ? (
                      <Chip
                        icon={<CheckCircleIcon sx={{ fontSize: '13px !important', color: `${EMERALD_DEEP} !important` }} />}
                        label="Completed"
                        size="small"
                        sx={{
                          bgcolor: EMERALD_SOFT,
                          color: EMERALD_DEEP,
                          fontWeight: 700,
                          fontSize: '11px',
                          height: 26,
                          borderRadius: '8px'
                        }}
                      />
                    ) : statusType === 'MISSED' ? (
                      <Chip
                        label="Missed to Attend"
                        size="small"
                        sx={{
                          bgcolor: '#fee2e2',
                          color: '#dc2626',
                          fontWeight: 700,
                          fontSize: '11px',
                          height: 26,
                          borderRadius: '8px'
                        }}
                      />
                    ) : w.hasJoinLink && w.joinLink ? (
                      <Chip
                        icon={<FiberManualRecordIcon sx={{ fontSize: '10px !important', color: `${EMERALD} !important` }} />}
                        label="Link Ready"
                        size="small"
                        sx={{
                          bgcolor: EMERALD_SOFT,
                          color: EMERALD_DEEP,
                          fontWeight: 800,
                          fontSize: '11px',
                          height: 26,
                          borderRadius: '8px'
                        }}
                      />
                    ) : (
                      <Chip
                        label="Scheduled"
                        size="small"
                        sx={{
                          bgcolor: '#f1f5f9',
                          color: '#64748b',
                          fontWeight: 700,
                          fontSize: '11px',
                          height: 26,
                          borderRadius: '8px'
                        }}
                      />
                    )}

                    {/* Action Button: Strictly Check isCompleted FIRST */}
                    {statusType === 'COMPLETED' ? (
                      w.isCertificateEligible ? (
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<WorkspacePremiumIcon sx={{ fontSize: '16px !important' }} />}
                          onClick={() => navigate('/dashboard/certificates')}
                          sx={{
                            height: 34,
                            px: 2,
                            borderRadius: '8px',
                            borderColor: GOLD,
                            color: GOLD_DEEP,
                            fontWeight: 700,
                            fontSize: '12px',
                            textTransform: 'none'
                          }}
                        >
                          Certificate
                        </Button>
                      ) : (
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => navigate('/dashboard/webinars?tab=completed')}
                          sx={{
                            height: 34,
                            px: 2,
                            borderRadius: '8px',
                            borderColor: colors.border,
                            color: colors.primary,
                            fontWeight: 600,
                            fontSize: '12px',
                            textTransform: 'none'
                          }}
                        >
                          Details
                        </Button>
                      )
                    ) : statusType === 'MISSED' ? (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => navigate('/dashboard/webinars?tab=registered')}
                        sx={{
                          height: 34,
                          px: 2,
                          borderRadius: '8px',
                          borderColor: '#fca5a5',
                          color: '#b91c1c',
                          fontWeight: 600,
                          fontSize: '12px',
                          textTransform: 'none',
                          bgcolor: '#fff5f5'
                        }}
                      >
                        Session Info
                      </Button>
                    ) : w.hasJoinLink && w.joinLink ? (
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<VideoCameraFrontIcon sx={{ fontSize: '16px !important' }} />}
                        onClick={() => handleJoinWebinar(w.joinLink)}
                        sx={{
                          height: 34,
                          px: 2,
                          borderRadius: '8px',
                          bgcolor: EMERALD,
                          color: '#FFFFFF',
                          fontWeight: 700,
                          fontSize: '12px',
                          textTransform: 'none',
                          boxShadow: 'none',
                          '&:hover': { bgcolor: EMERALD_DEEP }
                        }}
                      >
                        Join Room
                      </Button>
                    ) : (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => navigate('/dashboard/webinars?tab=registered')}
                        sx={{
                          height: 34,
                          px: 2,
                          borderRadius: '8px',
                          borderColor: colors.border,
                          color: colors.primary,
                          fontWeight: 600,
                          fontSize: '12px',
                          textTransform: 'none'
                        }}
                      >
                        Details
                      </Button>
                    )}
                  </Box>
                </Paper>
              );
            })}
          </Box>
        )}
      </Paper>
    </Box>
  );
}

