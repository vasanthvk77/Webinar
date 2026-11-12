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
import CardComponent, { WebinarPageHeader } from '../../components/CardComponent';
import { BookOpen, Award, Clock } from 'lucide-react';
import { formatUtcToLocalDateOnly } from '../../utils/validation';

// Helper: Format Date
const formatDate = (dateStr) => formatUtcToLocalDateOnly(dateStr);

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
      {/* ── Top Row Section: Dashboard Metrics & Controls ───────────── */}
      <WebinarPageHeader
        title="Completed Webinars"
        subtitle="Track your attended learning milestones and download accredited completion certificates."
        metrics={[
          { label: 'Enrolled Webinars', value: stats.total, type: 'orange' },
          { label: 'Upcoming Sessions', value: 0, type: 'blue' },
          { label: 'Completed Sessions', value: stats.total, type: 'green' },
          { label: 'Certificates Earned', value: stats.certified, type: 'purple' },
        ]}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search completed webinars, topics..."
        filters={[
          { id: 'ALL', label: `All (${webinars.length})` },
          { id: 'CERTIFIED', label: `Certificate Available (${stats.certified})` },
          { id: 'NO_CERT', label: `Attended Only (${stats.total - stats.certified})` },
        ]}
        activeFilter={filterType}
        onFilterChange={setFilterType}
      />

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
            <CircularProgress size={42} thickness={4.5} sx={{ color: '#EA580C' }} />
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
              <CheckCircleIcon sx={{ fontSize: 36, color: '#EA580C' }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#9A3412', mb: 0.75 }}>
              {webinars.length === 0 ? 'No completed webinars yet' : 'No webinars matching your filter'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#C2410C', maxWidth: 420, mx: 'auto', mb: 3, lineHeight: 1.6 }}>
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
                Browse Upcoming Webinars
              </Button>
            ) : (
              <Button
                variant="outlined"
                size="medium"
                onClick={() => { setSearch(''); setFilterType('ALL'); }}
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
              const isEligible = w.canDownloadCertificate;
              const isDownloading = downloadingId === w.webinarId;

              return (
                <Grid item xs={12} lg={6} key={w.webinarId} sx={{ display: 'flex' }}>
                  <CardComponent
                    webinar={w}
                    type="completed"
                    statusLabel={isEligible ? 'Certificate Ready' : 'Completed'}
                    price={w.isPaid ? (w.price ? `$${w.price}` : 'Paid') : 'Free'}
                    primaryLabel={isDownloading ? 'Generating...' : isEligible ? 'Download Certificate' : 'Session Completed'}
                    primaryDisabled={!isEligible || isDownloading}
                    primaryLoading={isDownloading}
                    onPrimaryClick={isEligible ? () => handleDownloadCertificate(w) : undefined}
                  />
                </Grid>
              );
            })}
          </Grid>
        )}
      </Box>
    </Box>
  );
}