import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogActions,
  DialogTitle
} from '@mui/material';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CloseIcon from '@mui/icons-material/Close';
import SchoolIcon from '@mui/icons-material/School';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import toast from 'react-hot-toast';

import { webinarService, certificateService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useThemeColors } from '../../context/ThemeContext';
import CustomSearchBar from '../../components/CustomSearchBar';

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

export default function MyCertificates() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  // View / Preview Dialog state
  const [viewDialogWebinar, setViewDialogWebinar] = useState(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [templateBannerSrc, setTemplateBannerSrc] = useState(null);

  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5270';
  const templateImgUrl = `${apiBase}/api/certificates/templates/CertificateTemplate1/preview`;

  // Fetch certificate template preview (authenticated with JWT)
  useEffect(() => {
    certificateService.getTemplates()
      .then((res) => {
        if (res.data?.success && res.data.data?.length > 0) {
          const t = res.data.data[0];
          setTemplateBannerSrc(t.previewBase64 || t.previewUrl);
        }
      })
      .catch((err) => {
        console.error('Could not load template preview:', err);
      });
  }, []);

  // Load completed webinars and filter for certificate-eligible
  const loadCertificates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await webinarService.getCompleted();
      if (res.data?.success) {
        const allCompleted = res.data.data || [];
        const eligibleOnly = allCompleted.filter(
          (w) => w.canDownloadCertificate || w.isCertificateEligible
        );
        setCertificates(eligibleOnly);
      }
    } catch (err) {
      console.error('Error fetching certificates:', err);
      toast.error('Failed to load certificates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCertificates();
  }, [loadCertificates]);

  // Clean up blob URL on unmount or dialog close
  useEffect(() => {
    return () => {
      if (previewBlobUrl) {
        window.URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [previewBlobUrl]);

  // Filtered certificates list
  const filteredCertificates = useMemo(() => {
    if (!search.trim()) return certificates;
    const q = search.toLowerCase();
    return certificates.filter((item) => {
      const matchesTitle = item.webinarName?.toLowerCase().includes(q);
      const matchesCode = (item.certificateCode || item.certificateId)?.toLowerCase().includes(q);
      const matchesInstructor = item.conductorName?.toLowerCase().includes(q);
      const matchesCat = item.categoryName?.toLowerCase().includes(q);
      return matchesTitle || matchesCode || matchesInstructor || matchesCat;
    });
  }, [certificates, search]);

  // Statistics summary
  const stats = useMemo(() => {
    const total = certificates.length;
    const totalSeconds = certificates.reduce((acc, c) => acc + (c.attendedDuration || 0), 0);
    const hours = (totalSeconds / 3600).toFixed(1);
    return { total, hours };
  }, [certificates]);

  // Trigger PDF file download
  const handleDownload = async (webinar, e) => {
    e?.stopPropagation();
    setDownloadingId(webinar.webinarId);
    try {
      const res = await webinarService.downloadStudentCertificate(webinar.webinarId);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = (webinar.webinarName || 'Webinar').replace(/[^a-zA-Z0-9]/g, '_');
      link.setAttribute('download', `${safeName}-Certificate.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Certificate downloaded successfully! 🎓');
    } catch (err) {
      console.error('Error downloading certificate:', err);
      toast.error('Failed to download certificate. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  // Open Full Certificate View Modal
  const handleOpenView = async (webinar) => {
    setViewDialogWebinar(webinar);
    setPreviewLoading(true);
    try {
      if (previewBlobUrl) {
        window.URL.revokeObjectURL(previewBlobUrl);
      }
      const res = await webinarService.downloadStudentCertificate(webinar.webinarId);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      setPreviewBlobUrl(url);
    } catch (err) {
      console.error('Error loading certificate preview:', err);
      toast.error('Could not load certificate preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCloseView = () => {
    setViewDialogWebinar(null);
    if (previewBlobUrl) {
      window.URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
  };



  return (
    <Box
      sx={{
        minHeight: 'calc(100vh - 110px)',
        display: 'flex',
        flexDirection: 'column',
        maxWidth: 1600,
        bgcolor: 'transparent',
        mx: 'auto',
        width: '100%'
      }}
    >
      {/* ── Top Hero Banner (Rich Dark Navy & Gold Palette) ────────────────── */}
      <Box
        sx={{
          mb: 2.5,
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
            <WorkspacePremiumIcon sx={{ color: '#172338', fontSize: 32 }} />
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap', mb: 0.5 }}>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  color: '#FFFFFF',
                  letterSpacing: '-0.5px',
                  lineHeight: 1.2,
                  fontSize: { xs: '1.35rem', sm: '1.6rem' }
                }}
              >
                My Certificates
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
              View, verify, and download your accredited webinar completion certificates.
            </Typography>
          </Box>
        </Box>

        {/* Quick Stats Cards inside Banner */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(130px, 1fr))',
            gap: 1.5,
            width: { xs: '100%', sm: 'auto' },
          }}
        >
          <Paper
            elevation={0}
            sx={{
              px: 2.5,
              py: 1.25,
              borderRadius: '14px',
              bgcolor: 'rgba(34, 197, 94, 0.16)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(74, 222, 128, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: { xs: 'center', sm: 'flex-start' },
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: '#8BE0A7',
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                fontSize: '0.68rem',
                mb: 0.25
              }}
            >
              Earned Certificates
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#8BE0A7', lineHeight: 1.1 }}>
              {stats.total}
            </Typography>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              px: 2.5,
              py: 1.25,
              borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(242,183,5,0.22) 0%, rgba(242,183,5,0.08) 100%)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(242,183,5,0.35)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: { xs: 'center', sm: 'flex-start' },
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: '#FFD45A',
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                fontSize: '0.68rem',
                mb: 0.25
              }}
            >
              Certified Hours
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#FFFFFF', lineHeight: 1.1 }}>
              {stats.hours}h
            </Typography>
          </Paper>
        </Box>
      </Box>

      {/* ── Search Toolbar ─────────────────────────────────────────────────── */}
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
        <Box sx={{ flexGrow: 1, minWidth: { xs: '100%', sm: 300 }, maxWidth: { xs: '100%', sm: 460 } }}>
          <CustomSearchBar
            value={search}
            onChange={(val) => setSearch(val)}
            placeholder="Search certificates by webinar, code, instructor..."
            maxWidth="100%"
            sx={{ width: '100%' }}
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            icon={<WorkspacePremiumIcon sx={{ fontSize: '15px !important', color: '#166534' }} />}
            label={`Showing ${filteredCertificates.length} of ${certificates.length} Certificates`}
            size="small"
            sx={{
              fontWeight: 700,
              fontSize: '0.78rem',
              height: 32,
              px: 1,
              bgcolor: '#F0FDF4',
              color: '#166534',
              border: '1px solid #BBF7D0'
            }}
          />
        </Box>
      </Paper>

      {/* ── Certificate Cards Grid (Increased Width, Reduced Height like Eduprep) ── */}
      <Box sx={{ flexGrow: 1, pb: 3 }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 10, gap: 2 }}>
            <CircularProgress size={42} thickness={4.5} sx={{ color: '#F2B705' }} />
            <Typography variant="body2" sx={{ color: colors.textSecondary, fontWeight: 600 }}>
              Loading your certificates...
            </Typography>
          </Box>
        ) : filteredCertificates.length === 0 ? (
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
                width: 76,
                height: 76,
                borderRadius: '50%',
                bgcolor: 'rgba(242,183,5,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
              }}
            >
              <WorkspacePremiumIcon sx={{ fontSize: 40, color: '#D97706' }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: colors.textPrimary, mb: 0.75 }}>
              {certificates.length === 0 ? 'No certificates earned yet' : 'No certificates match your search'}
            </Typography>
            <Typography variant="body2" sx={{ color: colors.textSecondary, maxWidth: 440, mx: 'auto', mb: 3, lineHeight: 1.6 }}>
              {certificates.length === 0
                ? 'Attend live webinar sessions, complete the attendance criteria, and unlock your official certificates here!'
                : 'Try clearing your search keyword to view all your earned certificates.'}
            </Typography>

            {certificates.length === 0 ? (
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
                onClick={() => setSearch('')}
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
                Reset Search
              </Button>
            )}
          </Paper>
        ) : (
          /* Grid container with wider card columns (380px to 440px wide, not skinny) */
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(auto-fill, minmax(360px, 420px))',
              },
              gap: 3,
              justifyContent: 'start',
            }}
          >
            {filteredCertificates.map((w) => {
              const certCode = w.certificateCode || w.certificateId;
              const isDownloading = downloadingId === w.webinarId;
              const cardBannerSrc = w.templateImageUrl
                ? (w.templateImageUrl.startsWith('http') ? w.templateImageUrl : `${apiBase}${w.templateImageUrl}`)
                : (templateBannerSrc || templateImgUrl);

              return (
                <Paper
                  key={w.webinarId}
                  elevation={0}
                  sx={{
                    width: '100%',
                    maxWidth: 440,
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: '20px',
                    bgcolor: '#FFFFFF',
                    border: '1.5px solid rgba(22, 163, 74, 0.28)',
                    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    overflow: 'hidden',
                    position: 'relative',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 16px 32px rgba(15, 23, 42, 0.12)',
                      borderColor: '#16A34A',
                      '& .cert-banner-img': {
                        transform: 'scale(1.04)',
                      }
                    }
                  }}
                >
                  {/* ── TOP HALF: Certificate Top Half Visual Banner (Compact Height ~150px) ── */}
                  <Box
                    onClick={() => handleOpenView(w)}
                    sx={{
                      position: 'relative',
                      height: 155,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      background: 'radial-gradient(circle at 80% 30%, #F59E0B 0%, #B45309 60%, #78350F 100%)',
                      borderBottom: '1px solid #E2E8F0',
                    }}
                  >
                    {/* Real template top-half image from wms.CertificateTemplates */}
                    <Box
                      component="img"
                      className="cert-banner-img"
                      src={cardBannerSrc}
                      alt={`${w.webinarName} Certificate`}
                      onError={(e) => {
                        // Fallback: hide broken img, gradient remains
                        e.target.style.display = 'none';
                      }}
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'top center',
                        transition: 'transform 0.4s ease',
                      }}
                    />

                    {/* Subtle dark gradient overlay to give trophy/cert banner depth */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'linear-gradient(180deg, rgba(15,23,42,0.1) 0%, rgba(15,23,42,0.45) 100%)',
                        pointerEvents: 'none',
                      }}
                    />

                    {/* Top Left: Category Tag from database table */}
                    {w.categoryName && (
                      <Box sx={{ position: 'absolute', top: 12, left: 12, zIndex: 2 }}>
                        <Chip
                          label={w.categoryName}
                          size="small"
                          sx={{
                            fontWeight: 750,
                            fontSize: '0.72rem',
                            height: 24,
                            bgcolor: 'rgba(255, 255, 255, 0.95)',
                            color: '#0F172A',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                          }}
                        />
                      </Box>
                    )}

                    {/* Top Right: "Completed" Pill Badge (Matches Eduprep Style) */}
                    <Box sx={{ position: 'absolute', top: 12, right: 12, zIndex: 2 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.6,
                          bgcolor: 'rgba(23, 35, 56, 0.72)',
                          backdropFilter: 'blur(8px)',
                          border: '1px solid rgba(255, 255, 255, 0.22)',
                          color: '#FFFFFF',
                          px: 1.25,
                          py: 0.4,
                          borderRadius: '20px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        }}
                      >
                        <AccessTimeIcon sx={{ fontSize: 13, color: '#FDE047' }} />
                        <Typography variant="caption" sx={{ fontWeight: 800,color: '#FDE047' , fontSize: '0.70rem', letterSpacing: '0.3px' }}>
                          Completed
                        </Typography>
                      </Box>
                    </Box>

                    {/* Bottom overlay: Student Certificate Recipient strip */}
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 10,
                        left: 12,
                        right: 12,
                        zIndex: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        bgcolor: 'rgba(15, 23, 42, 0.8)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        px: 1.4,
                        py: 0.5,
                      }}
                    >
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        
                        <Typography variant="body2" noWrap sx={{ color: '#FFFFFF', fontWeight: 700, fontSize: '0.80rem' }}>
                          {w.participantName || user?.firstName || 'Student'}
                        </Typography>
                      </Box>
                      <VisibilityIcon sx={{ color: '#FDE047', fontSize: 17 }} />
                    </Box>
                  </Box>

                  {/* ── BOTTOM HALF: Content & Details (Matches Eduprep layout) ── */}
                  <Box sx={{ p: 2.2, display: 'flex', flexDirection: 'column', flex: 1 }}>
                    {/* Title in bold purple/indigo (Eduprep signature color) */}
                    <Typography
                      variant="h6"
                      title={w.webinarName}
                      sx={{
                        fontWeight: 800,
                        color: '#f2b705',
                        fontSize: '1.12rem',
                        lineHeight: 1.3,
                        mb: 0.5,
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {w.webinarName}
                    </Typography>

                    {/* Sub-line: Issued Date */}
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 700,
                        color: '#1F2937',
                        fontSize: '0.82rem',
                        mb: 0.4
                      }}
                    >
                      Completed At: {formatDate(w.webinarDate)}
                    </Typography>

                    {/* Short Description */}
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#6B7280',
                        fontSize: '0.78rem',
                        display: 'block',
                        mb: 1.8,
                        lineHeight: 1.4
                      }}
                    >
                      Certified training session led by {w.conductorName} • {w.durationMinutes} min
                    </Typography>

                    {/* Compact Info Box (Matches the Prize Money box in Eduprep) */}
                    <Box
                      sx={{
                        bgcolor: '#F9FAFB',
                        borderRadius: '12px',
                        border: '1px solid #E5E7EB',
                        p: 1.25,
                        mb: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.8
                      }}
                    >
                      {/* Row 1: Certificate ID / Code */}
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: '#4B5563', fontSize: '0.75rem' }}>
                          Certificate ID:
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                          <Chip
                            label={certCode || 'VERIFIED'}
                            size="small"
                            sx={{
                              bgcolor: '#D1FAE5',
                              color: '#065F46',
                              fontWeight: 800,
                              fontSize: '0.74rem',
                              height: 22,
                              borderRadius: '6px',
                              fontFamily: 'monospace'
                            }}
                          />
                       
                        </Box>
                      </Box>

                      {/* Row 2: Instructor */}
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: '#4B5563', fontSize: '0.75rem' }}>
                          Instructor:
                        </Typography>
                        <Chip
                          icon={<SchoolIcon sx={{ fontSize: '13px !important', color: '#6D28D9' }} />}
                          label={w.conductorName || 'Lead Speaker'}
                          size="small"
                          sx={{
                            bgcolor: '#EDE9FE',
                            color: '#5B21B6',
                            fontWeight: 750,
                            fontSize: '0.73rem',
                            height: 22,
                            borderRadius: '6px'
                          }}
                        />
                      </Box>
                    </Box>

                    {/* Footer Row: Details (Eye) on Left & Download Button on Right */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        pt: 1.2,
                        borderTop: '1px solid #F3F4F6',
                        mt: 'auto'
                      }}
                    >
                      {/* Left: View Details Button */}
                      <Button
                        variant="text"
                        size="small"
                        startIcon={<VisibilityIcon sx={{ fontSize: 17 }} />}
                        onClick={() => handleOpenView(w)}
                        sx={{
                          color: '#4B5563',
                          fontWeight: 700,
                          fontSize: '0.84rem',
                          textTransform: 'none',
                          p: 0.5,
                          '&:hover': { color: '#111827', bgcolor: 'transparent' }
                        }}
                      >
                        View
                      </Button>

                      {/* Right: Download PDF Button */}
                      <Button
                        variant="contained"
                        size="small"
                        disabled={isDownloading}
                        startIcon={
                          isDownloading ? (
                            <CircularProgress size={14} sx={{ color: '#172338' }} />
                          ) : (
                            <DownloadIcon sx={{ fontSize: 16 }} />
                          )
                        }
                        onClick={(e) => handleDownload(w, e)}
                        sx={{
                          bgcolor: '#F2B705',
                          color: '#172338',
                          fontWeight: 700,
                          fontSize: '0.80rem',
                          textTransform: 'none',
                          px: 2.2,
                          py: 0.6,
                          borderRadius: '8px',
                          boxShadow: 'none',
                          '&:hover': {
                            bgcolor: '#EAB308',
                            boxShadow: 'none'
                          }
                        }}
                      >
                        {isDownloading ? 'Downloading...' : 'Download'}
                      </Button>
                    </Box>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        )}
      </Box>

      {/* ── Interactive View / Preview Modal ──────────────────────────────── */}
      <Dialog
        open={Boolean(viewDialogWebinar)}
        onClose={handleCloseView}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '20px',
            bgcolor: colors.surface,
            overflow: 'hidden',
          }
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: '#172338',
            color: '#FFFFFF',
            py: 2,
            px: 3,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <WorkspacePremiumIcon sx={{ color: '#F2B705', fontSize: 26 }} />
            <Box>
              <Typography variant="subtitle1" sx={{ color: '#F2B705',fontWeight: 800, lineHeight: 1.2 }}>
                Certificate of Completion
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>
                {viewDialogWebinar?.webinarName}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={handleCloseView} sx={{ color: '#FFFFFF' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 2.5, bgcolor: '#0F172A', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {previewLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 14, gap: 2 }}>
              <CircularProgress size={44} sx={{ color: '#F2B705' }} />
              <Typography variant="body2" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
                Rendering official vector PDF certificate...
              </Typography>
            </Box>
          ) : previewBlobUrl ? (
            <Box
              sx={{
                width: '100%',
                height: { xs: 360, sm: 520, md: 580 },
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
                bgcolor: '#FFFFFF',
              }}
            >
              <iframe
                src={`${previewBlobUrl}#toolbar=0&navpanes=0`}
                title="Certificate PDF Viewer"
                width="100%"
                height="100%"
                style={{ border: 'none' }}
              />
            </Box>
          ) : (
            <Typography variant="body2" sx={{ color: '#FFFFFF', py: 8 }}>
              Failed to display certificate preview.
            </Typography>
          )}
        </DialogContent>

        <DialogActions
          sx={{
            py: 2,
            px: 3,
            bgcolor: colors.surface,
            borderTop: `1px solid ${colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >


          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              variant="outlined"
              onClick={handleCloseView}
              sx={{
                borderRadius: '10px',
                color: colors.textSecondary,
                borderColor: colors.border,
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              Close
            </Button>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={() => handleDownload(viewDialogWebinar)}
              sx={{
                borderRadius: '10px',
                bgcolor: '#F2B705',
                color: '#efefefff',
                fontWeight: 700,
                textTransform: 'none',
                px: 2.5,
                boxShadow: '0 4px 12px rgba(242,183,5,0.3)',
                '&:hover': { bgcolor: '#EAB308' }
              }}
            >
              Download PDF
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
