import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Calendar as CalendarIcon,
  Clock,
  Share2,
  Download,
  Video,
  CheckCircle2,
  Check,
  Award,
  Search,
} from 'lucide-react';
import { useThemeColors, useAppTheme } from '../context/ThemeContext';
import { formatUtcToLocalDateOnly, formatUtcToLocalTimeOnly, isWebinarStartTimePast } from '../utils/validation';
import { getCurrencySymbolFromCountryCode } from '../utils/countryUtils';

// Helper: Resolve full webinar image URL
export const getFullWebinarImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const apiBase = (import.meta.env.VITE_API_BASE_URL || 'https://localhost:7001').replace(/\/$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${apiBase}${cleanPath}`;
};

// Helper: Format Date
export const formatCardDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    return formatUtcToLocalDateOnly(dateStr);
  } catch {
    return String(dateStr);
  }
};

// Helper: Format Time
export const formatCardTime = (timeStr) => {
  if (!timeStr) return '';
  try {
    return formatUtcToLocalTimeOnly(timeStr);
  } catch {
    return String(timeStr);
  }
};

// Helper: Format Duration in human-readable form
export const formatCardDuration = (mins) => {
  if (!mins || mins <= 0) return '';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

// Format attended duration from seconds
export const formatAttendedDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

// ============================================================================
// GradientButton Component
// Reusable button with the application's signature warm orange gradient.
// ============================================================================
export function GradientButton({
  children,
  onClick,
  disabled = false,
  loading = false,
  startIcon,
  endIcon,
  fullWidth = false,
  size = 'medium',
  sx = {},
  ...props
}) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled || loading}
      fullWidth={fullWidth}
      startIcon={loading ? <CircularProgress size={16} sx={{ color: '#FFFFFF' }} /> : startIcon}
      endIcon={!loading ? endIcon : null}
      sx={{
        py: size === 'small' ? 0.8 : 1,
        px: size === 'small' ? 2 : 2.5,
        borderRadius: '14px',
        background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)',
        color: '#FFFFFF',
        fontWeight: 750,
        fontSize: size === 'small' ? '0.78rem' : '0.84rem',
        textTransform: 'none',
        letterSpacing: '0.2px',
        boxShadow: '0 4px 14px rgba(234, 88, 12, 0.28)',
        border: 'none',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          background: 'linear-gradient(135deg, #C2410C 0%, #EA580C 100%)',
          boxShadow: '0 6px 18px rgba(234, 88, 12, 0.38)',
          transform: 'translateY(-1px)',
        },
        '&:active': {
          transform: 'scale(0.99)',
        },
        '&.Mui-disabled': {
          background: '#E2E8F0',
          color: '#94A3B8',
          boxShadow: 'none',
        },
        ...sx,
      }}
      {...props}
    >
      {children}
    </Button>
  );
}

// ============================================================================
// Cyber Tech Fallback Thumbnail
// Sleek AI tech thumbnail illustration shown ONLY when no cover image is uploaded.
// ============================================================================
function CyberThumbnailFallback({ category = '', title = '', id = 0 }) {
  const isAlt = (Number(id) || title.length) % 2 === 0;
  const displayLabel = category || (title ? title.slice(0, 15) : 'Webinar');

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        minHeight: 180,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        background: isAlt
          ? 'radial-gradient(circle at 50% 50%, #0c2d48 0%, #031424 70%, #000c18 100%)'
          : 'radial-gradient(circle at 50% 50%, #1a1744 0%, #0b0c26 65%, #050515 100%)',
        p: 2,
      }}
    >
      {/* Background Cyber Grid */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          opacity: 0.18,
          backgroundImage: `
            linear-gradient(to right, rgba(56, 189, 248, 0.2) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(56, 189, 248, 0.2) 1px, transparent 1px)
          `,
          backgroundSize: '14px 14px',
          pointerEvents: 'none',
        }}
      />

      {isAlt ? (
        <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Box
            sx={{
              width: 74,
              height: 74,
              borderRadius: '50%',
              bgcolor: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 25px rgba(56, 189, 248, 0.3)',
            }}
          >
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" strokeWidth="1.5">
              <circle cx="12" cy="5" r="2" fill="#38BDF8" />
              <circle cx="6" cy="12" r="2" fill="#38BDF8" />
              <circle cx="18" cy="12" r="2" fill="#38BDF8" />
              <circle cx="8" cy="18" r="2" fill="#38BDF8" />
              <circle cx="16" cy="18" r="2" fill="#38BDF8" />
              <line x1="12" y1="7" x2="6" y2="10" stroke="#38BDF8" strokeWidth="1.2" />
              <line x1="12" y1="7" x2="18" y2="10" stroke="#38BDF8" strokeWidth="1.2" />
              <line x1="6" y1="14" x2="8" y2="16" stroke="#38BDF8" strokeWidth="1.2" />
              <line x1="18" y1="14" x2="16" y2="16" stroke="#38BDF8" strokeWidth="1.2" />
              <line x1="8" y1="18" x2="16" y2="18" stroke="#38BDF8" strokeWidth="1.2" />
            </svg>
          </Box>
          <Typography
            noWrap
            sx={{
              color: '#38BDF8',
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '1px',
              mt: 1.25,
              textTransform: 'uppercase',
              textShadow: '0 0 8px rgba(56, 189, 248, 0.6)',
              maxWidth: 120,
              textAlign: 'center',
            }}
          >
            {displayLabel}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Box
            sx={{
              width: 70,
              height: 70,
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(99, 102, 241, 0.15) 100%)',
              border: '1.5px solid rgba(168, 85, 247, 0.45)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 25px rgba(168, 85, 247, 0.35)',
            }}
          >
            <Video className="w-7 h-7 text-white" />
          </Box>
          <Typography
            noWrap
            sx={{
              color: '#C084FC',
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '1px',
              mt: 1.25,
              textTransform: 'uppercase',
              textShadow: '0 0 8px rgba(192, 132, 252, 0.6)',
              maxWidth: 120,
              textAlign: 'center',
            }}
          >
            {displayLabel}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// ============================================================================
// CardComponent
// The card for Upcoming, Registered, and Completed Webinars.
// Purely dynamic — renders strictly the data provided from the API.
// ============================================================================
export default function CardComponent({
  webinar = {},
  type = 'registered', // 'upcoming' | 'registered' | 'completed'
  // Actions
  onPrimaryClick,
  primaryLabel,
  primaryIcon,
  primaryDisabled = false,
  primaryLoading = false,
  // Secondary button (e.g. "Details")
  onSecondaryClick,
  secondaryLabel = 'Details',
  // Extra tool actions
  onCalendarClick,
  onShareClick,
  // Custom slots
  customActions,
  price,
  statusLabel,
  countryCode,
  currencySymbol: customCurrencySymbol,
}) {
  const colors = useThemeColors();
  const { isDark } = useAppTheme();

  // Resolve currency symbol dynamically from country code
  const activeCurrencySymbol = customCurrencySymbol || (countryCode ? getCurrencySymbolFromCountryCode(countryCode) : '$');

  // Normalize API data fields (NO hardcoding)
  const title = webinar.webinarName || webinar.title || '';
  const category = webinar.categoryName || webinar.category || '';
  const conductor = webinar.conductorName || webinar.speaker?.name || webinar.speaker || '';
  const conductorInitial = conductor ? String(conductor).trim().charAt(0).toUpperCase() : '';
  const conductorRole = webinar.conductorRole || webinar.speaker?.role || (conductor ? 'Host & Speaker' : '');

  // Dynamic Price computation from API
  let displayPrice = '';
  if (price !== undefined && price !== null && price !== '') {
    displayPrice = typeof price === 'string' && price.startsWith('$')
      ? `${activeCurrencySymbol}${price.slice(1)}`
      : price;
  } else if (webinar.isPaid && webinar.price != null && webinar.price > 0) {
    displayPrice = `${activeCurrencySymbol}${webinar.price}`;
  } else if (webinar.isPaid) {
    displayPrice = 'Paid';
  } else {
    displayPrice = 'Free';
  }

  // Dynamic Status determination (preserve actual status from API)
  const isNotAttended = statusLabel?.toLowerCase().includes('not attended');
  const isWebinarEnded = statusLabel?.toLowerCase().includes('webinar ended');
  const isCompleted = type === 'completed' || (statusLabel?.toLowerCase().includes('completed') && !isNotAttended);
  const badgeText = statusLabel || (isCompleted ? 'Completed' : 'Upcoming');

  // Status badge style based on actual status
  const badgeStyle = isNotAttended
    ? {
        bg: '#FEE2E2',
        color: '#DC2626',
        icon: <Clock className="w-3 h-3 text-[#DC2626]" />,
      }
    : isWebinarEnded
    ? {
        bg: '#F1F5F9',
        color: '#64748B',
        icon: <Clock className="w-3 h-3 text-[#64748B]" />,
      }
    : isCompleted
    ? {
        bg: '#DCFCE7',
        color: '#15803D',
        icon: <Check className="w-3 h-3 text-[#15803D]" />,
      }
    : {
        bg: '#EFF6FF',
        color: '#1D4ED8',
        icon: <Clock className="w-3 h-3 text-[#1D4ED8]" />,
      };

  // Dynamic Timing information
  const dateFormatted = formatCardDate(webinar.webinarDate || webinar.date || webinar.completedDate);
  const timeFormatted = webinar.startTime
    ? `${formatCardTime(webinar.startTime)}${webinar.endTime ? ` – ${formatCardTime(webinar.endTime)}` : ''}`
    : '';
  const durationText = webinar.durationMinutes
    ? formatCardDuration(webinar.durationMinutes)
    : webinar.duration || '';

  const scheduleSubtitle = timeFormatted
    ? `${timeFormatted}${durationText ? ` (${durationText})` : ''}`
    : durationText || (webinar.attendedHours ? String(webinar.attendedHours) : '');

  // Resolve cover image from API
  const rawImageUrl = webinar.imageUrl || webinar.ImageUrl || webinar.templateImageUrl || webinar.TemplateImageUrl || null;
  const resolvedImageUrl = getFullWebinarImageUrl(rawImageUrl);
  const [imageError, setImageError] = React.useState(false);

  React.useEffect(() => {
    setImageError(false);
  }, [resolvedImageUrl]);

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: { xs: 2.25, sm: 2.5 },
        borderRadius: '24px',
        bgcolor: isDark ? colors.surface : '#FFFFFF',
        border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #F1F5F9',
        p: { xs: 2, sm: 2.5 },
        boxShadow: isDark
          ? '0 10px 28px rgba(0, 0, 0, 0.45)'
          : '0 6px 24px rgba(15, 23, 42, 0.035)',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        position: 'relative',
        '&:hover': {
          transform: 'translateY(-3px)',
          boxShadow: isDark
            ? '0 16px 36px rgba(0, 0, 0, 0.6)'
            : '0 14px 34px rgba(234, 88, 12, 0.08)',
          borderColor: isDark ? 'rgba(234, 88, 12, 0.35)' : '#FED7AA',
        },
      }}
    >
      {/* ── LEFT COLUMN: Thumbnail Cover Image ───────────────────────── */}
      <Box
        sx={{
          width: { xs: '100%', sm: 165 },
          minWidth: { sm: 165 },
          height: { xs: 180, sm: 'auto' },
          minHeight: { sm: 215 },
          borderRadius: '18px',
          overflow: 'hidden',
          position: 'relative',
          bgcolor: isDark ? '#0F172A' : '#F8FAFC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {resolvedImageUrl && !imageError ? (
          <Box
            component="img"
            src={resolvedImageUrl}
            alt={title}
            onError={() => setImageError(true)}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              transition: 'transform 0.4s ease',
              '&:hover': { transform: 'scale(1.04)' },
            }}
          />
        ) : (
          <CyberThumbnailFallback category={category} title={title} id={webinar.id || webinar.webinarId} />
        )}
      </Box>

      {/* ── RIGHT COLUMN: Content, Details & Action Buttons ─────────── */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <Box>
          {/* Row 1: Category Pill + Status Pill + Price */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              mb: 1.5,
              flexWrap: 'wrap',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              {/* Category Pill (shown only if category exists from API) */}
              {category && (
                <Box
                  sx={{
                    px: 1.4,
                    py: 0.45,
                    borderRadius: '100px',
                    bgcolor: '#F3E8FF',
                    color: '#7E22CE',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.2px',
                  }}
                >
                  {category}
                </Box>
              )}

            {/* Status Pill (colored according to real status) */}
            {badgeText && (
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1.2,
                  py: 0.4,
                  borderRadius: '100px',
                  bgcolor: badgeStyle.bg,
                  color: badgeStyle.color,
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.1px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {badgeStyle.icon}
                <span>{badgeText}</span>
              </Box>
            )}
            </Box>

            {/* Price (from API) */}
            {displayPrice && (
              <Typography
                sx={{
                  color: '#EA580C',
                  fontSize: '13px',
                  fontWeight: 800,
                  letterSpacing: '0.2px',
                }}
              >
                {displayPrice}
              </Typography>
            )}
          </Box>

          {/* Row 2: Webinar Title */}
          <Typography
            variant="h6"
            title={title}
            sx={{
              fontWeight: 800,
              fontSize: '1.15rem',
              lineHeight: 1.3,
              color: isDark ? colors.textPrimary : '#0F172A',
              letterSpacing: '-0.2px',
              mb: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              minHeight: '2.6em',
            }}
          >
            {title || '—'}
          </Typography>

          {/* Row 3: Speaker Profile (shown if conductor info from API exists) */}
          {conductor && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                mb: 1.5,
              }}
            >
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  bgcolor: conductorInitial === 'V' ? '#8B5CF6' : '#EA580C',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '13.5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  flexShrink: 0,
                }}
              >
                {conductorInitial}
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  noWrap
                  sx={{
                    fontWeight: 800,
                    fontSize: '13px',
                    color: isDark ? colors.textPrimary : '#0F172A',
                    lineHeight: 1.2,
                  }}
                >
                  {conductor}
                </Typography>
                {conductorRole && (
                  <Typography
                    noWrap
                    sx={{
                      fontSize: '11px',
                      color: '#64748B',
                      fontWeight: 500,
                    }}
                  >
                    {conductorRole}
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          {/* Row 4: Schedule / Date & Timing */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              p: 1.2,
              borderRadius: '14px',
              bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F8FAFC',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid #F1F5F9',
              mb: 2,
            }}
          >
            {/* Date Column */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarIcon className="w-4 h-4 text-[#EA580C]" />
              <Box>
                <Typography sx={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600, lineHeight: 1 }}>
                  Date
                </Typography>
                <Typography sx={{ fontSize: '12px', color: isDark ? colors.textPrimary : '#0F172A', fontWeight: 750, mt: 0.25 }}>
                  {dateFormatted}
                </Typography>
              </Box>
            </Box>

            {/* Timing Column */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Clock className="w-4 h-4 text-[#EA580C]" />
              <Box>
                <Typography sx={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600, lineHeight: 1 }}>
                  Timing
                </Typography>
                <Typography sx={{ fontSize: '12px', color: isDark ? colors.textPrimary : '#0F172A', fontWeight: 750, mt: 0.25 }}>
                  {scheduleSubtitle || '—'}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* ── Row 5: Action Buttons (Primary, Details, Calendar, Share) ── */}
        <Box sx={{ pt: 0.5 }}>
          {customActions ? (
            customActions
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, width: '100%' }}>
              {/* Primary Action Button */}
              {onPrimaryClick && (
                <GradientButton
                  onClick={onPrimaryClick}
                  disabled={primaryDisabled}
                  loading={primaryLoading}
                  startIcon={
                    primaryIcon || (type === 'completed' ? <Download className="w-4 h-4" /> : <Video className="w-4 h-4" />)
                  }
                  sx={{
                    flex: 1,
                    height: 40,
                    borderRadius: '14px',
                    fontSize: '13px',
                  }}
                >
                  {primaryLabel || (type === 'completed' ? 'Download Certificate' : 'View Session')}
                </GradientButton>
              )}

              {/* Secondary Action Button ("Details") */}
              {onSecondaryClick && (
                <Button
                  variant="outlined"
                  onClick={onSecondaryClick}
                  sx={{
                    height: 40,
                    px: 2.25,
                    borderRadius: '14px',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#E2E8F0',
                    color: isDark ? colors.textPrimary : '#334155',
                    fontWeight: 700,
                    fontSize: '13px',
                    textTransform: 'none',
                    bgcolor: isDark ? 'transparent' : '#FFFFFF',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: '#EA580C',
                      color: '#EA580C',
                      bgcolor: isDark ? 'rgba(234, 88, 12, 0.1)' : '#FFF7ED',
                    },
                  }}
                >
                  {secondaryLabel}
                </Button>
              )}

              {/* Google Calendar Tooltip Icon: Don't show if StartTime < Current */}
              {onCalendarClick && !isWebinarStartTimePast(webinar?.startTime) && (
                <Tooltip title="Add to Google Calendar" arrow>
                  <IconButton
                    onClick={onCalendarClick}
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '14px',
                      border: isDark ? '1px solid rgba(234, 88, 12, 0.3)' : '1px solid #FED7AA',
                      color: '#EA580C',
                      bgcolor: isDark ? 'rgba(234, 88, 12, 0.08)' : '#FFFFFF',
                      flexShrink: 0,
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: '#FFF7ED',
                        borderColor: '#EA580C',
                        transform: 'scale(1.05)',
                      },
                    }}
                  >
                    <CalendarIcon className="w-4 h-4" />
                  </IconButton>
                </Tooltip>
              )}

              {/* Share Tooltip Button: Don't show if StartTime < Current */}
              {onShareClick && !isWebinarStartTimePast(webinar?.startTime) && (
                <Tooltip title="Copy Share Link" arrow>
                  <IconButton
                    onClick={onShareClick}
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '14px',
                      border: isDark ? '1px solid rgba(234, 88, 12, 0.3)' : '1px solid #FED7AA',
                      color: '#EA580C',
                      bgcolor: isDark ? 'rgba(234, 88, 12, 0.08)' : '#FFFFFF',
                      flexShrink: 0,
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: '#FFF7ED',
                        borderColor: '#EA580C',
                        transform: 'scale(1.05)',
                      },
                    }}
                  >
                    <Share2 className="w-4 h-4" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

// ============================================================================
// Hero Banner Vector Illustration
// Laptop with graduation cap, books, and leaves.
// ============================================================================
function HeroBannerIllustration() {
  return (
    <Box
      sx={{
        width: { xs: 220, sm: 260, md: 300 },
        height: { xs: 150, sm: 170, md: 190 },
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 340 220" fill="none">
        {/* Soft Background Leaves */}
        <path
          d="M270 40C295 55 315 85 305 115C295 145 265 150 250 140C235 130 240 100 250 80C260 60 255 45 270 40Z"
          fill="#86EFAC"
          fillOpacity="0.55"
        />
        <path
          d="M75 120C60 100 50 70 65 50C80 30 110 35 120 50C130 65 125 90 110 105C95 120 85 130 75 120Z"
          fill="#86EFAC"
          fillOpacity="0.45"
        />

        {/* Stack of Books at Base */}
        <rect x="70" y="172" width="200" height="20" rx="10" fill="#6366F1" />
        <rect x="80" y="156" width="180" height="18" rx="9" fill="#FB923C" />

        {/* Laptop Base */}
        <path
          d="M85 152L255 152C260 152 264 155 262 159L250 170C248 172 245 173 242 173L98 173C95 173 92 172 90 170L78 159C76 155 80 152 85 152Z"
          fill="#CBD5E1"
        />

        {/* Laptop Screen Outer */}
        <rect
          x="105"
          y="62"
          width="135"
          height="92"
          rx="10"
          fill="#1E293B"
          stroke="#94A3B8"
          strokeWidth="2.5"
        />

        {/* Laptop Display Inner with Gradient */}
        <rect x="110" y="67" width="125" height="82" rx="7" fill="url(#screenGrad)" />

        {/* Play Button inside Screen */}
        <circle cx="172" cy="108" r="15" fill="rgba(255, 255, 255, 0.35)" />
        <polygon points="167,100 181,108 167,116" fill="#FFFFFF" />

        {/* Graduation Cap */}
        <polygon
          points="232,54 265,38 298,54 265,70"
          fill="#1E293B"
        />
        <path
          d="M246 62C246 72 254 78 265 78C276 78 284 72 284 62"
          fill="#0F172A"
        />
        <circle cx="265" cy="54" r="2.5" fill="#F59E0B" />
        <path
          d="M265 54C275 60 282 72 280 86"
          stroke="#F59E0B"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <rect x="277" y="85" width="6" height="8" rx="2" fill="#F59E0B" />

        <defs>
          <linearGradient id="screenGrad" x1="110" y1="67" x2="235" y2="149" gradientUnits="userSpaceOnUse">
            <stop stopColor="#A855F7" />
            <stop offset="0.5" stopColor="#818CF8" />
            <stop offset="1" stopColor="#38BDF8" />
          </linearGradient>
        </defs>
      </svg>
    </Box>
  );
}

// ============================================================================
// WebinarPageHeader Component
// Header section: Hero Banner + Metric Cards + Section Title & Controls
// ============================================================================
export function WebinarPageHeader({
  metrics = [], // Array of { label: string, value: string | number, type: 'orange'|'blue'|'green'|'purple', icon: ReactComponent }
  title = '',
  subtitle = '',
  search = '',
  onSearchChange,
  searchPlaceholder = 'Search registered sessions...',
  filters = [], // Array of { id: string, label: string }
  activeFilter = 'ALL',
  onFilterChange,
  extraAction,
  showHeroBanner = true,
  onExploreClick,
}) {
  const colors = useThemeColors();
  const { isDark } = useAppTheme();
  const navigate = useNavigate();

  const getMetricStyle = (type, index) => {
    const variant = type || (index === 0 ? 'orange' : index === 1 ? 'blue' : index === 2 ? 'green' : 'purple');
    switch (variant) {
      case 'orange':
        return {
          cardBg: isDark ? 'rgba(234, 88, 12, 0.08)' : '#FFF8F1',
          cardBorder: isDark ? 'rgba(234, 88, 12, 0.25)' : '#FFEDD5',
          iconBg: isDark ? 'rgba(234, 88, 12, 0.2)' : '#FFEDD5',
          iconColor: '#EA580C',
        };
      case 'blue':
        return {
          cardBg: isDark ? 'rgba(37, 99, 235, 0.08)' : '#EFF6FF',
          cardBorder: isDark ? 'rgba(37, 99, 235, 0.25)' : '#DBEAFE',
          iconBg: isDark ? 'rgba(37, 99, 235, 0.2)' : '#DBEAFE',
          iconColor: '#2563EB',
        };
      case 'green':
        return {
          cardBg: isDark ? 'rgba(22, 163, 74, 0.08)' : '#F0FDF4',
          cardBorder: isDark ? 'rgba(22, 163, 74, 0.25)' : '#DCFCE7',
          iconBg: isDark ? 'rgba(22, 163, 74, 0.2)' : '#DCFCE7',
          iconColor: '#16A34A',
        };
      case 'purple':
      default:
        return {
          cardBg: isDark ? 'rgba(147, 51, 234, 0.08)' : '#FAF5FF',
          cardBorder: isDark ? 'rgba(147, 51, 234, 0.25)' : '#F3E8FF',
          iconBg: isDark ? 'rgba(147, 51, 234, 0.2)' : '#F3E8FF',
          iconColor: '#9333EA',
        };
    }
  };

  return (
    <Box sx={{ mb: 3.5, display: 'flex', flexDirection: 'column', gap: 3.5 }}>
      {/* ── TOP HERO BANNER ─────────────────────────────────────────── */}
      {showHeroBanner && (
        <Box
          sx={{
            borderRadius: '26px',
            background: isDark
              ? 'linear-gradient(135deg, rgba(234, 88, 12, 0.12) 0%, rgba(20, 24, 38, 0.95) 100%)'
              : 'linear-gradient(135deg, #FFF9F2 0%, #FFF5EA 50%, #FFFBF5 100%)',
            border: isDark ? '1px solid rgba(234, 88, 12, 0.25)' : '1px solid #FED7AA',
            p: { xs: 3, sm: 3.5, md: 4 },
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 3,
            boxShadow: isDark
              ? '0 10px 30px rgba(0, 0, 0, 0.4)'
              : '0 8px 25px rgba(234, 88, 12, 0.06)',
            overflow: 'hidden',
          }}
        >
          {/* Banner Left Content */}
          <Box sx={{ maxWidth: 540 }}>
            <Typography
              sx={{
                fontSize: { xs: '1.45rem', sm: '1.85rem', md: '2.05rem' },
                fontWeight: 850,
                color: isDark ? colors.textPrimary : '#0F172A',
                lineHeight: 1.2,
                mb: 1,
              }}
            >
              Learn Live from{' '}
              <Box component="span" sx={{ color: '#EA580C', display: 'inline' }}>
                Industry Experts
              </Box>
            </Typography>
            <Typography
              sx={{
                fontSize: '13.5px',
                color: isDark ? colors.textSecondary : '#64748B',
                mb: 2.75,
                lineHeight: 1.5,
              }}
            >
              Join interactive webinars, gain practical skills, and earn certificates.
            </Typography>
            <Button
              onClick={onExploreClick || (() => navigate('/dashboard/webinars?tab=available'))}
              sx={{
                bgcolor: '#EA580C',
                color: '#FFFFFF',
                borderRadius: '14px',
                px: 3,
                py: 1.15,
                fontSize: '13px',
                fontWeight: 750,
                textTransform: 'none',
                boxShadow: '0 4px 14px rgba(234, 88, 12, 0.3)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: '#C2410C',
                  boxShadow: '0 6px 20px rgba(234, 88, 12, 0.4)',
                  transform: 'translateY(-1px)',
                },
              }}
              startIcon={<Box component="span" sx={{ fontSize: '11px', mr: 0.25 }}>▶</Box>}
              endIcon={<Box component="span" sx={{ fontSize: '14px', ml: 0.25 }}>→</Box>}
            >
              Explore Webinars
            </Button>
          </Box>

          {/* Banner Right Illustration */}
          <HeroBannerIllustration />
        </Box>
      )}

      {/* ── METRIC CARDS ROW (Dynamic from API) ────────────────────── */}
      {metrics.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: metrics.length === 2 ? 'repeat(2, 1fr)' : 'repeat(2, 1fr)',
              md: `repeat(${Math.min(metrics.length, 4)}, 1fr)`,
            },
            gap: 2,
          }}
        >
          {metrics.map((m, idx) => {
            const style = getMetricStyle(m.type, idx);
            const IconComp = m.icon;

            return (
              <Box
                key={idx}
                sx={{
                  borderRadius: '20px',
                  bgcolor: style.cardBg,
                  border: `1px solid ${style.cardBorder}`,
                  p: 2.25,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.75,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.04)',
                  },
                }}
              >
                {/* Squircle Badge Icon */}
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '14px',
                    bgcolor: style.iconBg,
                    color: style.iconColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {IconComp ? (
                    <IconComp className="w-5 h-5" style={{ color: style.iconColor }} />
                  ) : idx === 0 ? (
                    <Box component="span" sx={{ fontSize: '16px', lineHeight: 1 }}>▶</Box>
                  ) : idx === 1 ? (
                    <CalendarIcon className="w-5 h-5" style={{ color: style.iconColor }} />
                  ) : idx === 2 ? (
                    <CheckCircle2 className="w-5 h-5" style={{ color: style.iconColor }} />
                  ) : (
                    <Award className="w-5 h-5" style={{ color: style.iconColor }} />
                  )}
                </Box>

                {/* Metric Texts */}
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    noWrap
                    sx={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: isDark ? colors.textSecondary : '#64748B',
                      lineHeight: 1.2,
                      mb: 0.25,
                    }}
                  >
                    {m.label}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '1.65rem',
                      fontWeight: 850,
                      color: isDark ? colors.textPrimary : '#0F172A',
                      lineHeight: 1.1,
                      letterSpacing: '-0.5px',
                    }}
                  >
                    {m.value}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {/* ── SECTION HEADER & FILTER / SEARCH ACTION ROW ───────────── */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'flex-start', md: 'center' },
          justifyContent: 'space-between',
          gap: 2,
          pt: 0.5,
        }}
      >
        {/* Left: Title & Subtitle */}
        <Box>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 850,
              fontSize: { xs: '1.35rem', sm: '1.55rem' },
              color: isDark ? colors.textPrimary : '#0F172A',
              letterSpacing: '-0.4px',
              lineHeight: 1.2,
            }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography
              variant="body2"
              sx={{
                color: isDark ? colors.textSecondary : '#64748B',
                fontSize: '13px',
                fontWeight: 500,
                mt: 0.4,
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>

        {/* Right: Search Box & Filter Container */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            flexWrap: 'wrap',
            width: { xs: '100%', md: 'auto' },
            justifyContent: { xs: 'flex-start', md: 'flex-end' },
          }}
        >
          {/* Search Box */}
          {onSearchChange && (
            <Box
              sx={{
                position: 'relative',
                width: { xs: '100%', sm: 260, md: 290 },
              }}
            >
              <Search
                style={{
                  position: 'absolute',
                  left: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 16,
                  height: 16,
                  color: '#94A3B8',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                style={{
                  width: '100%',
                  paddingLeft: 40,
                  paddingRight: 14,
                  paddingTop: 9,
                  paddingBottom: 9,
                  borderRadius: '14px',
                  fontSize: '13px',
                  fontWeight: 500,
                  backgroundColor: isDark ? 'rgba(30, 34, 48, 0.85)' : '#FFFFFF',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #E2E8F0',
                  color: isDark ? '#F1F5F9' : '#0F172A',
                  outline: 'none',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  transition: 'all 0.2s ease',
                }}
              />
            </Box>
          )}

          {/* Filter Pills */}
          {filters.length > 0 && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                p: 0.5,
                borderRadius: '14px',
                bgcolor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F1F5F9',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #E2E8F0',
              }}
            >
              {filters.map((f) => {
                const isActive = activeFilter === f.id;
                return (
                  <Box
                    key={f.id}
                    onClick={() => onFilterChange(f.id)}
                    sx={{
                      px: 1.6,
                      py: 0.7,
                      borderRadius: '10px',
                      fontSize: '12px',
                      fontWeight: isActive ? 750 : 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      bgcolor: isActive ? '#0F172A' : 'transparent',
                      color: isActive ? '#FFFFFF' : isDark ? colors.textSecondary : '#64748B',
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                      '&:hover': {
                        color: isActive ? '#FFFFFF' : '#0F172A',
                      },
                    }}
                  >
                    {f.label}
                  </Box>
                );
              })}
            </Box>
          )}

          {extraAction}
        </Box>
      </Box>
    </Box>
  );
}
