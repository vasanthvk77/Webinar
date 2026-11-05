import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Chip, Avatar, Button,
  Tooltip, Skeleton, CircularProgress
} from '@mui/material';

// Icons
import VideoCameraFrontIcon from '@mui/icons-material/VideoCameraFront';
import SchoolIcon from '@mui/icons-material/School';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import BoltIcon from '@mui/icons-material/Bolt';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import toast from 'react-hot-toast';

import { dashboardService } from '../../services/api';
import { useThemeColors } from '../../context/ThemeContext';
import {
  formatUtcToLocalDateOnly,
  formatUtcToLocalTimeOnly
} from '../../utils/validation';

// ── Brand palette ────────────────────────────────────────────
const GOLD = '#eab308';
const GOLD_SOFT = '#fef3c7';
const GOLD_DEEP = '#a16207';
const INK = '#1c1917';

// Helper: Format Duration (seconds -> hours/mins)
const fmtDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '0 min';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

// ── Professional Stat Tile Component (Unified, Executive Look) ──
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

function RingGauge({ value, size = 64, thickness = 4.5 }) {
  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <CircularProgress variant="determinate" value={100} size={size} thickness={thickness} sx={{ color: GOLD_SOFT, position: 'absolute', inset: 0 }} />
      <CircularProgress
        variant="determinate"
        value={Math.max(0, Math.min(100, value))}
        size={size}
        thickness={thickness}
        sx={{ color: GOLD, position: 'absolute', inset: 0, '& .MuiCircularProgress-circle': { strokeLinecap: 'round' } }}
      />
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ fontSize: '14px', fontWeight: 700, color: INK }}>{value}%</Typography>
      </Box>
    </Box>
  );
}

