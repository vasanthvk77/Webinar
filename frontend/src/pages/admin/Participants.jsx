import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Avatar,
  CircularProgress, Tooltip, FormControl, Select, MenuItem,
  Card, CardContent, Grid, Button, IconButton
} from '@mui/material';
import GroupsIcon            from '@mui/icons-material/Groups';
import WorkspacePremiumIcon  from '@mui/icons-material/WorkspacePremium';
import AccessTimeIcon        from '@mui/icons-material/AccessTime';
import CheckCircleIcon       from '@mui/icons-material/CheckCircle';
import VideoCameraFrontIcon  from '@mui/icons-material/VideoCameraFront';
import FileDownloadIcon      from '@mui/icons-material/FileDownload';
import RefreshIcon           from '@mui/icons-material/Refresh';
import MilitaryTechIcon      from '@mui/icons-material/MilitaryTech';
import toast                 from 'react-hot-toast';

import { webinarService }    from '../../services/api';
import { useThemeColors, useAppTheme } from '../../context/ThemeContext';
import CustomSearchBar       from '../../components/CustomSearchBar';
import CustomPagination      from '../../components/CustomPagination';
import { formatUtcToLocalDateOnly, formatUtcToLocalTimeOnly } from '../../utils/validation';

// Helper: Format Duration (seconds -> hours/mins)
const fmtDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '0 min';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

