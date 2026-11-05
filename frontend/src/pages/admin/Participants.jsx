import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Avatar,
  CircularProgress, Tooltip, FormControl, Select, MenuItem,
  Card, CardContent, Grid
} from '@mui/material';
import GroupsIcon            from '@mui/icons-material/Groups';
import WorkspacePremiumIcon  from '@mui/icons-material/WorkspacePremium';
import AccessTimeIcon        from '@mui/icons-material/AccessTime';
import CheckCircleIcon       from '@mui/icons-material/CheckCircle';
import VideoCameraFrontIcon  from '@mui/icons-material/VideoCameraFront';
import toast                 from 'react-hot-toast';

import { webinarService }    from '../../services/api';
import { useThemeColors }    from '../../context/ThemeContext';
import CustomSearchBar       from '../../components/CustomSearchBar';
import { formatUtcToLocal, formatUtcToLocalDateOnly } from '../../utils/validation';

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

  const [webinars, setWebinars]                    = useState([]);
  const [selectedWebinarId, setSelectedWebinarId]  = useState('');
  const [participants, setParticipants]            = useState([]);
  const [filtered, setFiltered]                    = useState([]);
  const [loadingWebinars, setLoadingWebinars]      = useState(true);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [search, setSearch]                        = useState('');

  // ── 1. Load Webinars for Dropdown (sorted by latest first) ────────
  const loadWebinars = useCallback(async () => {
    setLoadingWebinars(true);
    try {
      const res = await webinarService.getAll();
      if (res.data?.success) {
        const list = res.data.data || [];
        setWebinars(list);

        // By default, select the latest created webinar
        if (list.length > 0) {
          const latestId = String(list[0].id);
          setSelectedWebinarId(latestId);
        }
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

  // ── 2. Load Participants from wms.WebinarCompleted ────────────────
  const loadParticipants = useCallback(async (webinarId) => {
    setLoadingParticipants(true);
    try {
      const res = await webinarService.getParticipants(webinarId);
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
    }
  }, []);

  // When selectedWebinarId changes, fetch participants
  useEffect(() => {
    if (selectedWebinarId) {
      loadParticipants(selectedWebinarId === '-1' ? -1 : Number(selectedWebinarId));
    }
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
        (p.customUserId && p.customUserId.toLowerCase().includes(q)) ||
        (p.certificateCode && p.certificateCode.toLowerCase().includes(q)) ||
        (p.mobileNumber && p.mobileNumber.toLowerCase().includes(q)) ||
        (p.webinarName && p.webinarName.toLowerCase().includes(q))
      )
    );
  }, [search, participants]);

  // ── 4. Stats Summary ──────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = filtered.length;
    const attended = filtered.filter(p => p.isAttended).length;
    const certified = filtered.filter(p => p.isCertificateEligible).length;
    const totalSeconds = filtered.reduce((acc, p) => acc + (p.attendedDuration || 0), 0);
    const avgSeconds = total > 0 ? Math.round(totalSeconds / total) : 0;
    return {
      total,
      attended,
      certified,
      avgTime: fmtDuration(avgSeconds)
    };
  }, [filtered]);

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1600, mx: 'auto', width: '100%' }}>

      {/* ── Page Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2.5,
              bgcolor: colors.accentMuted,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <GroupsIcon sx={{ fontSize: 24, color: colors.accent }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: colors.primary, letterSpacing: '-0.3px' }}>
              Webinar Participants
            </Typography>
            <Typography variant="body2" sx={{ color: colors.textMuted, fontSize: '13px' }}>
              Track student session attendance, durations, and certificate status from completed webinars
            </Typography>
          </Box>
        </Box>

        {/* ── Webinar Dropdown Selector ── */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: { xs: '100%', sm: 320 } }}>
          <Typography sx={{ fontSize: '13px', fontWeight: 700, color: colors.textSecondary, whiteSpace: 'nowrap' }}>
            Select Webinar:
          </Typography>
          <FormControl size="small" fullWidth sx={{ minWidth: 240 }}>
            <Select
              value={selectedWebinarId}
              onChange={(e) => setSelectedWebinarId(e.target.value)}
              disabled={loadingWebinars || webinars.length === 0}
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
              {loadingWebinars ? (
                <MenuItem disabled value="">
                  Loading webinars...
                </MenuItem>
              ) : webinars.length === 0 ? (
                <MenuItem disabled value="">
                  No webinars available
                </MenuItem>
              ) : (
                [
                  <MenuItem key="-1" value="-1" sx={{ fontWeight: 700, color: colors.accent }}>
                    ⚡ All Webinars (Combined)
                  </MenuItem>,
                  ...webinars.map((w, idx) => (
                    <MenuItem key={w.id} value={String(w.id)}>
                      {w.webinarName} {idx === 0 ? ' (Latest)' : ''}
                    </MenuItem>
                  ))
                ]
              )}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* ── Summary Stats Cards ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ border: `1px solid ${colors.border}`, borderRadius: 2.5, bgcolor: colors.surface }}>
            <CardContent sx={{ p: 2.2, '&:last-child': { pb: 2.2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Total Completed
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: colors.primary, mt: 0.5 }}>
                    {stats.total}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(56, 189, 248, 0.12)', color: '#0284C7', width: 44, height: 44 }}>
                  <VideoCameraFrontIcon sx={{ fontSize: 22 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
         
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ border: `1px solid ${colors.border}`, borderRadius: 2.5, bgcolor: colors.surface }}>
            <CardContent sx={{ p: 2.2, '&:last-child': { pb: 2.2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Certificates Ready
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#D97706', mt: 0.5 }}>
                    {stats.certified}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(245, 158, 11, 0.14)', color: '#D97706', width: 44, height: 44 }}>
                  <WorkspacePremiumIcon sx={{ fontSize: 22 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ border: `1px solid ${colors.border}`, borderRadius: 2.5, bgcolor: colors.surface }}>
            <CardContent sx={{ p: 2.2, '&:last-child': { pb: 2.2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Average Attended Time
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: colors.primary, mt: 0.5 }}>
                    {stats.avgTime}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(99, 102, 241, 0.12)', color: '#4F46E5', width: 44, height: 44 }}>
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
        placeholder="Search participant by name, email, User ID, certificate code..."
        sx={{ mb: 2.5 }}
      />

      {/* ── Participants Table ── */}
      <Paper elevation={0} sx={{ border: `1px solid ${colors.border}`, borderRadius: 2.5, overflow: 'hidden' }}>
        {loadingParticipants ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, gap: 1.5 }}>
            <CircularProgress size={36} sx={{ color: colors.accent }} />
            <Typography sx={{ color: colors.textMuted, fontSize: '13.5px' }}>
              Loading participants from WebinarCompleted...
            </Typography>
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography sx={{ color: colors.textMuted, fontSize: '14px', fontWeight: 600 }}>
              {search
                ? 'No participants match your search criteria.'
                : 'No completion records found for this webinar yet.'}
            </Typography>
            <Typography sx={{ color: colors.textSecondary, fontSize: '12.5px', mt: 0.5 }}>
              Participants appear here automatically when the session finishes or attendance is recorded.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: colors.surfaceAlt }}>
                  {['#', 'Participant', 'Email & Phone', 'Webinar', 'Meeting User ID', 'Attended Duration', 'Certificate Code', 'Completed At'].map((h) => (
                    <TableCell
                      key={h}
                      sx={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: colors.textMuted,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        py: 1.5
                      }}
                    >
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>

              <TableBody>
                {filtered.map((p, idx) => {
                  const initial = (p.fullName || p.firstName || 'S').charAt(0).toUpperCase();

                  return (
                    <TableRow
                      key={p.completionId || p.webinarRegisterId || idx}
                      sx={{
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.015)' },
                        '&:last-child td': { borderBottom: 'none' }
                      }}
                    >
                      {/* # Index */}
                      <TableCell sx={{ fontSize: '13px', color: colors.textMuted, fontWeight: 600 }}>
                        {idx + 1}
                      </TableCell>

                      {/* Participant Profile */}
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar
                            sx={{
                              width: 36,
                              height: 36,
                              bgcolor: colors.accentMuted,
                              color: colors.accent,
                              fontWeight: 700,
                              fontSize: '14px'
                            }}
                          >
                            {initial}
                          </Avatar>
                          <Box>
                            <Typography sx={{ fontSize: '13.5px', fontWeight: 700, color: colors.primary, lineHeight: 1.2 }}>
                              {p.fullName || 'Student'}
                            </Typography>
                          
                          </Box>
                        </Box>
                      </TableCell>

                      {/* Contact Info */}
                      <TableCell>
                        <Typography sx={{ fontSize: '13px', color: colors.textSecondary }}>
                          {p.email}
                        </Typography>
                        {p.fullPhoneNumber && (
                          <Typography sx={{ fontSize: '11px', color: colors.textMuted }}>
                            {p.fullPhoneNumber}
                          </Typography>
                        )}
                      </TableCell>

                      {/* Webinar Title */}
                      <TableCell sx={{ maxWidth: 220 }}>
                        <Typography
                          noWrap
                          title={p.webinarName}
                          sx={{ fontSize: '13px', fontWeight: 600, color: colors.primary }}
                        >
                          {p.webinarName}
                        </Typography>
                        <Typography sx={{ fontSize: '11px', color: colors.textMuted }}>
                          {formatUtcToLocalDateOnly(p.webinarDate)}
                        </Typography>
                      </TableCell>

                      {/* Meeting User ID */}
                      <TableCell>
                        <Chip
                          label={p.customUserId || `UserId - ${p.userId}`}
                          size="small"
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            bgcolor: 'rgba(15, 23, 42, 0.06)',
                            color: colors.primary
                          }}
                        />
                      </TableCell>

                      {/* Attended Duration */}
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <AccessTimeIcon sx={{ fontSize: 16, color: '#D97706' }} />
                          <Typography sx={{ fontSize: '13px', fontWeight: 700, color: colors.primary }}>
                            {fmtDuration(p.attendedDuration)}
                          </Typography>
                        </Box>
                        
                      </TableCell>

                      {/* Certificate Status & Code */}
                      <TableCell>
                        {p.isCertificateEligible ? (
                          <Box>
                            <Chip
                              icon={<WorkspacePremiumIcon sx={{ fontSize: '15px !important', color: '#15803D' }} />}
                              label="Eligible"
                              size="small"
                              sx={{
                                fontSize: '11px',
                                fontWeight: 700,
                                bgcolor: 'rgba(34, 197, 94, 0.12)',
                                color: '#15803D',
                                mb: 0.5
                              }}
                            />
                            {p.certificateCode && (
                              <Typography sx={{ fontSize: '10.5px', fontFamily: 'monospace', color: colors.textMuted, display: 'block' }}>
                                {p.certificateCode}
                              </Typography>
                            )}
                          </Box>
                        ) : (
                          <Chip
                            label="Ineligible"
                            size="small"
                            sx={{ fontSize: '11px', fontWeight: 600, bgcolor: colors.surfaceAlt, color: colors.textMuted }}
                          />
                        )}
                      </TableCell>

                      {/* Completed At Timestamp */}
                      <TableCell sx={{ fontSize: '12px', color: colors.textSecondary }}>
                        {formatUtcToLocal(p.completedAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}