export default function AdminDashboard() {
  const colors = useThemeColors();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // ── Fetch Dashboard Data from wms.sp_AdminDashboard ────────────────
  const loadDashboardData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await dashboardService.getStats();
      if (res.data?.success) {
        setData(res.data.data);
        setLastUpdated(new Date());
        if (isManualRefresh) toast.success('Dashboard metrics refreshed');
      } else {
        toast.error(res.data?.message || 'Failed to load dashboard data');
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      toast.error('Unable to fetch live dashboard telemetry');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const summary = data?.summary || {};
  const recentWebinars = data?.recentWebinars || [];
  const recentParticipants = data?.recentParticipants || [];

  const attendanceRate = useMemo(() => {
    if (!summary.totalParticipation || summary.totalParticipation === 0) return 0;
    return Math.min(100, Math.round(((summary.totalAttended || 0) / summary.totalParticipation) * 100));
  }, [summary]);

  const certificateRate = useMemo(() => {
    if (!summary.totalAttended || summary.totalAttended === 0) return 0;
    return Math.min(100, Math.round(((summary.totalCertificatesIssued || 0) / summary.totalAttended) * 100));
  }, [summary]);

  const completedRate = useMemo(() => {
    if (!summary.totalWebinars || summary.totalWebinars === 0) return 0;
    return Math.min(100, Math.round(((summary.completedWebinars || 0) / summary.totalWebinars) * 100));
  }, [summary]);

  // Webinar Registration vs Completion chart helpers
  const maxWebinarMetric = useMemo(() => {
    if (!recentWebinars.length) return 1;
    return Math.max(
      ...recentWebinars.map((w) =>
        Math.max(w.registrationCount || 0, w.completedCount ?? w.attendedCount ?? 0)
      ),
      1
    );
  }, [recentWebinars]);

  const cardSx = {
    borderRadius: '20px',
    bgcolor: colors.surface,
    border: `1px solid ${colors.border}`,
    boxShadow: '0 1px 3px rgba(15,23,42,0.03), 0 14px 32px -18px rgba(15,23,42,0.1)'
  };

  const tiles = [
    {
      label: 'Total Webinars',
      value: summary.totalWebinars ?? 0,
      sub: `${summary.upcomingWebinars ?? 0} upcoming · ${summary.completedWebinars ?? 0} done`,
      icon: <VideoCameraFrontIcon sx={{ fontSize: 20 }} />
    },
    {
      label: 'Students',
      value: summary.totalStudents ?? 0,
      sub: `${summary.activeStudents ?? 0} active`,
      icon: <SchoolIcon sx={{ fontSize: 20 }} />
    },
    {
      label: 'Participation',
      value: summary.totalParticipation ?? 0,
      sub: `${summary.totalAttended ?? 0} attended · ${fmtDuration(summary.avgAttendedDurationSeconds)} avg`,
      icon: <BoltIcon sx={{ fontSize: 20 }} />
    },
    {
      label: 'Certificates',
      value: summary.totalCertificates ?? 0,
      sub: `${summary.activeCertificates ?? 0} active · ${summary.totalCertificatesIssued ?? 0} issued`,
      icon: <WorkspacePremiumIcon sx={{ fontSize: 20 }} />
    },
    {
      label: 'Admin Staff',
      value: summary.totalAdmins ?? 0,
      sub: `+${summary.totalSuperAdmins ?? 0} super admin · ${summary.totalUsers ?? 0} total`,
      icon: <AdminPanelSettingsIcon sx={{ fontSize: 20 }} />
    },
    {
      label: 'Registrations',
      value: summary.totalRegistrations ?? 0,
      sub: `${summary.totalCategories ?? 0} categories${summary.estimatedRevenue > 0 ? ` · ₹${summary.estimatedRevenue}` : ''}`,
      icon: <HowToRegIcon sx={{ fontSize: 20 }} />
    }
  ];

  const statusChip = (w) => {
    const base = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.6,
      px: 1.25,
      py: 0.45,
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: 600
    };
    if (w.isCompleted) {
      return (
        <Box sx={{ ...base, bgcolor: '#fef3c7', color: GOLD_DEEP }}>
          <CheckCircleIcon sx={{ fontSize: 15 }} /> Completed
        </Box>
      );
    }
    if (w.isMeetingCreated) {
      return (
        <Box sx={{ ...base, bgcolor: '#dcfce7', color: '#15803d' }}>
          <VideoCallIcon sx={{ fontSize: 15 }} /> Live ready
        </Box>
      );
    }
    return (
      <Box sx={{ ...base, bgcolor: colors.surfaceAlt, color: colors.textMuted }}>
        <AccessTimeIcon sx={{ fontSize: 15 }} /> Upcoming
      </Box>
    );
  };

  const tableCols = { xs: '1fr', md: 'minmax(0,2.4fr) minmax(0,1.1fr) minmax(0,1.4fr) minmax(0,1.2fr) minmax(0,1.1fr)' };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1680, mx: 'auto', width: '100%' }}>

      {/* ── Row 1: Executive Welcome Header Card ────────────── */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: '20px',
          p: { xs: 2.5, sm: 3 },
          mb: 3,
          bgcolor: colors.surface,
          border: `1px solid ${colors.border}`,
          boxShadow: '0 1px 3px rgba(15,23,42,0.03), 0 10px 28px -16px rgba(15,23,42,0.1)'
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 2.5
          }}
        >
          <Box>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.7,
                px: 1.25,
                py: 0.35,
                mb: 1.25,
                borderRadius: '999px',
                bgcolor: GOLD_SOFT,
                color: GOLD_DEEP,
                border: `1px solid ${GOLD}40`,
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.6px'
              }}
            >
              <FiberManualRecordIcon
                sx={{
                  fontSize: 9,
                  color: GOLD,
                  animation: 'pulse 2s infinite',
                  '@keyframes pulse': {
                    '0%': { opacity: 1, transform: 'scale(1)' },
                    '50%': { opacity: 0.4, transform: 'scale(1.3)' },
                    '100%': { opacity: 1, transform: 'scale(1)' }
                  }
                }}
              />
              LIVE DASHBOARD TELEMETRY
            </Box>

            <Typography sx={{ fontSize: { xs: '22px', sm: '26px' }, fontWeight: 800, color: colors.primary, letterSpacing: '-0.5px', lineHeight: 1.2 }}>
              Welcome back, <Box component="span" sx={{ color: GOLD_DEEP }}>Admin</Box>!
            </Typography>
            <Typography sx={{ color: colors.textMuted, fontSize: '13.5px', mt: 0.5, maxWidth: 620 }}>
              Platform metrics, student cohorts, and certificate operations at a glance.
              {lastUpdated && (
                <> Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.</>
              )}
            </Typography>

            {/* Quick telemetry indicators */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.6,
                  px: 1.25,
                  py: 0.45,
                  borderRadius: '999px',
                  bgcolor: colors.surfaceAlt || '#f8fafc',
                  border: `1px solid ${colors.border}`,
                  color: colors.primary,
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                <AccessTimeIcon sx={{ fontSize: 14, color: GOLD_DEEP }} />
                {summary.upcomingWebinars ?? 0} upcoming
              </Box>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.6,
                  px: 1.25,
                  py: 0.45,
                  borderRadius: '999px',
                  bgcolor: colors.surfaceAlt || '#f8fafc',
                  border: `1px solid ${colors.border}`,
                  color: colors.primary,
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                <VideoCallIcon sx={{ fontSize: 15, color: '#15803d' }} />
                {summary.activeMeetings ?? 0} meetings ready
              </Box>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.6,
                  px: 1.25,
                  py: 0.45,
                  borderRadius: '999px',
                  bgcolor: colors.surfaceAlt || '#f8fafc',
                  border: `1px solid ${colors.border}`,
                  color: colors.primary,
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                <CheckCircleIcon sx={{ fontSize: 14, color: '#15803d' }} />
                {summary.totalAttended ?? 0} attended
              </Box>
            </Box>
          </Box>

          {/* Action buttons */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              onClick={() => loadDashboardData(true)}
              disabled={loading || refreshing}
              startIcon={
                <RefreshIcon
                  sx={{
                    fontSize: 18,
                    animation: refreshing ? 'spin 1s linear infinite' : 'none',
                    '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } }
                  }}
                />
              }
              sx={{
                borderRadius: '12px',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '13px',
                px: 2.25,
                py: 1,
                color: colors.primary,
                borderColor: colors.border,
                bgcolor: colors.surface,
                '&:hover': { borderColor: GOLD, bgcolor: GOLD_SOFT }
              }}
            >
              {refreshing ? 'Syncing...' : 'Refresh'}
            </Button>

            <Button
              variant="contained"
              onClick={() => navigate('/admin/webinars')}
              endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
              sx={{
                borderRadius: '12px',
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '13px',
                px: 2.5,
                py: 1,
                bgcolor: GOLD,
                color: INK,
                boxShadow: `0 4px 14px -4px ${GOLD}`,
                '&:hover': { bgcolor: '#d97706', color: '#fff' }
              }}
            >
              Manage webinars
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* ── Row 2: Unified Professional KPI Tiles ─────────────── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))', md: 'repeat(3, minmax(0,1fr))', xl: 'repeat(6, minmax(0,1fr))' },
          gap: 2,
          mb: 3
        }}
      >
        {tiles.map((t) => (
          <StatTile key={t.label} {...t} loading={loading} colors={colors} />
        ))}
      </Box>

      {/* ── Row 3: Registrations vs Completions + Recent participants ── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(0, 1fr)' },
          gap: 3,
          mb: 3
        }}
      >
        {/* Dual-bar chart */}
        <Paper elevation={0} sx={{ ...cardSx, p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: '18px', fontWeight: 700, color: colors.primary, letterSpacing: '-0.3px' }}>
                Registrations vs Completions
              </Typography>
              <Chip
                label={`${recentWebinars.length} ${recentWebinars.length === 1 ? 'webinar' : 'webinars'}`}
                size="small"
                sx={{ height: 24, fontSize: '11px', fontWeight: 700, bgcolor: GOLD_SOFT, color: GOLD_DEEP }}
              />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '4px', background: 'linear-gradient(180deg, #F59E0B 0%, #D97706 100%)' }} />
                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: colors.primary }}>Total registration</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '4px', background: 'linear-gradient(180deg, #10B981 0%, #059669 100%)' }} />
                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: colors.primary }}>Completed webinar</Typography>
              </Box>
            </Box>
          </Box>

          {loading ? (
            <Skeleton variant="rounded" height={260} sx={{ borderRadius: '14px' }} />
          ) : recentWebinars.length === 0 ? (
            <Typography sx={{ color: colors.textMuted, fontSize: '13px', py: 8, textAlign: 'center' }}>
              No webinar sessions recorded yet.
            </Typography>
          ) : (
            <Box sx={{ overflowX: 'auto', pb: 0.5 }}>
              <Box sx={{ position: 'relative', minWidth: Math.max(recentWebinars.length * 110, 360) }}>
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
                      color: INK,
                      fontSize: '10.5px',
                      fontWeight: 700,
                      zIndex: 3
                    }}
                  >
                    max {maxWebinarMetric}
                  </Box>

                  <Box sx={{ position: 'absolute', inset: 0, display: 'flex', gap: 1.5, justifyContent: 'space-evenly' }}>
                    {recentWebinars.map((w) => {
                      const regCount = w.registrationCount || 0;
                      const compCount = w.completedCount ?? w.attendedCount ?? 0;
                      const regPct = (regCount / maxWebinarMetric) * 78;
                      const compPct = (compCount / maxWebinarMetric) * 78;
                      const rate = regCount > 0 ? Math.round((compCount / regCount) * 100) : 0;

                      return (
                        <Tooltip
                          key={w.id}
                          arrow
                          title={
                            <Box sx={{ p: 0.5 }}>
                              <Typography sx={{ fontSize: '12px', fontWeight: 700, mb: 0.5 }}>{w.webinarName}</Typography>
                              <Typography sx={{ fontSize: '11px', color: '#fef3c7' }}>Category: {w.categoryName}</Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: '#F59E0B' }} />
                                <Typography sx={{ fontSize: '11px' }}>Total registration: <strong>{regCount}</strong></Typography>
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
                                <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: '#10B981' }} />
                                <Typography sx={{ fontSize: '11px' }}>Completed webinar: <strong>{compCount}</strong></Typography>
                              </Box>
                              <Typography sx={{ fontSize: '10.5px', color: '#fde68a', mt: 0.5 }}>Turnout rate: {rate}%</Typography>
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
                              {/* Registration */}
                              <Box
                                sx={{
                                  position: 'relative',
                                  flex: '1 1 0',
                                  maxWidth: 32,
                                  height: `${Math.max(regPct, regCount > 0 ? 8 : 4)}%`,
                                  borderRadius: '9px 9px 3px 3px',
                                  background: regCount > 0
                                    ? 'linear-gradient(180deg, #F59E0B 0%, #D97706 100%)'
                                    : `repeating-linear-gradient(135deg, ${GOLD_SOFT} 0 4px, #fffbeb 4px 8px)`,
                                  boxShadow: regCount > 0 ? '0 8px 18px -8px rgba(245, 158, 11, 0.7)' : 'none',
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
                                    bgcolor: '#FEF3C7',
                                    color: '#B45309',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    lineHeight: 1.2,
                                    zIndex: 2
                                  }}
                                >
                                  {regCount}
                                </Box>
                              </Box>

                              {/* Completed */}
                              <Box
                                sx={{
                                  position: 'relative',
                                  flex: '1 1 0',
                                  maxWidth: 32,
                                  height: `${Math.max(compPct, compCount > 0 ? 8 : 4)}%`,
                                  borderRadius: '9px 9px 3px 3px',
                                  background: compCount > 0
                                    ? 'linear-gradient(180deg, #10B981 0%, #059669 100%)'
                                    : 'repeating-linear-gradient(135deg, #E6F4EA 0 4px, #f0fdf4 4px 8px)',
                                  boxShadow: compCount > 0 ? '0 8px 18px -8px rgba(16, 185, 129, 0.7)' : 'none',
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
                                    bgcolor: '#D1FAE5',
                                    color: '#065F46',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    lineHeight: 1.2,
                                    zIndex: 2
                                  }}
                                >
                                  {compCount}
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
                  {recentWebinars.map((w) => (
                    <Box key={w.id} sx={{ flex: '1 1 0', minWidth: 70, maxWidth: 120, textAlign: 'center' }}>
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
                          color: w.isCompleted ? '#059669' : colors.textMuted,
                          fontWeight: w.isCompleted ? 600 : 500
                        }}
                      >
                        {w.isCompleted ? 'Completed' : 'Upcoming'}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          )}
        </Paper>

        {/* Recent participants */}
        <Paper elevation={0} sx={{ ...cardSx, p: 3, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography sx={{ fontSize: '18px', fontWeight: 700, color: colors.primary, letterSpacing: '-0.3px' }}>
              Recent participants
            </Typography>
            <Typography
              onClick={() => navigate('/admin/participants')}
              sx={{ fontSize: '12.5px', fontWeight: 600, color: GOLD_DEEP, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
            >
              See all
            </Typography>
          </Box>

          <Box sx={{ flex: 1 }}>
            {loading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {[1, 2, 3, 4].map((k) => <Skeleton key={k} height={52} />)}
              </Box>
            ) : recentParticipants.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: GOLD_SOFT, color: GOLD_DEEP, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1.5 }}>
                  <HowToRegIcon />
                </Box>
                <Typography sx={{ color: colors.textMuted, fontSize: '13px' }}>
                  No completed attendances yet.
                </Typography>
              </Box>
            ) : (
              recentParticipants.map((p, i) => {
                const initial = (p.participantName || 'S').charAt(0).toUpperCase();
                return (
                  <Box
                    key={p.completionId}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1.5,
                      py: 1.4,
                      borderTop: i === 0 ? 'none' : `1px solid ${colors.border}`
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                      <Avatar
                        sx={{
                          width: 42,
                          height: 42,
                          background: `linear-gradient(135deg, ${GOLD} 0%, #ca8a04 100%)`,
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '15px'
                        }}
                      >
                        {initial}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography noWrap sx={{ fontSize: '13.5px', fontWeight: 700, color: colors.primary }}>
                          {p.participantName || 'Student'}
                        </Typography>
                        <Typography noWrap sx={{ fontSize: '12px', color: colors.textMuted }}>
                          {p.webinarName}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
                        <AccessTimeIcon sx={{ fontSize: 13, color: GOLD }} />
                        <Typography sx={{ fontSize: '12px', fontWeight: 700, color: colors.primary }}>
                          {fmtDuration(p.attendedDuration)}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          display: 'inline-block',
                          mt: 0.3,
                          px: 0.9,
                          py: 0.1,
                          borderRadius: '999px',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          bgcolor: p.isCertificateEligible ? '#dcfce7' : colors.surfaceAlt,
                          color: p.isCertificateEligible ? '#15803d' : colors.textMuted
                        }}
                      >
                        {p.isCertificateEligible ? 'Eligible' : 'Ineligible'}
                      </Box>
                    </Box>
                  </Box>
                );
              })
            )}
          </Box>

          <Button
            fullWidth
            variant="contained"
            onClick={() => navigate('/admin/participants')}
            sx={{
              mt: 2,
              borderRadius: '14px',
              textTransform: 'none',
              fontWeight: 700,
              py: 1.2,
              bgcolor: INK,
              color: '#fff',
              boxShadow: 'none',
              '&:hover': { bgcolor: '#292524' }
            }}
          >
            View participants table
          </Button>
        </Paper>
      </Box>

      {/* ── Row 4: Webinar tracker + Telemetry ───────────────── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(0, 1fr)' },
          gap: 3
        }}
      >
        {/* Webinar tracker */}
        <Paper elevation={0} sx={{ ...cardSx, p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Typography sx={{ fontSize: '18px', fontWeight: 700, color: colors.primary, letterSpacing: '-0.3px' }}>
                Webinar tracker
              </Typography>
              {summary.upcomingWebinars > 0 && (
                <Chip
                  label={`+${summary.upcomingWebinars} upcoming`}
                  size="small"
                  sx={{ height: 24, fontSize: '11px', fontWeight: 700, bgcolor: GOLD_SOFT, color: GOLD_DEEP }}
                />
              )}
            </Box>
            <Typography
              onClick={() => navigate('/admin/webinars')}
              sx={{ fontSize: '12.5px', fontWeight: 600, color: GOLD_DEEP, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
            >
              View all
            </Typography>
          </Box>

          <Box
            sx={{
              display: { xs: 'none', md: 'grid' },
              gridTemplateColumns: tableCols,
              gap: 2,
              px: 1.5,
              py: 1.25,
              borderRadius: '10px',
              bgcolor: colors.surfaceAlt
            }}
          >
            {['Webinar', 'Date', 'Time', 'Seats', 'Status'].map((h) => (
              <Typography key={h} sx={{ fontSize: '11.5px', color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {h}
              </Typography>
            ))}
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2 }}>
              {[1, 2, 3].map((k) => <Skeleton key={k} height={56} />)}
            </Box>
          ) : recentWebinars.length === 0 ? (
            <Typography sx={{ color: colors.textMuted, fontSize: '13px', py: 6, textAlign: 'center' }}>
              No webinar sessions recorded yet.
            </Typography>
          ) : (
            recentWebinars.map((w) => {
              const limit = w.participantLimit || 0;
              const seatPct = limit > 0 ? Math.min(100, Math.round(((w.registrationCount || 0) / limit) * 100)) : 0;
              return (
                <Box
                  key={w.id}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: tableCols,
                    alignItems: 'center',
                    gap: { xs: 1, md: 2 },
                    px: 1.5,
                    py: 1.6,
                    borderBottom: `1px solid ${colors.border}`,
                    transition: 'background 0.15s ease',
                    '&:hover': { bgcolor: `${GOLD_SOFT}80` },
                    '&:last-of-type': { borderBottom: 'none' }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                    <Avatar
                      variant="rounded"
                      sx={{ width: 40, height: 40, borderRadius: '12px', background: `linear-gradient(135deg, ${GOLD_SOFT} 0%, #fde68a 100%)`, color: GOLD_DEEP, fontWeight: 800, fontSize: '14px' }}
                    >
                      {(w.webinarName || 'W').charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: '13.5px', fontWeight: 700, color: colors.primary }}>
                        {w.webinarName}
                      </Typography>
                      <Typography noWrap sx={{ fontSize: '12px', color: colors.textMuted }}>
                        {w.categoryName} • {w.conductorName}
                      </Typography>
                    </Box>
                  </Box>

                  <Typography sx={{ fontSize: '13px', color: colors.primary }}>
                    {formatUtcToLocalDateOnly(w.startTime || w.webinarDate)}
                  </Typography>

                  <Typography sx={{ fontSize: '13px', color: colors.primary }}>
                    {formatUtcToLocalTimeOnly(w.startTime)} – {formatUtcToLocalTimeOnly(w.endTime)}
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1 }}>
                    <Box sx={{ position: 'relative', width: 28, height: 28, flexShrink: 0 }}>
                      <CircularProgress variant="determinate" value={100} size={28} thickness={5} sx={{ color: GOLD_SOFT, position: 'absolute', inset: 0 }} />
                      <CircularProgress
                        variant="determinate"
                        value={seatPct}
                        size={28}
                        thickness={5}
                        sx={{ color: GOLD, position: 'absolute', inset: 0, '& .MuiCircularProgress-circle': { strokeLinecap: 'round' } }}
                      />
                    </Box>
                    <Typography sx={{ fontSize: '13px', fontWeight: 600, color: colors.primary }}>
                      {w.registrationCount ?? 0}/{limit}
                    </Typography>
                  </Box>

                  <Box>{statusChip(w)}</Box>
                </Box>
              );
            })
          )}
        </Paper>

        {/* Telemetry */}
        <Paper elevation={0} sx={{ ...cardSx, p: 3, display: 'flex', flexDirection: 'column' }}>
          <Typography sx={{ fontSize: '18px', fontWeight: 700, color: colors.primary, letterSpacing: '-0.3px', mb: 2.5 }}>
            Platform telemetry
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, flex: 1 }}>
            {[
              { label: 'Attendance rate', value: attendanceRate, caption: `${summary.totalAttended ?? 0} of ${summary.totalParticipation ?? 0} attended` },
              { label: 'Certificate eligibility', value: certificateRate, caption: `${summary.totalCertificatesIssued ?? 0} certificates generated` },
              { label: 'Webinars completed', value: completedRate, caption: `${summary.completedWebinars ?? 0} done vs ${summary.upcomingWebinars ?? 0} upcoming` }
            ].map((g) => (
              <Box key={g.label} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {loading ? <Skeleton variant="circular" width={64} height={64} /> : <RingGauge value={g.value} />}
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: '13.5px', fontWeight: 700, color: colors.primary }}>{g.label}</Typography>
                  <Typography sx={{ fontSize: '12px', color: colors.textMuted }}>{g.caption}</Typography>
                </Box>
              </Box>
            ))}
          </Box>

          <Box
            sx={{
              mt: 3,
              p: 1.75,
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #1c1917 0%, #292524 100%)',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              textAlign: 'center'
            }}
          >
            {[
              { v: summary.paidWebinars ?? 0, l: 'Paid' },
              { v: summary.freeWebinars ?? 0, l: 'Free' },
              { v: summary.activeMeetings ?? 0, l: 'Meetings ready' }
            ].map((s, i) => (
              <Box key={s.l} sx={{ borderLeft: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.12)' }}>
                <Typography sx={{ fontSize: '20px', fontWeight: 800, color: GOLD }}>{s.v}</Typography>
                <Typography sx={{ fontSize: '11px', color: '#d6d3d1', fontWeight: 600 }}>{s.l}</Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