export default function Participants() {
  const colors = useThemeColors();
  const { isDark } = useAppTheme();

  const [webinars, setWebinars]                       = useState([]);
  const [selectedWebinarId, setSelectedWebinarId]     = useState('-1'); // Default to All Webinars
  const [participants, setParticipants]               = useState([]);
  const [filtered, setFiltered]                       = useState([]);
  const [loadingWebinars, setLoadingWebinars]         = useState(true);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [refreshing, setRefreshing]                   = useState(false);
  const [search, setSearch]                           = useState('');
  const [page, setPage]                               = useState(1);
  const [pageSize, setPageSize]                       = useState(10);

  // ── 1. Load Webinars for Dropdown Filter ──────────────────────────
  const loadWebinars = useCallback(async () => {
    setLoadingWebinars(true);
    try {
      const res = await webinarService.getAll();
      if (res.data?.success) {
        const list = res.data.data || [];
        setWebinars(list);
      }
    } catch (err) {
      console.error('Failed to load webinars:', err);
      toast.error('Failed to load webinar list');
    } finally {
      setLoadingWebinars(false);
    }
  }, []);

  useEffect(() => {
    loadWebinars();
  }, [loadWebinars]);

  // ── 2. Load Participants via wms.GetParticipants ─────────────────
  const loadParticipants = useCallback(async (webinarId, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoadingParticipants(true);

    try {
      const wid = (webinarId === '-1' || !webinarId) ? null : Number(webinarId);
      const res = await webinarService.getParticipants(wid);
      if (res.data?.success) {
        const data = res.data.data || [];
        setParticipants(data);
        setFiltered(data);
      }
    } catch (err) {
      console.error('Failed to load participants:', err);
      toast.error('Failed to load participants');
    } finally {
      setLoadingParticipants(false);
      setRefreshing(false);
    }
  }, []);

  // When selectedWebinarId changes, fetch participants
  useEffect(() => {
    loadParticipants(selectedWebinarId);
  }, [selectedWebinarId, loadParticipants]);

  // ── 3. Filter by search query ─────────────────────────────────────
  useEffect(() => {
    if (!search.trim()) {
      setFiltered(participants);
      return;
    }
    const q = search.toLowerCase();
    setFiltered(
      participants.filter(p =>
        (p.fullName && p.fullName.toLowerCase().includes(q)) ||
        (p.email && p.email.toLowerCase().includes(q)) ||
        (p.fullPhoneNumber && p.fullPhoneNumber.toLowerCase().includes(q)) ||
        (p.mobileNumber && p.mobileNumber.toLowerCase().includes(q)) ||
        String(p.userId).includes(q)
      )
    );
    setPage(1);
  }, [search, participants]);

  // Reset page when webinar filter changes
  useEffect(() => {
    setPage(1);
  }, [selectedWebinarId]);

  // ── Paginated Participants ─────────────────────────────────────────
  const paginatedParticipants = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // ── 4. Stats Summary ──────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalUsers = filtered.length;
    const totalCompletions = filtered.reduce((acc, p) => acc + (p.completedCount || 0), 0);
    const totalCertificates = filtered.reduce((acc, p) => acc + (p.certificatesEarned || 0), 0);
    const totalSeconds = filtered.reduce((acc, p) => acc + (p.totalAttendedDuration || 0), 0);
    const avgSeconds = totalUsers > 0 ? Math.round(totalSeconds / totalUsers) : 0;

    return {
      totalUsers,
      totalCompletions,
      totalCertificates,
      avgTime: fmtDuration(avgSeconds)
    };
  }, [filtered]);

  // ── 5. Export CSV ─────────────────────────────────────────────────
  const handleExportCSV = () => {
    if (filtered.length === 0) {
      toast.error('No participant records to export');
      return;
    }

    const headers = [
      'Rank',
      'User ID',
      'Participant Name',
      'Email',
      'Phone Number',
      'Completed Webinars Count',
      'Total Attended Duration',
      'Certificates Earned',
      'Last Completed Date'
    ];

    const rows = filtered.map((p, idx) => [
      idx + 1,
      p.userId,
      `"${(p.fullName || '').replace(/"/g, '""')}"`,
      `"${(p.email || '').replace(/"/g, '""')}"`,
      `"${(p.fullPhoneNumber || '').replace(/"/g, '""')}"`,
      p.completedCount || 0,
      `"${fmtDuration(p.totalAttendedDuration)}"`,
      p.certificatesEarned || 0,
      p.lastCompletedAt ? formatUtcToLocalDateOnly(p.lastCompletedAt) : '—'
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Webinar_Participants_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Participants report exported successfully');
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1600, mx: 'auto', width: '100%' }}>

      {/* ── Page Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2.5,
              bgcolor: 'rgba(217, 119, 6, 0.14)',
              color: '#D97706',
              boxShadow: '0 4px 12px rgba(217, 119, 6, 0.16)'
            }}
          >
            <GroupsIcon sx={{ fontSize: 26 }} />
          </Avatar>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: colors.textPrimary, letterSpacing: '-0.3px' }}>
              Webinar Participants
            </Typography>
            <Typography variant="body2" sx={{ color: colors.textMuted, fontSize: '13px' }}>
              Student session attendance rankings and completed webinar counts (descending order)
            </Typography>
          </Box>
        </Box>

        {/* Top Controls: Dropdown + Refresh + Export */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: '13px', fontWeight: 700, color: colors.textSecondary, whiteSpace: 'nowrap' }}>
              Filter Webinar:
            </Typography>
            <FormControl size="small" sx={{ minWidth: 260 }}>
              <Select
                value={selectedWebinarId}
                onChange={(e) => setSelectedWebinarId(e.target.value)}
                disabled={loadingWebinars}
                displayEmpty
                sx={{
                  borderRadius: 2,
                  bgcolor: colors.surface,
                  fontSize: '13.5px',
                  fontWeight: 600,
                  border: `1px solid ${colors.border}`,
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' }
                }}
              >
                <MenuItem value="-1" sx={{ fontWeight: 750, color: '#D97706' }}>
                  ⚡ All Webinars (Combined Rankings)
                </MenuItem>
                {webinars.map((w, idx) => (
                  <MenuItem key={w.id} value={String(w.id)}>
                    {w.webinarName} {idx === 0 ? ' (Latest)' : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Tooltip title="Refresh participants">
            <IconButton
              onClick={() => loadParticipants(selectedWebinarId, true)}
              disabled={refreshing || loadingParticipants}
              sx={{
                bgcolor: colors.surface,
                border: `1px solid ${colors.border}`,
                color: colors.textSecondary,
                '&:hover': { bgcolor: colors.surfaceHover }
              }}
            >
              <RefreshIcon sx={{
                fontSize: 20,
                animation: refreshing ? 'spin 1s linear infinite' : 'none',
                '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } }
              }} />
            </IconButton>
          </Tooltip>

          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={handleExportCSV}
            disabled={loadingParticipants || filtered.length === 0}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '13px',
              px: 2,
              py: 0.9,
              borderColor: colors.border,
              color: colors.textPrimary,
              bgcolor: colors.surface,
              '&:hover': { bgcolor: colors.surfaceHover, borderColor: '#D97706' }
            }}
          >
            Export CSV
          </Button>
        </Box>
      </Box>

      {/* ── Summary Stats Cards ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Total Unique Students */}
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ border: `1px solid ${colors.border}`, borderRadius: 2.5, bgcolor: colors.surface }}>
            <CardContent sx={{ p: 2.2, '&:last-child': { pb: 2.2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Completed Students
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: colors.primary, mt: 0.5 }}>
                    {stats.totalUsers}
                  </Typography>
                  <Typography variant="caption" sx={{ color: colors.textMuted, fontSize: '11.5px', mt: 0.3, display: 'block' }}>
                    Unique participants
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(56, 189, 248, 0.12)', color: '#0284C7', width: 44, height: 44 }}>
                  <GroupsIcon sx={{ fontSize: 22 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Total Completed Sessions */}
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ border: `1px solid ${colors.border}`, borderRadius: 2.5, bgcolor: colors.surface }}>
            <CardContent sx={{ p: 2.2, '&:last-child': { pb: 2.2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Total Completions
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#10B981', mt: 0.5 }}>
                    {stats.totalCompletions}
                  </Typography>
                  <Typography variant="caption" sx={{ color: colors.textMuted, fontSize: '11.5px', mt: 0.3, display: 'block' }}>
                    Across completed sessions
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(16, 185, 129, 0.12)', color: '#10B981', width: 44, height: 44 }}>
                  <CheckCircleIcon sx={{ fontSize: 22 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Certificates Earned */}
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ border: `1px solid ${colors.border}`, borderRadius: 2.5, bgcolor: colors.surface }}>
            <CardContent sx={{ p: 2.2, '&:last-child': { pb: 2.2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Certificates Earned
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#D97706', mt: 0.5 }}>
                    {stats.totalCertificates}
                  </Typography>
                  <Typography variant="caption" sx={{ color: colors.textMuted, fontSize: '11.5px', mt: 0.3, display: 'block' }}>
                    Eligible for certificate download
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(245, 158, 11, 0.14)', color: '#D97706', width: 44, height: 44 }}>
                  <WorkspacePremiumIcon sx={{ fontSize: 22 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Average Attended Time */}
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ border: `1px solid ${colors.border}`, borderRadius: 2.5, bgcolor: colors.surface }}>
            <CardContent sx={{ p: 2.2, '&:last-child': { pb: 2.2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Avg. Attended Time
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#8B5CF6', mt: 0.5 }}>
                    {stats.avgTime}
                  </Typography>
                  <Typography variant="caption" sx={{ color: colors.textMuted, fontSize: '11.5px', mt: 0.3, display: 'block' }}>
                    Per registered student
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(139, 92, 246, 0.12)', color: '#8B5CF6', width: 44, height: 44 }}>
                  <AccessTimeIcon sx={{ fontSize: 22 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Search Bar ── */}
      <CustomSearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search participant by name, email, or phone number..."
        sx={{ mb: 2.5 }}
      />

      {/* ── Participants Table ── */}
      <Paper elevation={0} sx={{ border: `1px solid ${colors.border}`, borderRadius: 2.5, overflow: 'hidden', bgcolor: colors.surface }}>
        {loadingParticipants ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, gap: 1.5 }}>
            <CircularProgress size={36} sx={{ color: '#D97706' }} />
            <Typography sx={{ color: colors.textMuted, fontSize: '13.5px', fontWeight: 600 }}>
              Loading participants from WebinarCompleted...
            </Typography>
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography sx={{ color: colors.textMuted, fontSize: '14px', fontWeight: 600 }}>
              {search
                ? 'No participants match your search criteria.'
                : 'No completion records found yet.'}
            </Typography>
            <Typography sx={{ color: colors.textSecondary, fontSize: '12.5px', mt: 0.5 }}>
              Participants appear here automatically when sessions complete and attendance is recorded.
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC' }}>
                  {['RANK', 'PARTICIPANT NAME', 'EMAIL & PHONE', 'COMPLETED COUNT', 'TOTAL ATTENDED TIME', 'CERTIFICATES', 'LAST COMPLETED'].map((h, i) => (
                    <TableCell
                      key={h}
                      align={h === 'RANK' || h === 'COMPLETED COUNT' ? 'center' : 'left'}
                      sx={{
                        fontSize: '11.5px',
                        fontWeight: 800,
                        color: colors.textSecondary,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        py: 1.8
                      }}
                    >
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>

              <TableBody>
                {paginatedParticipants.map((p, idx) => {
                  const initial = (p.fullName || p.firstName || 'S').charAt(0).toUpperCase();
                  const rankNumber = (page - 1) * pageSize + idx + 1;
                  const isTopRank = rankNumber <= 3;

                  return (
                    <TableRow
                      key={p.userId || idx}
                      hover
                      sx={{
                        transition: 'background-color 0.15s ease',
                        '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(217, 119, 6, 0.03)' },
                        '&:last-child td': { borderBottom: 'none' }
                      }}
                    >
                      {/* Rank Index */}
                      <TableCell align="center" sx={{ py: 2 }}>
                        {isTopRank ? (
                          <Chip
                            label={`#${rankNumber}`}
                            size="small"
                            sx={{
                              fontWeight: 800,
                              fontSize: '12px',
                              bgcolor: rankNumber === 1 ? '#FEF3C7' : rankNumber === 2 ? '#E2E8F0' : '#FFEDD5',
                              color: rankNumber === 1 ? '#B45309' : rankNumber === 2 ? '#475569' : '#C2410C',
                              border: `1px solid ${rankNumber === 1 ? '#FDE68A' : rankNumber === 2 ? '#CBD5E1' : '#FED7AA'}`
                            }}
                          />
                        ) : (
                          <Typography sx={{ fontSize: '13px', color: colors.textMuted, fontWeight: 700 }}>
                            #{rankNumber}
                          </Typography>
                        )}
                      </TableCell>

                      {/* Participant Profile */}
                      <TableCell sx={{ py: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar
                            sx={{
                              width: 40,
                              height: 40,
                              bgcolor: isTopRank ? 'rgba(217, 119, 6, 0.15)' : colors.surfaceHover,
                              color: isTopRank ? '#D97706' : colors.textSecondary,
                              fontWeight: 800,
                              fontSize: '14.5px',
                              border: `1px solid ${colors.border}`
                            }}
                          >
                            {initial}
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 750, fontSize: '14px', color: colors.textPrimary, lineHeight: 1.3 }}>
                              {p.fullName || 'Student'}
                            </Typography>
                            <Typography variant="caption" sx={{ color: colors.textMuted, fontSize: '11.5px', display: 'block', mt: 0.2 }}>
                              User ID: #{p.userId}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>

                      {/* Contact: Email & Phone */}
                      <TableCell sx={{ py: 2 }}>
                        <Typography sx={{ fontSize: '13px', color: colors.textPrimary, fontWeight: 600 }}>
                          {p.email}
                        </Typography>
                        <Typography variant="caption" sx={{ color: colors.textMuted, fontSize: '12px', mt: 0.2, display: 'block' }}>
                          {p.fullPhoneNumber || p.mobileNumber || '—'}
                        </Typography>
                      </TableCell>

                      {/* Completed Count (Ranked descending) */}
                      <TableCell align="center" sx={{ py: 2 }}>
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                          <Chip
                            label={`${p.completedCount} Completed`}
                            size="small"
                            sx={{
                              fontWeight: 850,
                              fontSize: '12.5px',
                              px: 0.8,
                              py: 1.6,
                              bgcolor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
                              color: isDark ? '#34D399' : '#047857',
                              border: '1px solid rgba(16, 185, 129, 0.3)'
                            }}
                          />
                        </Box>
                      </TableCell>

                      {/* Attended Duration */}
                      <TableCell sx={{ py: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                          <AccessTimeIcon sx={{ fontSize: 15, color: colors.textMuted }} />
                          <Typography sx={{ fontSize: '13px', fontWeight: 650, color: colors.textPrimary }}>
                            {fmtDuration(p.totalAttendedDuration)}
                          </Typography>
                        </Box>
                      </TableCell>

                      {/* Certificates Earned */}
                      <TableCell sx={{ py: 2 }}>
                        {p.certificatesEarned > 0 ? (
                          <Chip
                            icon={<WorkspacePremiumIcon sx={{ fontSize: '15px !important', color: '#D97706 !important' }} />}
                            label={`${p.certificatesEarned} Ready`}
                            size="small"
                            sx={{
                              bgcolor: isDark ? 'rgba(217, 119, 6, 0.12)' : '#FEF3C7',
                              color: '#D97706',
                              fontWeight: 750,
                              fontSize: '12px',
                              border: '1px solid rgba(217, 119, 6, 0.25)'
                            }}
                          />
                        ) : (
                          <Typography sx={{ fontSize: '12.5px', color: colors.textMuted }}>
                            None
                          </Typography>
                        )}
                      </TableCell>

                      {/* Last Completed Date */}
                      <TableCell sx={{ py: 2 }}>
                        <Typography sx={{ fontSize: '12.5px', color: colors.textPrimary, fontWeight: 600 }}>
                          {p.lastCompletedAt ? formatUtcToLocalDateOnly(p.lastCompletedAt) : '—'}
                        </Typography>
                        {p.lastCompletedAt && (
                          <Typography variant="caption" sx={{ fontSize: '11px', color: colors.textMuted }}>
                            {formatUtcToLocalTimeOnly(p.lastCompletedAt)}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {/* ── Table Pagination ── */}
          <CustomPagination
            totalItems={filtered.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 20, 30, 50, 100]}
          />
        </>
        )}
      </Paper>
    </Box>
  );
}
