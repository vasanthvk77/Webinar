import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  Dialog,
  DialogContent,
  DialogActions,
  Divider,
} from '@mui/material';

import BookmarkAddedIcon from '@mui/icons-material/BookmarkAdded';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ShareIcon from '@mui/icons-material/Share';
import EventIcon from '@mui/icons-material/Event';
import VideoCameraFrontIcon from '@mui/icons-material/VideoCameraFront';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SchoolIcon from '@mui/icons-material/School';
import toast from 'react-hot-toast';

import { webinarService, studentProfileService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useThemeColors, useAppTheme } from '../../context/ThemeContext';
import CardComponent, {
  WebinarPageHeader,
  GradientButton,
  formatCardDate,
  formatCardTime,
  formatCardDuration,
  formatAttendedDuration,
} from '../../components/CardComponent';
import {
  formatUtcToLocalDateOnly,
  formatUtcToLocalTimeOnly,
  isWebinarStartTimePast,
  parseUtcToBrowserDate,
} from '../../utils/validation';
import {
  getCurrencySymbolFromCountryCode,
  formatWebinarPrice,
} from '../../utils/countryUtils';

// Helper: Timing & Expiration status determination using EndTime & StartTime
const getWebinarTimingStatus = (webinarDate, startTime, endTime, isCompletedFlag) => {
  const now = new Date();

  // If session end time is already in the past, it has ended
  if (endTime) {
    const end = new Date(endTime);
    if (!isNaN(end.getTime()) && end < now) {
      return { label: 'Webinar Ended', type: 'PAST' };
    }
  }

  if (isCompletedFlag) {
    return { label: 'Completed', type: 'PAST' };
  }

  // If current time is between start and end time, it is live right now
  if (startTime && endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= now && end >= now) {
      return { label: 'Happening Now', type: 'LIVE' };
    }
  }

  if (!webinarDate && !startTime) return { label: 'Scheduled', type: 'UPCOMING' };

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDate = new Date(startTime || webinarDate);
    targetDate.setHours(0, 0, 0, 0);

    const diffDays = Math.round((targetDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: 'Webinar Ended', type: 'PAST' };
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

export default function StudentWebinars() {
  const colors = useThemeColors();
  const { isDark } = useAppTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab state: 'available' (default) | 'registered' | 'completed'
  const tabParam = searchParams.get('tab');
  const initialTab =
    tabParam === 'registered' || tabParam === 'completed'
      ? tabParam
      : 'available';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Student country code for dynamic currency conversion
  const [countryCode, setCountryCode] = useState(() => user?.countryCode || null);

  // Synchronize countryCode whenever user context updates
  useEffect(() => {
    if (user?.countryCode) {
      setCountryCode(user.countryCode);
    }
  }, [user?.countryCode]);

  // Raw API datasets
  const [availableWebinars, setAvailableWebinars] = useState([]);
  const [registeredWebinars, setRegisteredWebinars] = useState([]);
  const [completedWebinars, setCompletedWebinars] = useState([]);

  // Action states
  const [registeringId, setRegisteringId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [detailsModalWebinar, setDetailsModalWebinar] = useState(null);

  // Seat hold modal & countdown states (BookMyShow pattern)
  const [activeHold, setActiveHold] = useState(null); // { webinar, holdToken, expiresAt, remainingSeconds }
  const [holdCountdown, setHoldCountdown] = useState(300);
  const [confirmingHold, setConfirmingHold] = useState(false);

  // Keep activeTab synchronized if URL query changes
  useEffect(() => {
    if (tabParam === 'registered' || tabParam === 'completed' || tabParam === 'available') {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // Industry-standard revalidation: always fetch fresh student profile on mount
  useEffect(() => {
    studentProfileService
      .getProfile()
      .then((res) => {
        if (res.data?.success && res.data.data?.countryCode) {
          setCountryCode(res.data.data.countryCode);
          try {
            const stored = JSON.parse(localStorage.getItem('user') || '{}');
            stored.countryCode = res.data.data.countryCode;
            localStorage.setItem('user', JSON.stringify(stored));
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setSearch('');
    setSearchParams({ tab: newTab });
  };

  // ── Load All Data concurrently from backend APIs ──────────
  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [availRes, regRes, compRes] = await Promise.all([
        webinarService.getUpcoming().catch((err) => {
          console.error('Error fetching available webinars:', err);
          return { data: { success: false, data: [] } };
        }),
        webinarService.getRegistered().catch((err) => {
          console.error('Error fetching registered webinars:', err);
          return { data: { success: false, data: [] } };
        }),
        webinarService.getCompleted().catch((err) => {
          console.error('Error fetching completed webinars:', err);
          return { data: { success: false, data: [] } };
        }),
      ]);

      const avail = availRes.data?.data || [];
      const reg = regRes.data?.data || [];
      const comp = compRes.data?.data || [];

      if (availRes.data?.success) {
        setAvailableWebinars(avail);
      }
      if (regRes.data?.success) {
        setRegisteredWebinars(reg);
      }
      if (compRes.data?.success) {
        setCompletedWebinars(comp);
      }

      // ── Intelligent Step-by-Step Default Tab Selection (when no ?tab= is specified in URL) ──
      const currentTabInUrl = searchParams.get('tab');
      if (!currentTabInUrl) {
        const now = Date.now();
        const regSet = new Set(reg.map((r) => r.id || r.webinarId));

        // Step 1: Any webinar with Current < StartTime AND NOT registered == TRUE? Show Available tab
        const hasUpcomingAvailable = avail.some((w) => {
          const wid = w.id || w.webinarId;
          if (regSet.has(wid) || Boolean(w.isRegistered)) return false;
          const startLocal = parseUtcToBrowserDate(w.startTime);
          return startLocal && now < startLocal.getTime();
        });

        // Step 2: False? Check Current < StartTime AND Registered == TRUE? Show Registered tab
        const hasUpcomingRegistered = reg.some((w) => {
          const startLocal = parseUtcToBrowserDate(w.startTime);
          return startLocal && now < startLocal.getTime();
        });

        // Step 3: False? Check if Completed webinars exist? Show Completed tab
        const hasCompleted = comp.length > 0;

        // Step-by-step resolution
        let targetTab = 'available';
        if (hasUpcomingAvailable) {
          targetTab = 'available';
        } else if (hasUpcomingRegistered) {
          targetTab = 'registered';
        } else if (hasCompleted) {
          targetTab = 'completed';
        } else {
          targetTab = 'available';
        }

        setActiveTab(targetTab);
      }
    } catch (err) {
      console.error('Failed to load webinar data:', err);
      toast.error('Unable to fetch webinar records. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Tick active hold countdown timer
  useEffect(() => {
    if (!activeHold) return;
    const interval = setInterval(() => {
      setHoldCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setActiveHold(null);
          toast.error('Your 5-minute reservation hold has expired. The seat has been released.');
          loadAllData();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeHold, loadAllData]);

  // Set of registered webinar IDs for fast lookup
  const registeredIds = useMemo(() => {
    return new Set(registeredWebinars.map((rw) => rw.id || rw.webinarId));
  }, [registeredWebinars]);

  // Set of attended / completed webinar IDs from wms.WebinarCompleted
  const attendedCompletedIds = useMemo(() => {
    return new Set(completedWebinars.map((cw) => cw.id || cw.webinarId));
  }, [completedWebinars]);

  // Truly active/open upcoming webinars (excluding past expired sessions)
  const trulyAvailableWebinars = useMemo(() => {
    return availableWebinars.filter((w) => {
      const timing = getWebinarTimingStatus(w.webinarDate, w.startTime, w.endTime, w.isCompleted);
      return timing.type !== 'PAST';
    });
  }, [availableWebinars]);

  // ── Dynamic statistics computed purely from API records ────
  // Total Hours MUST strictly derive from actual AttendedDuration of COMPLETED webinars
  const stats = useMemo(() => {
    const enrolledCount = registeredWebinars.length;
    const availableCount = trulyAvailableWebinars.length;
    const completedCount = completedWebinars.length;

    let totalAttendedSeconds = 0;
    completedWebinars.forEach((cw) => {
      totalAttendedSeconds += cw.attendedDuration || 0;
    });

    const hoursNumeric = totalAttendedSeconds / 3600;
    const formattedHours =
      hoursNumeric % 1 === 0 ? `${hoursNumeric}h` : `${hoursNumeric.toFixed(1)}h`;

    return {
      enrolled: enrolledCount,
      available: availableCount,
      completed: completedCount,
      hours: formattedHours,
    };
  }, [registeredWebinars, trulyAvailableWebinars, completedWebinars]);

  // ── Share webinar link handler ─────────────────────────────
  const handleCopyLink = (shareId, e) => {
    e?.stopPropagation();
    if (!shareId) {
      toast.error('Share link unavailable for this session');
      return;
    }
    const url = `${window.location.origin}/register?trackingId=${shareId}`;
    navigator.clipboard.writeText(url);
    toast.success('Webinar link copied to clipboard!');
  };

  // ── Add to Google Calendar handler ─────────────────────────
  const handleAddToCalendar = (w) => {
    try {
      const startTimeVal = w.startTime;
      const endTimeVal = w.endTime || w.startTime;
      if (!startTimeVal) {
        toast.error('Session time not specified');
        return;
      }
      const start = new Date(startTimeVal).toISOString().replace(/-|:|\.\d\d\d/g, '');
      const end = new Date(endTimeVal).toISOString().replace(/-|:|\.\d\d\d/g, '');
      const title = encodeURIComponent(w.webinarName || 'Webinar Session');
      const details = encodeURIComponent(
        `Webinar hosted by ${w.conductorName || 'Weblearn'}.\nWebinar portal: ${window.location.origin}`
      );
      const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}`;
      window.open(gcalUrl, '_blank');
    } catch {
      toast.error('Could not generate calendar link');
    }
  };

  // ── Register for Available Webinar handler ──
  const handleRegister = async (webinar) => {
    // Paid webinars: navigate to the registration screen
    if (webinar.isPaid) {
      navigate(`/register?trackingId=${webinar.shareId}`);
      return;
    }

    const currentUserId = user?.userId || user?.id;
    setRegisteringId(webinar.id);
    try {
      // Free webinars on dashboard: hold seat and show confirmation
      const holdRes = await webinarService.holdSeat(webinar.shareId || webinar.id, currentUserId);
      if (holdRes.data?.success && holdRes.data?.data) {
        const holdData = holdRes.data.data;
        setActiveHold({
          webinar,
          holdToken: holdData.holdToken,
          expiresAt: holdData.expiresAt,
        });
        setHoldCountdown(holdData.remainingSeconds || 300);
      } else {
        toast.error(holdRes.data?.message || 'Seat could not be reserved');
        await loadAllData();
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Unable to reserve seat for this session';
      toast.error(errMsg);
      await loadAllData();
    } finally {
      setRegisteringId(null);
    }
  };

  // ── Finalize Confirmation with HoldToken (Case A) ───────────
  const handleConfirmReservation = async () => {
    if (!activeHold) return;
    const currentUserId = user?.userId || user?.id;
    setConfirmingHold(true);
    try {
      const res = await webinarService.registerTracking(
        activeHold.webinar.shareId || activeHold.webinar.id,
        currentUserId,
        activeHold.holdToken
      );

      if (res.data?.success) {
        toast.success(res.data.message || 'Seat confirmed successfully!');
        setActiveHold(null);
        await loadAllData();
      } else {
        toast.error(res.data?.message || 'Registration failed');
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Registration could not be completed';
      toast.error(errMsg);
      setActiveHold(null);
      await loadAllData();
    } finally {
      setConfirmingHold(false);
    }
  };

  // ── Certificate Download handler (QuestPDF via API) ────────
  const triggerBlobDownload = (blobData, filename) => {
    const url = window.URL.createObjectURL(new Blob([blobData], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 2000);
  };

  const handleDownloadCertificate = async (webinar) => {
    const wid = webinar.webinarId || webinar.id;
    setDownloadingId(wid);
    try {
      const res = await webinarService.downloadStudentCertificate(wid);
      const filename = `Certificate_${(webinar.webinarName || 'Webinar').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      triggerBlobDownload(res.data, filename);
      toast.success('Certificate downloaded successfully!');
    } catch (err) {
      console.error('Error downloading certificate:', err);
      toast.error('Failed to download certificate. Please verify eligibility.');
    } finally {
      setDownloadingId(null);
    }
  };

  // ── Filtered data based on search and active tab ───────────
  const currentList = useMemo(() => {
    let list = [];
    if (activeTab === 'available') {
      list = trulyAvailableWebinars;
    } else if (activeTab === 'registered') {
      list = registeredWebinars;
    } else if (activeTab === 'completed') {
      list = completedWebinars;
    }

    if (!search.trim()) return list;

    const q = search.trim().toLowerCase();
    return list.filter((item) => {
      const name = (item.webinarName || '').toLowerCase();
      const cond = (item.conductorName || '').toLowerCase();
      const cat = (item.categoryName || '').toLowerCase();
      return name.includes(q) || cond.includes(q) || cat.includes(q);
    });
  }, [activeTab, search, trulyAvailableWebinars, registeredWebinars, completedWebinars]);

  // Tab metadata & search placeholder
  const tabMetadata = useMemo(() => {
    switch (activeTab) {
      case 'registered':
        return {
          title: 'Webinars',
          subtitle: 'Manage your scheduled video masterclasses, live links, and attendance details.',
          searchPlaceholder: 'Search registered sessions...',
          emptyTitle: registeredWebinars.length === 0
            ? "You haven't registered for any webinars yet"
            : 'No sessions match your search',
          emptySubtitle: registeredWebinars.length === 0
            ? 'Discover upcoming live masterclasses on our Available tab and reserve your seat today!'
            : 'Try adjusting your search query to view all enrolled sessions.',
          emptyActionLabel: 'Explore Available Webinars',
          onEmptyAction: () => handleTabChange('available'),
        };
      case 'completed':
        return {
          title: 'Webinars',
          subtitle: 'Review your completed sessions, attendance duration, and download earned certificates.',
          searchPlaceholder: 'Search completed sessions...',
          emptyTitle: completedWebinars.length === 0
            ? 'No completed webinars yet'
            : 'No sessions match your search',
          emptySubtitle: completedWebinars.length === 0
            ? 'Join live webinars, attend scheduled sessions, and earn your verified digital credentials!'
            : 'Try adjusting your search criteria to view all completed sessions.',
          emptyActionLabel: 'Browse Available Webinars',
          onEmptyAction: () => handleTabChange('available'),
        };
      case 'available':
      default:
        return {
          title: 'Webinars',
          subtitle: 'Browse all upcoming interactive workshops led by industry specialists.',
          searchPlaceholder: 'Search available webinars...',
          emptyTitle: trulyAvailableWebinars.length === 0
            ? 'No available webinars scheduled right now'
            : 'No webinars match your search',
          emptySubtitle: trulyAvailableWebinars.length === 0
            ? 'Please check back soon for new workshops and industry sessions.'
            : 'Try clearing your search query to see all available workshops.',
          emptyActionLabel: search ? 'Clear Search' : null,
          onEmptyAction: () => setSearch(''),
        };
    }
  }, [activeTab, registeredWebinars.length, completedWebinars.length, trulyAvailableWebinars.length, search]);

  return (
    <Box
      sx={{
        minHeight: 'calc(100vh - 110px)',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        mx: 'auto',
        p: { xs: 2, sm: 3 },
      }}
    >
      {/* ── Top Row: Hero Banner + Metric Cards + 3 Tabs Filter + Search ─ */}
      <WebinarPageHeader
        title={tabMetadata.title}
        subtitle={tabMetadata.subtitle}
        metrics={[
          { label: 'Enrolled Webinars', value: stats.enrolled, type: 'orange' },
          { label: 'Upcoming Sessions', value: stats.available, type: 'blue' },
          { label: 'Completed Sessions', value: stats.completed, type: 'green' },
          { label: 'Total Hours', value: stats.hours, type: 'purple' },
        ]}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={tabMetadata.searchPlaceholder}
        filters={[
          { id: 'available', label: `Available (${trulyAvailableWebinars.length})` },
          { id: 'registered', label: `Registered (${registeredWebinars.length})` },
          { id: 'completed', label: `Completed (${completedWebinars.length})` },
        ]}
        activeFilter={activeTab}
        onFilterChange={handleTabChange}
        onExploreClick={() => handleTabChange('available')}
      />

      {/* ── Content Grid / Loading / Empty States ───────────────────────── */}
      <Box sx={{ flexGrow: 1, mt: 1 }}>
        {loading ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 12,
              gap: 2,
            }}
          >
            <CircularProgress size={42} thickness={4.5} sx={{ color: '#EA580C' }} />
            <Typography variant="body2" sx={{ color: colors.textSecondary, fontWeight: 600 }}>
              Loading webinar data from server...
            </Typography>
          </Box>
        ) : currentList.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              py: 8,
              px: 3,
              textAlign: 'center',
              borderRadius: '22px',
              bgcolor: isDark ? 'rgba(234, 88, 12, 0.04)' : '#FFF7ED',
              border: isDark ? '2px dashed rgba(234, 88, 12, 0.25)' : '2px dashed #FED7AA',
              maxWidth: 600,
              mx: 'auto',
              mt: 2,
            }}
          >
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                bgcolor: isDark ? 'rgba(234, 88, 12, 0.12)' : '#FFEDD5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
              }}
            >
              {activeTab === 'completed' ? (
                <CheckCircleIcon sx={{ fontSize: 38, color: '#EA580C' }} />
              ) : activeTab === 'registered' ? (
                <BookmarkAddedIcon sx={{ fontSize: 38, color: '#EA580C' }} />
              ) : (
                <EventIcon sx={{ fontSize: 38, color: '#EA580C' }} />
              )}
            </Box>

            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                color: isDark ? colors.textPrimary : '#9A3412',
                mb: 0.75,
              }}
            >
              {tabMetadata.emptyTitle}
            </Typography>

            <Typography
              variant="body2"
              sx={{
                color: isDark ? colors.textSecondary : '#C2410C',
                maxWidth: 440,
                mx: 'auto',
                mb: 3,
                lineHeight: 1.6,
              }}
            >
              {tabMetadata.emptySubtitle}
            </Typography>

            {tabMetadata.emptyActionLabel && (
              <Button
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                onClick={tabMetadata.onEmptyAction}
                sx={{
                  bgcolor: '#EA580C',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  textTransform: 'none',
                  px: 3.5,
                  py: 1.1,
                  borderRadius: '12px',
                  boxShadow: '0 6px 16px rgba(234, 88, 12, 0.25)',
                  '&:hover': { bgcolor: '#C2410C' },
                }}
              >
                {tabMetadata.emptyActionLabel}
              </Button>
            )}
          </Paper>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              gap: 2.5,
              alignItems: 'stretch',
              width: '100%',
            }}
          >
            {currentList.map((w) => {
              const wid = w.webinarId || w.id;
              const timing = getWebinarTimingStatus(
                w.webinarDate,
                w.startTime,
                w.endTime,
                w.isCompleted
              );
              const isRegistered = Boolean(w.isRegistered) || registeredIds.has(wid);
              const hasAttendedCompleted = attendedCompletedIds.has(wid);
              const isSessionEnded = timing.type === 'PAST';
              const isStartTimePast = isWebinarStartTimePast(w.startTime);
              const isEligible = Boolean(w.canDownloadCertificate);
              const isDownloading = downloadingId === wid;
              const isRegistering = registeringId === wid;

              // Format price with the student's country currency symbol
              const formattedPrice = formatWebinarPrice(w.isPaid, w.price, countryCode);

              // ── Tab 1: Available Webinars ──
              if (activeTab === 'available') {
                const availableStatusLabel = isSessionEnded ? 'Webinar Ended' : timing.label;
                return (
                  <Box key={`available-${wid}`} sx={{ display: 'flex', width: '100%', minWidth: 0 }}>
                    <CardComponent
                      webinar={w}
                      type="upcoming"
                      countryCode={countryCode}
                      statusLabel={availableStatusLabel}
                      price={formattedPrice}
                      primaryLabel={
                        isRegistering
                          ? 'Registering...'
                          : isSessionEnded
                          ? 'Webinar Ended'
                          : isRegistered
                          ? 'View Details'
                          : 'Register Now'
                      }
                      primaryDisabled={isSessionEnded && !isRegistered}
                      primaryLoading={isRegistering}
                      onPrimaryClick={
                        isSessionEnded && !isRegistered
                          ? undefined
                          : isRegistered
                          ? () => setDetailsModalWebinar(w)
                          : () => handleRegister(w)
                      }
                      secondaryLabel="Details"
                      onSecondaryClick={() => setDetailsModalWebinar(w)}
                      onCalendarClick={() => handleAddToCalendar(w)}
                      onShareClick={isStartTimePast ? undefined : (e) => handleCopyLink(w.shareId, e)}
                    />
                  </Box>
                );
              }

              // ── Tab 2: Registered Webinars ──
              if (activeTab === 'registered') {
                const canJoinNow = timing.type === 'LIVE' || timing.type === 'TODAY';
                
                // EXACT USER LOGIC:
                // 1) If registered and session ended (EndTime < Current) AND NOT attended/completed in WebinarCompleted:
                //    Show "Webinar Ended (Not Attended)"
                // 2) If registered and attended/completed:
                //    Show "Completed"
                // 3) Else upcoming/live:
                //    Show live/scheduled status
                let registeredStatusLabel = timing.label;
                let registeredBadgeType = 'UPCOMING';

                if (isSessionEnded) {
                  if (hasAttendedCompleted) {
                    registeredStatusLabel = 'Completed';
                    registeredBadgeType = 'COMPLETED';
                  } else {
                    registeredStatusLabel = 'Webinar Ended (Not Attended)';
                    registeredBadgeType = 'MISSED';
                  }
                } else if (hasAttendedCompleted) {
                  registeredStatusLabel = 'Completed';
                  registeredBadgeType = 'COMPLETED';
                }

                return (
                  <Box key={`registered-${wid}`} sx={{ display: 'flex', width: '100%', minWidth: 0 }}>
                    <CardComponent
                      webinar={w}
                      type="registered"
                      countryCode={countryCode}
                      statusLabel={registeredStatusLabel}
                      price={formattedPrice}
                      primaryLabel={
                        isSessionEnded
                          ? 'Session Details'
                          : canJoinNow
                          ? 'Join Webinar'
                          : 'Session Details'
                      }
                      onPrimaryClick={() => setDetailsModalWebinar(w)}
                      secondaryLabel="Details"
                      onSecondaryClick={() => setDetailsModalWebinar(w)}
                      onCalendarClick={() => handleAddToCalendar(w)}
                      onShareClick={isStartTimePast ? undefined : (e) => handleCopyLink(w.shareId, e)}
                    />
                  </Box>
                );
              }

              // ── Tab 3: Completed Webinars ──
              return (
                <Box key={`completed-${wid}`} sx={{ display: 'flex', width: '100%', minWidth: 0 }}>
                  <CardComponent
                    webinar={w}
                    type="completed"
                    countryCode={countryCode}
                    statusLabel={isEligible ? 'Certificate Ready' : 'Completed'}
                    price={formattedPrice}
                    primaryLabel={
                      isDownloading
                        ? 'Generating...'
                        : isEligible
                        ? 'Download Certificate'
                        : 'Session Completed'
                    }
                    primaryDisabled={!isEligible || isDownloading}
                    primaryLoading={isDownloading}
                    onPrimaryClick={isEligible ? () => handleDownloadCertificate(w) : undefined}
                    secondaryLabel="Details"
                    onSecondaryClick={() => setDetailsModalWebinar(w)}
                    onShareClick={undefined}
                  />
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      {/* ── Webinar Details / Join Session Modal ───────────────────────── */}
      {detailsModalWebinar && (
        <Dialog
          open={Boolean(detailsModalWebinar)}
          onClose={() => setDetailsModalWebinar(null)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: '24px',
              bgcolor: colors.surface,
              overflow: 'hidden',
              boxShadow: '0 25px 70px rgba(15, 23, 42, 0.28)',
            },
          }}
        >
          {/* Modal Header Banner */}
          <Box
            sx={{
              px: 3,
              py: 2.2,
              background: 'linear-gradient(120deg, #0F172A 0%, #1E293B 100%)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '3px solid #EA580C',
            }}
          >
            <Chip
              label={detailsModalWebinar.categoryName || 'General'}
              size="small"
              sx={{
                bgcolor: 'rgba(255,255,255,0.14)',
                color: '#FFFFFF',
                fontWeight: 700,
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Chip
              label={formatWebinarPrice(
                detailsModalWebinar.isPaid,
                detailsModalWebinar.price,
                countryCode
              )}
              size="small"
              sx={{
                bgcolor: '#EA580C',
                color: '#FFFFFF',
                fontWeight: 800,
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
          </Box>

          <DialogContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 850,
                color: isDark ? colors.textPrimary : '#0F172A',
                mb: 1.25,
                lineHeight: 1.25,
              }}
            >
              {detailsModalWebinar.webinarName}
            </Typography>

            <Typography
              variant="body2"
              sx={{
                color: isDark ? colors.textSecondary : '#64748B',
                mb: 3,
                fontSize: '13.5px',
              }}
            >
              Hosted by{' '}
              <strong style={{ color: isDark ? '#FFFFFF' : '#0F172A' }}>
                {detailsModalWebinar.conductorName || 'Industry Expert'}
              </strong>
              {detailsModalWebinar.conductorEmail && ` (${detailsModalWebinar.conductorEmail})`}
            </Typography>

            {/* Session Info Grid */}
            <Box
              sx={{
                bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E2E8F0',
                borderRadius: '16px',
                p: 2.25,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
                mb: 3,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <CalendarMonthIcon sx={{ color: '#EA580C', fontSize: 22 }} />
                <Box>
                  <Typography variant="caption" sx={{ color: colors.textSecondary, display: 'block', fontWeight: 600 }}>
                    Date
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: colors.textPrimary }}>
                    {formatCardDate(detailsModalWebinar.webinarDate)}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <AccessTimeIcon sx={{ color: '#EA580C', fontSize: 22 }} />
                <Box>
                  <Typography variant="caption" sx={{ color: colors.textSecondary, display: 'block', fontWeight: 600 }}>
                    Schedule
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: colors.textPrimary }}>
                    {formatCardTime(detailsModalWebinar.startTime)}
                    {detailsModalWebinar.durationMinutes
                      ? ` (${formatCardDuration(detailsModalWebinar.durationMinutes)})`
                      : ''}
                  </Typography>
                </Box>
              </Box>

              {detailsModalWebinar.participantLimit && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <SchoolIcon sx={{ color: '#EA580C', fontSize: 22 }} />
                  <Box>
                    <Typography variant="caption" sx={{ color: colors.textSecondary, display: 'block', fontWeight: 600 }}>
                      Capacity
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: colors.textPrimary }}>
                      {detailsModalWebinar.participantLimit} Seats Max
                    </Typography>
                  </Box>
                </Box>
              )}

              {detailsModalWebinar.attendedDuration != null && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <CheckCircleIcon sx={{ color: '#16A34A', fontSize: 22 }} />
                  <Box>
                    <Typography variant="caption" sx={{ color: colors.textSecondary, display: 'block', fontWeight: 600 }}>
                      Attended Time
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#16A34A' }}>
                      {formatAttendedDuration(detailsModalWebinar.attendedDuration)}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>

            {/* Quick Actions in Modal */}
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<CalendarMonthIcon />}
                onClick={() => handleAddToCalendar(detailsModalWebinar)}
                sx={{
                  borderRadius: '10px',
                  borderColor: '#FED7AA',
                  color: '#EA580C',
                  fontWeight: 700,
                  textTransform: 'none',
                  '&:hover': { bgcolor: '#FFF7ED', borderColor: '#EA580C' },
                }}
              >
                Add to Calendar
              </Button>
              {!isWebinarStartTimePast(detailsModalWebinar.startTime) && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<ShareIcon />}
                  onClick={(e) => handleCopyLink(detailsModalWebinar.shareId, e)}
                  sx={{
                    borderRadius: '10px',
                    borderColor: '#FED7AA',
                    color: '#EA580C',
                    fontWeight: 700,
                    textTransform: 'none',
                    '&:hover': { bgcolor: '#FFF7ED', borderColor: '#EA580C' },
                  }}
                >
                  Share Link
                </Button>
              )}
            </Box>
          </DialogContent>

          <Divider sx={{ borderColor: colors.border }} />

          <DialogActions sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'space-between' }}>
            <Button
              onClick={() => setDetailsModalWebinar(null)}
              sx={{ color: colors.textSecondary, fontWeight: 700, textTransform: 'none' }}
            >
              Close
            </Button>

            {/* If eligible for certificate download */}
            {detailsModalWebinar.canDownloadCertificate && (
              <GradientButton
                onClick={() => handleDownloadCertificate(detailsModalWebinar)}
                loading={downloadingId === (detailsModalWebinar.webinarId || detailsModalWebinar.id)}
                size="small"
              >
                Download Certificate
              </GradientButton>
            )}

            {/* If unregistered in available tab and session not in past */}
            {activeTab === 'available' &&
              !detailsModalWebinar.isRegistered &&
              !registeredIds.has(detailsModalWebinar.id) && (
                <GradientButton
                  onClick={() => {
                    setDetailsModalWebinar(null);
                    handleRegister(detailsModalWebinar);
                  }}
                  loading={registeringId === detailsModalWebinar.id}
                  size="small"
                >
                  Register Now
                </GradientButton>
              )}
          </DialogActions>
        </Dialog>
      )}

      {/* ── BookMyShow-style Seat Reservation Hold Modal with Live 5:00 Timer ── */}
      {activeHold && (
        <Dialog
          open={Boolean(activeHold)}
          onClose={() => {
            if (!confirmingHold) {
              setActiveHold(null);
            }
          }}
          maxWidth="xs"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: '24px',
              bgcolor: colors.surface,
              p: 1,
              boxShadow: '0 25px 70px rgba(15, 23, 42, 0.35)',
            },
          }}
        >
          <Box
            sx={{
              p: 3,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            {/* Urgency Icon Header */}
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                bgcolor: '#FFF7ED',
                border: '2px solid #FED7AA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 2,
              }}
            >
              <AccessTimeIcon sx={{ fontSize: 32, color: '#EA580C' }} />
            </Box>

            <Typography variant="h6" sx={{ fontWeight: 850, color: colors.textPrimary, mb: 0.5 }}>
              Seat Temporarily Held!
            </Typography>

            <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2.5, px: 1 }}>
              Your seat for <strong>{activeHold.webinar?.webinarName}</strong> is reserved exclusively for you. Please confirm your registration before time expires.
            </Typography>

            {/* Countdown Badge */}
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                px: 2.5,
                py: 1,
                borderRadius: '100px',
                bgcolor: holdCountdown <= 60 ? '#FEE2E2' : '#FFF7ED',
                border: `1.5px solid ${holdCountdown <= 60 ? '#FCA5A5' : '#FED7AA'}`,
                color: holdCountdown <= 60 ? '#DC2626' : '#C2410C',
                mb: 3,
              }}
            >
              <AccessTimeIcon sx={{ fontSize: 18 }} />
              <Typography sx={{ fontWeight: 850, fontSize: '17px', letterSpacing: '1px' }}>
                {Math.floor(holdCountdown / 60)}:
                {String(holdCountdown % 60).padStart(2, '0')}
              </Typography>
            </Box>

            {/* Action Buttons */}
            <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              <Button
                fullWidth
                variant="contained"
                onClick={handleConfirmReservation}
                disabled={confirmingHold}
                sx={{
                  py: 1.35,
                  borderRadius: '12px',
                  bgcolor: '#EA580C',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '15px',
                  textTransform: 'none',
                  boxShadow: '0 8px 20px -4px rgba(234, 88, 12, 0.4)',
                  '&:hover': { bgcolor: '#C2410C' },
                }}
              >
                {confirmingHold ? 'Confirming...' : 'Confirm Seat Now'}
              </Button>

              <Button
                fullWidth
                variant="text"
                disabled={confirmingHold}
                onClick={() => setActiveHold(null)}
                sx={{
                  py: 1,
                  color: colors.textSecondary,
                  fontWeight: 600,
                  textTransform: 'none',
                  '&:hover': { bgcolor: 'transparent', color: colors.textPrimary },
                }}
              >
                Cancel & Release Seat
              </Button>
            </Box>
          </Box>
        </Dialog>
      )}
    </Box>
  );
}
