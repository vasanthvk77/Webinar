import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Button,
  CircularProgress,
  IconButton,
  Tooltip,
  InputBase,
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TextSnippetOutlinedIcon from '@mui/icons-material/TextSnippetOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import toast from 'react-hot-toast';

import { recordingService } from '../services/api';
import { useThemeColors, useAppTheme } from '../context/ThemeContext';
import { formatUtcToLocalDateOnly } from '../utils/validation';

const countWords = (text) => (text ? text.trim().split(/\s+/).filter(Boolean).length : 0);

export default function MeetingTranscribe() {
  const colors = useThemeColors();
  const { isDark } = useAppTheme();

  const [transcripts, setTranscripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState({});

  const fetchTranscripts = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await recordingService.getAll();
      if (res.data?.success) {
        setTranscripts(res.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching transcripts:', err);
      toast.error('Unable to fetch transcribed meetings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTranscripts();
  }, [fetchTranscripts]);

  const handleCopyText = (text, title) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`Copied transcript for "${title}"!`);
  };

  const handleDownloadTxt = (text, title) => {
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_Transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Transcript downloaded!');
  };

  const toggleExpand = (id) => setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));

  const filteredList = useMemo(() => {
    if (!search.trim()) return transcripts;
    const q = search.toLowerCase();
    return transcripts.filter(
      (item) =>
        item.webinarName?.toLowerCase().includes(q) ||
        item.conductorName?.toLowerCase().includes(q) ||
        item.transcriptText?.toLowerCase().includes(q)
    );
  }, [transcripts, search]);

  // Summary numbers for the stat tiles
  const stats = useMemo(() => {
    const total = transcripts.length;
    const words = transcripts.reduce((acc, t) => acc + countWords(t.transcriptText), 0);
    const readMin = Math.max(0, Math.round(words / 200));
    const latestRaw = transcripts
      .map((t) => t.webinarDate)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0];
    const latest = latestRaw
      ? new Date(latestRaw).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : '—';
    return { total, words, readMin, latest };
  }, [transcripts]);

  const tile = (light, dark) => (isDark ? dark : light);

  const statTiles = [
    {
      label: 'Transcribed Meetings',
      value: stats.total,
      icon: <DescriptionIcon sx={{ fontSize: 28 }} />,
      bg: tile('linear-gradient(135deg, #FFF1E2 0%, #FFF8F0 100%)', 'linear-gradient(135deg, rgba(249,115,22,0.16) 0%, rgba(249,115,22,0.06) 100%)'),
      border: 'rgba(249,115,22,0.20)',
      iconBg: tile('#FFE0C2', 'rgba(249,115,22,0.25)'),
      iconColor: '#EA580C',
      shadow: 'rgba(249,115,22,0.16)',
    },
    {
      label: 'Words Transcribed',
      value: stats.words.toLocaleString(),
      icon: <TextSnippetOutlinedIcon sx={{ fontSize: 28 }} />,
      bg: tile('linear-gradient(135deg, #EAF2FF 0%, #F5F9FF 100%)', 'linear-gradient(135deg, rgba(66,133,244,0.18) 0%, rgba(66,133,244,0.06) 100%)'),
      border: 'rgba(66,133,244,0.22)',
      iconBg: tile('#D6E6FF', 'rgba(66,133,244,0.28)'),
      iconColor: tile('#1D4ED8', '#7FB0FF'),
      shadow: 'rgba(66,133,244,0.16)',
    },
    {
      label: 'Reading Time',
      value: `${stats.readMin} min`,
      icon: <MenuBookOutlinedIcon sx={{ fontSize: 28 }} />,
      bg: tile('linear-gradient(135deg, #E9F9EE 0%, #F4FCF7 100%)', 'linear-gradient(135deg, rgba(34,197,94,0.16) 0%, rgba(34,197,94,0.06) 100%)'),
      border: 'rgba(34,197,94,0.24)',
      iconBg: tile('#CDF3D8', 'rgba(34,197,94,0.26)'),
      iconColor: '#16A34A',
      shadow: 'rgba(34,197,94,0.16)',
    },
    {
      label: 'Latest Meeting',
      value: stats.latest,
      icon: <EventAvailableIcon sx={{ fontSize: 28 }} />,
      bg: tile('linear-gradient(135deg, #F3EDFF 0%, #FAF7FF 100%)', 'linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(139,92,246,0.06) 100%)'),
      border: 'rgba(139,92,246,0.22)',
      iconBg: tile('#E4D8FF', 'rgba(139,92,246,0.28)'),
      iconColor: tile('#7C3AED', '#B79CFF'),
      shadow: 'rgba(139,92,246,0.16)',
    },
  ];

  const waveBars = [14, 26, 40, 22, 52, 34, 60, 28, 44, 18, 36, 24, 48, 20];

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, minHeight: '100vh', bgcolor: colors.bg }}>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          mb: 3,
          px: { xs: 3, md: 5 },
          py: { xs: 3.5, md: 4.5 },
          borderRadius: '32px',
          background: isDark
            ? 'radial-gradient(circle at 85% 20%, rgba(66,133,244,0.18) 0%, transparent 40%), radial-gradient(circle at 10% 100%, rgba(249,115,22,0.16) 0%, transparent 45%), linear-gradient(120deg, #1E293B 0%, #172338 100%)'
            : 'radial-gradient(circle at 85% 20%, rgba(66,133,244,0.10) 0%, transparent 40%), radial-gradient(circle at 10% 100%, rgba(253,224,71,0.25) 0%, transparent 45%), linear-gradient(120deg, #FFF3E6 0%, #FFF9F2 50%, #F3F7FF 100%)',
          border: '1px solid rgba(249,115,22,0.16)',
          boxShadow: '0 10px 40px rgba(249,115,22,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 3,
        }}
      >
        <Box sx={{ position: 'relative', zIndex: 2, maxWidth: 640 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.8,
              px: 1.6,
              py: 0.6,
              mb: 2,
              borderRadius: '999px',
              bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(249,115,22,0.22)',
              boxShadow: '0 2px 8px rgba(249,115,22,0.10)',
            }}
          >
            <AutoAwesomeIcon sx={{ fontSize: 17, color: '#EA580C' }} />
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: isDark ? '#FDBA74' : '#9A3412' }}>
              AI Speech-to-Text
            </Typography>
          </Box>

          <Typography
            component="h1"
            sx={{
              fontWeight: 800,
              fontSize: { xs: '1.9rem', md: '2.7rem' },
              lineHeight: 1.12,
              letterSpacing: '-1px',
              color: colors.textPrimary,
            }}
          >
            Every Session,{' '}
            <Box
              component="span"
              sx={{
                background: 'linear-gradient(90deg, #F97316 0%, #F2B705 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Transcribed
            </Box>
          </Typography>
          <Typography sx={{ mt: 1.5, color: colors.textSecondary, fontSize: { xs: '0.95rem', md: '1.05rem' }, lineHeight: 1.6 }}>
            Automated speech-to-text transcripts generated for completed webinar sessions. Search, copy, or download them anytime.
          </Typography>

          <Button
            variant="contained"
            onClick={() => fetchTranscripts(true)}
            disabled={loading || refreshing}
            startIcon={refreshing ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <RefreshIcon />}
            sx={{
              mt: 3,
              px: 3.2,
              py: 1.3,
              borderRadius: '16px',
              textTransform: 'none',
              fontWeight: 800,
              fontSize: '0.98rem',
              color: '#FFFFFF',
              background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
              boxShadow: '0 10px 24px rgba(234,88,12,0.35)',
              '&:hover': {
                background: 'linear-gradient(135deg, #FB923C 0%, #EA580C 100%)',
                boxShadow: '0 14px 30px rgba(234,88,12,0.45)',
              },
              '&.Mui-disabled': { color: '#FFFFFF', opacity: 0.7 },
            }}
          >
            {refreshing ? 'Refreshing...' : 'Refresh Transcripts'}
          </Button>
        </Box>

        {/* Illustration: transcript card with a sound wave */}
        <Box sx={{ display: { xs: 'none', md: 'block' }, position: 'relative', width: 380, height: 220, flexShrink: 0, mr: 2 }}>
          <Box sx={{ position: 'absolute', top: -6, left: 10, width: 120, height: 120, borderRadius: '50%', bgcolor: 'rgba(134,239,172,0.55)' }} />
          <Box sx={{ position: 'absolute', bottom: 0, right: 0, width: 130, height: 130, borderRadius: '50%', bgcolor: 'rgba(147,197,253,0.50)' }} />
          <Box sx={{ position: 'absolute', top: 30, right: 36, width: 56, height: 56, borderRadius: '50%', bgcolor: 'rgba(253,224,71,0.65)' }} />

          <Box
            sx={{
              position: 'absolute',
              top: 18,
              left: 44,
              width: 270,
              height: 178,
              borderRadius: '18px',
              bgcolor: isDark ? '#243049' : '#FFFFFF',
              transform: 'rotate(-5deg)',
              boxShadow: '0 22px 44px rgba(15,23,42,0.18)',
              border: '2px solid #F97316',
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#EF4444' }} />
              <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '1.5px', color: '#EA580C' }}>
                TRANSCRIPT
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '3px', height: 62 }}>
              {waveBars.map((h, i) => (
                <Box
                  key={i}
                  sx={{
                    flex: 1,
                    height: h,
                    borderRadius: '4px',
                    background: i % 3 === 0 ? 'linear-gradient(180deg,#4285F4,#38BDF8)' : 'linear-gradient(180deg,#F97316,#F2B705)',
                  }}
                />
              ))}
            </Box>
            <Box sx={{ width: '90%', height: 4, borderRadius: 2, bgcolor: isDark ? 'rgba(255,255,255,0.15)' : '#E2E8F0' }} />
            <Box sx={{ width: '72%', height: 4, borderRadius: 2, bgcolor: isDark ? 'rgba(255,255,255,0.10)' : '#EEF2F7' }} />
            <Box sx={{ width: '82%', height: 4, borderRadius: 2, bgcolor: isDark ? 'rgba(255,255,255,0.10)' : '#EEF2F7' }} />
          </Box>

          <Box
            sx={{
              position: 'absolute',
              bottom: 8,
              left: 250,
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #FDE047 0%, #F2B705 60%, #D97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 12px 26px rgba(217,119,6,0.4)',
              border: '3px solid #FFFFFF',
            }}
          >
            <GraphicEqIcon sx={{ color: '#FFFFFF', fontSize: 34 }} />
          </Box>

          <Box
            sx={{
              position: 'absolute',
              top: 0,
              right: 22,
              width: 62,
              height: 62,
              borderRadius: '18px',
              bgcolor: '#172338',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: 'rotate(8deg)',
              boxShadow: '0 12px 26px rgba(23,35,56,0.35)',
            }}
          >
            <AutoAwesomeIcon sx={{ color: '#FDE047', fontSize: 32 }} />
          </Box>
        </Box>
      </Box>

      {/* ── Stat tiles ───────────────────────────────────────────── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
          gap: 2,
          mb: 4,
        }}
      >
        {statTiles.map((t) => (
          <Box
            key={t.label}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              p: { xs: 1.75, md: 2.5 },
              borderRadius: '24px',
              background: t.bg,
              border: `1px solid ${t.border}`,
              transition: 'all 0.25s ease',
              '&:hover': { transform: 'translateY(-3px)', boxShadow: `0 14px 30px ${t.shadow}` },
            }}
          >
            <Box
              sx={{
                width: 54,
                height: 54,
                borderRadius: '16px',
                bgcolor: t.iconBg,
                color: t.iconColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {t.icon}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: colors.textSecondary }} noWrap>
                {t.label}
              </Typography>
              <Typography sx={{ fontSize: { xs: '1.5rem', md: '1.9rem' }, fontWeight: 800, color: colors.textPrimary, lineHeight: 1.15 }} noWrap>
                {t.value}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      {/* ── Section header + search ─────────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', md: 'flex-end' },
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography
            component="h2"
            sx={{ fontSize: { xs: '1.6rem', md: '2rem' }, fontWeight: 800, letterSpacing: '-0.6px', color: colors.textPrimary, lineHeight: 1.2 }}
          >
            Meeting Transcript
          </Typography>
          <Typography sx={{ mt: 0.5, color: colors.textSecondary, fontSize: '0.95rem' }}>
            Browse every transcript, copy the text, or download it as a .txt file.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: { xs: '100%', md: 'auto' }, flexWrap: 'wrap' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              height: 48,
              width: { xs: '100%', sm: 380 },
              borderRadius: '999px',
              bgcolor: colors.surface,
              border: `1px solid ${colors.border}`,
              boxShadow: '0 2px 10px rgba(15,23,42,0.04)',
              transition: 'all 0.2s ease',
              '&:focus-within': { borderColor: '#4285F4', boxShadow: '0 0 0 4px rgba(66,133,244,0.15)' },
            }}
          >
            <SearchIcon sx={{ color: '#94A3B8', fontSize: 22 }} />
            <InputBase
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by webinar, speaker, or text..."
              sx={{ flex: 1, fontSize: '0.95rem', fontWeight: 500, color: colors.textPrimary }}
            />
            {search && (
              <IconButton size="small" onClick={() => setSearch('')} sx={{ color: '#94A3B8' }}>
                <CloseIcon sx={{ fontSize: 18 }} />
              </IconButton>
            )}
          </Box>

          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.8,
              height: 48,
              px: 2,
              borderRadius: '999px',
              bgcolor: '#172338',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.88rem',
              whiteSpace: 'nowrap',
            }}
          >
            <DescriptionIcon sx={{ fontSize: 18, color: '#FDE047' }} />
            {filteredList.length} of {transcripts.length}
          </Box>
        </Box>
      </Box>

      {/* ── Content ──────────────────────────────────────────────── */}
      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 12, gap: 2 }}>
          <CircularProgress size={44} thickness={4.5} sx={{ color: '#F97316' }} />
          <Typography variant="body2" sx={{ color: colors.textSecondary, fontWeight: 600 }}>
            Loading transcribed meetings...
          </Typography>
        </Box>
      ) : filteredList.length === 0 ? (
        <Box
          sx={{
            py: 8,
            px: 3,
            textAlign: 'center',
            borderRadius: '32px',
            background: isDark
              ? 'linear-gradient(135deg, rgba(249,115,22,0.10) 0%, transparent 60%)'
              : 'linear-gradient(135deg, #FFF7ED 0%, #FFFFFF 55%, #F3F7FF 100%)',
            border: '1px dashed rgba(249,115,22,0.35)',
            maxWidth: 620,
            mx: 'auto',
            mt: 2,
          }}
        >
          <Box
            sx={{
              width: 84,
              height: 84,
              borderRadius: '26px',
              background: 'linear-gradient(135deg, #FDE047 0%, #F2B705 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2.5,
              boxShadow: '0 12px 28px rgba(242,183,5,0.4)',
            }}
          >
            <DescriptionIcon sx={{ fontSize: 44, color: '#172338' }} />
          </Box>
          <Typography sx={{ fontSize: '1.35rem', fontWeight: 800, color: colors.textPrimary, mb: 0.75 }}>
            {transcripts.length === 0 ? 'No Transcribed Meetings Found' : 'No transcripts match your search'}
          </Typography>
          <Typography sx={{ color: colors.textSecondary, maxWidth: 440, mx: 'auto', mb: search ? 3 : 0, lineHeight: 1.6 }}>
            {transcripts.length === 0
              ? 'Transcripts are automatically generated using Groq Whisper after webinars complete.'
              : 'Try clearing your search keyword to see every transcript.'}
          </Typography>
          {search && (
            <Button
              variant="outlined"
              onClick={() => setSearch('')}
              sx={{ px: 3, borderRadius: '999px', textTransform: 'none', fontWeight: 700, color: '#EA580C', borderColor: '#FDBA74' }}
            >
              Reset Search
            </Button>
          )}
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pb: 4 }}>
          {filteredList.map((item) => {
            const host = item.conductorName || 'Speaker';
            const words = countWords(item.transcriptText);
            const expanded = !!expandedIds[item.id];

            return (
              <Paper
                key={item.id}
                elevation={0}
                sx={{
                  borderRadius: '28px',
                  bgcolor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.3)' : '0 8px 30px rgba(15,23,42,0.05)',
                  overflow: 'hidden',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    boxShadow: '0 20px 46px rgba(249,115,22,0.14)',
                    borderColor: 'rgba(249,115,22,0.35)',
                  },
                }}
              >
                {/* Card header */}
                <Box
                  sx={{
                    p: { xs: 2.25, sm: 3 },
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 2,
                    background: isDark
                      ? 'linear-gradient(120deg, rgba(249,115,22,0.10) 0%, transparent 70%)'
                      : 'linear-gradient(120deg, #FFF6EC 0%, #FFFFFF 70%)',
                    borderBottom: `1px solid ${colors.border}`,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0, flex: 1 }}>
                    <Box
                      sx={{
                        width: 52,
                        height: 52,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
                        color: '#FFFFFF',
                        fontWeight: 800,
                        fontSize: '1.2rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: '0 8px 18px rgba(234,88,12,0.30)',
                      }}
                    >
                      {host.trim().charAt(0).toUpperCase()}
                    </Box>

                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.6 }}>
                        <Typography
                          sx={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.3px', color: colors.textPrimary, lineHeight: 1.2 }}
                        >
                          {item.webinarName}
                        </Typography>
                        <Chip
                          icon={<CheckCircleIcon sx={{ fontSize: '16px !important', color: '#16A34A !important' }} />}
                          label="Transcribed"
                          size="small"
                          sx={{ height: 26, fontWeight: 700, fontSize: '0.76rem', bgcolor: '#DCFCE7', color: '#166534', borderRadius: '999px' }}
                        />
                        {item.categoryName && (
                          <Chip
                            label={item.categoryName}
                            size="small"
                            sx={{ height: 26, fontWeight: 700, fontSize: '0.76rem', bgcolor: '#EDE9FE', color: '#5B21B6', borderRadius: '999px' }}
                          />
                        )}
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
                        <Typography sx={{ fontSize: '0.85rem', color: colors.textSecondary, fontWeight: 600 }}>
                          Host: <strong style={{ color: colors.textPrimary }}>{host}</strong>
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                          <CalendarMonthIcon sx={{ fontSize: 16, color: colors.textSecondary }} />
                          <Typography sx={{ fontSize: '0.85rem', color: colors.textSecondary, fontWeight: 600 }}>
                            {formatUtcToLocalDateOnly(item.webinarDate)}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                          <TextSnippetOutlinedIcon sx={{ fontSize: 16, color: colors.textSecondary }} />
                          <Typography sx={{ fontSize: '0.85rem', color: colors.textSecondary, fontWeight: 600 }}>
                            {words.toLocaleString()} words
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1.2, flexWrap: 'wrap' }}>
                    <Button
                      variant="outlined"
                      startIcon={<ContentCopyIcon sx={{ fontSize: 18 }} />}
                      onClick={() => handleCopyText(item.transcriptText, item.webinarName)}
                      sx={{
                        borderRadius: '14px',
                        py: 1,
                        px: 2,
                        textTransform: 'none',
                        fontWeight: 700,
                        color: '#1D4ED8',
                        borderColor: 'rgba(66,133,244,0.45)',
                        bgcolor: 'rgba(66,133,244,0.05)',
                        '&:hover': { bgcolor: 'rgba(66,133,244,0.12)', borderColor: '#4285F4' },
                      }}
                    >
                      Copy Text
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<DownloadIcon sx={{ fontSize: 18 }} />}
                      onClick={() => handleDownloadTxt(item.transcriptText, item.webinarName)}
                      sx={{
                        borderRadius: '14px',
                        py: 1,
                        px: 2.2,
                        textTransform: 'none',
                        fontWeight: 800,
                        color: '#FFFFFF',
                        background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
                        boxShadow: '0 8px 20px rgba(234,88,12,0.30)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #FB923C 0%, #EA580C 100%)',
                          boxShadow: '0 12px 26px rgba(234,88,12,0.42)',
                        },
                      }}
                    >
                      Download .txt
                    </Button>
                  </Box>
                </Box>

                {/* Transcript body */}
                <Box sx={{ p: { xs: 2.25, sm: 3 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <GraphicEqIcon sx={{ fontSize: 20, color: '#EA580C' }} />
                    <Typography sx={{ fontWeight: 800, fontSize: '0.78rem', color: '#EA580C', textTransform: 'uppercase', letterSpacing: '0.9px' }}>
                      Full Speech Transcript
                    </Typography>
                  </Box>

                  <Box sx={{ position: 'relative' }}>
                    <Box
                      sx={{
                        p: 2.5,
                        borderRadius: '20px',
                        bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(100,116,139,0.06)',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(100,116,139,0.12)'}`,
                        lineHeight: 1.85,
                        fontSize: '15px',
                        color: colors.textPrimary,
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                        maxHeight: expanded ? 520 : 190,
                        overflowY: expanded ? 'auto' : 'hidden',
                        transition: 'max-height 0.35s ease',
                      }}
                    >
                      {item.transcriptText || 'No transcript text available for this recording.'}
                    </Box>

                    {!expanded && words > 60 && (
                      <Box
                        sx={{
                          position: 'absolute',
                          left: 1,
                          right: 1,
                          bottom: 1,
                          height: 70,
                          borderRadius: '0 0 20px 20px',
                          pointerEvents: 'none',
                          background: isDark
                            ? `linear-gradient(180deg, transparent, ${colors.surface})`
                            : 'linear-gradient(180deg, rgba(248,250,252,0), #F4F6F9)',
                        }}
                      />
                    )}
                  </Box>

                  {words > 60 && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1.5 }}>
                      <Button
                        onClick={() => toggleExpand(item.id)}
                        endIcon={
                          <ExpandMoreIcon
                            sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s ease' }}
                          />
                        }
                        sx={{ textTransform: 'none', fontWeight: 700, color: '#EA580C', borderRadius: '999px', px: 2.5 }}
                      >
                        {expanded ? 'Show less' : 'Read full transcript'}
                      </Button>
                    </Box>
                  )}
                </Box>
              </Paper>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
