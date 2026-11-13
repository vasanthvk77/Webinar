import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Avatar,
  CircularProgress, Tooltip, IconButton, Card, CardContent,
  Grid, Button
} from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import CheckCircleIcon       from '@mui/icons-material/CheckCircle';
import CardGiftcardIcon     from '@mui/icons-material/CardGiftcard';
import VideoCameraFrontIcon  from '@mui/icons-material/VideoCameraFront';
import RefreshIcon           from '@mui/icons-material/Refresh';
import AccessTimeIcon        from '@mui/icons-material/AccessTime';
import PersonIcon            from '@mui/icons-material/Person';
import toast                 from 'react-hot-toast';

import { webinarService }    from '../../services/api';
import { useThemeColors, useAppTheme } from '../../context/ThemeContext';
import CustomSearchBar       from '../../components/CustomSearchBar';
import CustomPagination      from '../../components/CustomPagination';
import { formatUtcToLocalDateOnly, formatUtcToLocalTimeOnly } from '../../utils/validation';
import { getCurrencySymbolFromCountryCode } from '../../utils/countryUtils';

export default function StudentPayments() {
  const colors = useThemeColors();
  const { isDark } = useAppTheme();

  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [summaryData, setSummaryData] = useState({
    totalAmountPaid: 0,
    totalPaidWebinars: 0,
    totalFreeWebinars: 0,
    totalWebinars: 0,
    countryCode: '+91',
    webinars: []
  });
  const [search, setSearch]           = useState('');
  const [filterType, setFilterType]   = useState('all'); // 'all' | 'paid' | 'free'
  const [page, setPage]               = useState(1);
  const [pageSize, setPageSize]       = useState(10);

  // ── Dynamic Currency Symbol from User's Country Code ───────────────
  const currencySymbol = useMemo(() => {
    return getCurrencySymbolFromCountryCode(summaryData.countryCode || '+91');
  }, [summaryData.countryCode]);

  const formatCurrency = useCallback((amount) => {
    const num = Number(amount || 0);
    return `${currencySymbol}${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [currencySymbol]);

  // ── Load Student Payments Data ─────────────────────────────────────
  const loadPayments = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await webinarService.getMyPayments();
      if (res.data?.success && res.data?.data) {
        setSummaryData(res.data.data);
      } else {
        toast.error(res.data?.message || 'Failed to load your payments data');
      }
    } catch (err) {
      console.error('Failed to load student payments data:', err);
      toast.error('Unable to fetch your payment records');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // ── Search & Filter Logic ──────────────────────────────────────────
  const filteredWebinars = useMemo(() => {
    let list = summaryData.webinars || [];

    if (filterType === 'paid') {
      list = list.filter((w) => w.isPaid);
    } else if (filterType === 'free') {
      list = list.filter((w) => !w.isPaid);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (w) =>
          (w.webinarName && w.webinarName.toLowerCase().includes(q)) ||
          (w.conductorName && w.conductorName.toLowerCase().includes(q)) ||
          (w.categoryName && w.categoryName.toLowerCase().includes(q))
      );
    }

    return list;
  }, [summaryData.webinars, filterType, search]);

  // Reset pagination when search or filter changes
  useEffect(() => {
    setPage(1);
  }, [search, filterType]);

  const totalPages = Math.ceil(filteredWebinars.length / pageSize) || 1;
  const paginatedWebinars = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredWebinars.slice(start, start + pageSize);
  }, [filteredWebinars, page, pageSize]);

  return (
    <Box sx={{ width: '100%', maxWidth: 1600, mx: 'auto', p: { xs: 2, sm: 3 } }}>
      {/* ── Top Header ───────────────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 2,
          mb: 3
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              color: colors.textPrimary,
              fontSize: { xs: '1.5rem', sm: '1.875rem' },
              letterSpacing: '-0.02em',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5
            }}
          >
            Payments & Enrolments
          </Typography>
          <Typography variant="body2" sx={{ color: colors.textSecondary, mt: 0.5, fontSize: '13.5px' }}>
            Review your masterclass investments, enrolled sessions, and transaction history.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Tooltip title="Refresh payments data">
            <IconButton
              onClick={() => loadPayments(true)}
              disabled={refreshing || loading}
              sx={{
                bgcolor: colors.surface,
                border: `1px solid ${colors.border}`,
                color: colors.textSecondary,
                '&:hover': { bgcolor: colors.surfaceHover }
              }}
            >
              <RefreshIcon
                sx={{
                  fontSize: 20,
                  animation: refreshing ? 'spin 1s linear infinite' : 'none',
                  '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } }
                }}
              />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* ── KPI Summary Cards ────────────────────────────────────── */}
      <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
        {/* Total Amount Paid */}
        <Grid item xs={12} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              border: `1px solid ${colors.border}`,
              borderRadius: 3,
              bgcolor: colors.surface,
              background: isDark
                ? 'linear-gradient(135deg, rgba(234, 179, 8, 0.12) 0%, rgba(17, 24, 39, 0.95) 100%)'
                : 'linear-gradient(135deg, #FEFCE8 0%, #FFFFFF 100%)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
            }}
          >
            <CardContent sx={{ p: 2.4, '&:last-child': { pb: 2.4 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: '#D97706', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    Total Amount Paid
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 850, color: colors.textPrimary, mt: 0.5, letterSpacing: '-0.02em' }}>
                    {formatCurrency(summaryData.totalAmountPaid)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: colors.textMuted, fontSize: '11.5px', mt: 0.3, display: 'block' }}>
                    From {summaryData.totalPaidWebinars} paid session{summaryData.totalPaidWebinars === 1 ? '' : 's'}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(234, 179, 8, 0.16)', color: '#D97706', width: 48, height: 48 }}>
                  <AccountBalanceWalletIcon sx={{ fontSize: 26 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Paid Webinars Enrolled */}
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, bgcolor: colors.surface }}>
            <CardContent sx={{ p: 2.4, '&:last-child': { pb: 2.4 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Paid Webinars
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 850, color: '#0284C7', mt: 0.5 }}>
                    {summaryData.totalPaidWebinars}
                  </Typography>
                  <Typography variant="caption" sx={{ color: colors.textMuted, fontSize: '11.5px', mt: 0.3, display: 'block' }}>
                    Purchased masterclasses
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(2, 132, 199, 0.12)', color: '#0284C7', width: 48, height: 48 }}>
                  <CheckCircleIcon sx={{ fontSize: 24 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Free Webinars Enrolled */}
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, bgcolor: colors.surface }}>
            <CardContent sx={{ p: 2.4, '&:last-child': { pb: 2.4 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Free Webinars
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 850, color: '#16A34A', mt: 0.5 }}>
                    {summaryData.totalFreeWebinars}
                  </Typography>
                  <Typography variant="caption" sx={{ color: colors.textMuted, fontSize: '11.5px', mt: 0.3, display: 'block' }}>
                    Complimentary sessions
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(22, 163, 74, 0.12)', color: '#16A34A', width: 48, height: 48 }}>
                  <CardGiftcardIcon sx={{ fontSize: 24 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Total Enrolled Webinars */}
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, bgcolor: colors.surface }}>
            <CardContent sx={{ p: 2.4, '&:last-child': { pb: 2.4 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Total Enrolled
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 850, color: '#7C3AED', mt: 0.5 }}>
                    {summaryData.totalWebinars}
                  </Typography>
                  <Typography variant="caption" sx={{ color: colors.textMuted, fontSize: '11.5px', mt: 0.3, display: 'block' }}>
                    Overall registered workshops
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(124, 58, 237, 0.12)', color: '#7C3AED', width: 48, height: 48 }}>
                  <VideoCameraFrontIcon sx={{ fontSize: 24 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Search & Filter Controls ─────────────────────────────── */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          bgcolor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 2.5,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between'
        }}
      >
        <Box sx={{ maxWidth: { xs: '100%', sm: 380 }, width: '100%' }}>
          <CustomSearchBar
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by webinar, speaker, or category..."
          />
        </Box>

        {/* Filter Pills */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: `All (${summaryData.webinars?.length || 0})` },
            { id: 'paid', label: `Paid (${summaryData.totalPaidWebinars || 0})` },
            { id: 'free', label: `Free (${summaryData.totalFreeWebinars || 0})` }
          ].map((pill) => {
            const active = filterType === pill.id;
            return (
              <Button
                key={pill.id}
                onClick={() => setFilterType(pill.id)}
                size="small"
                sx={{
                  borderRadius: 20,
                  px: 2,
                  py: 0.6,
                  fontSize: '12.5px',
                  fontWeight: active ? 700 : 500,
                  textTransform: 'none',
                  bgcolor: active ? '#D97706' : colors.surfaceHover,
                  color: active ? '#FFFFFF' : colors.textSecondary,
                  border: `1px solid ${active ? '#D97706' : colors.border}`,
                  '&:hover': {
                    bgcolor: active ? '#B45309' : colors.surfaceHover,
                    borderColor: '#D97706'
                  }
                }}
              >
                {pill.label}
              </Button>
            );
          })}
        </Box>
      </Paper>

      {/* ── Payments Data Table ──────────────────────────────────── */}
      <Paper
        elevation={0}
        sx={{
          border: `1px solid ${colors.border}`,
          borderRadius: 2.5,
          bgcolor: colors.surface,
          overflow: 'hidden'
        }}
      >
        {loading ? (
          <Box sx={{ py: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={42} thickness={4.5} sx={{ color: '#D97706' }} />
            <Typography variant="body2" sx={{ color: colors.textSecondary, fontWeight: 600 }}>
              Loading your payment records...
            </Typography>
          </Box>
        ) : filteredWebinars.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <Avatar sx={{ mx: 'auto', mb: 2, width: 64, height: 64, bgcolor: colors.surfaceHover, color: colors.textMuted }}>
              <AccountBalanceWalletIcon sx={{ fontSize: 32 }} />
            </Avatar>
            <Typography variant="h6" sx={{ fontWeight: 700, color: colors.textPrimary }}>
              No Payment Records Found
            </Typography>
            <Typography variant="body2" sx={{ color: colors.textMuted, mt: 0.5 }}>
              {search ? 'Try adjusting your search query or filter.' : 'You have not registered for any webinars yet.'}
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table sx={{ minWidth: 850 }}>
                <TableHead sx={{ bgcolor: colors.surfaceHover }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: colors.textSecondary, fontSize: '12px', textTransform: 'uppercase' }}>
                      Webinar Details
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.textSecondary, fontSize: '12px', textTransform: 'uppercase' }}>
                      Speaker
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.textSecondary, fontSize: '12px', textTransform: 'uppercase' }}>
                      Date & Timing
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.textSecondary, fontSize: '12px', textTransform: 'uppercase', textAlign: 'center' }}>
                      Type
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.textSecondary, fontSize: '12px', textTransform: 'uppercase', textAlign: 'right' }}>
                      Amount Paid
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.textSecondary, fontSize: '12px', textTransform: 'uppercase', textAlign: 'center' }}>
                      Enrolled On
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.textSecondary, fontSize: '12px', textTransform: 'uppercase', textAlign: 'center' }}>
                      Status
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedWebinars.map((w) => (
                    <TableRow
                      key={w.webinarId}
                      hover
                      sx={{
                        '&:hover': { bgcolor: colors.surfaceHover },
                        borderBottom: `1px solid ${colors.border}`
                      }}
                    >
                      {/* Webinar Title & Category */}
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar
                            src={w.imageUrl}
                            variant="rounded"
                            sx={{ width: 44, height: 44, bgcolor: 'rgba(217, 119, 6, 0.1)', color: '#D97706', borderRadius: 2 }}
                          >
                            <VideoCameraFrontIcon sx={{ fontSize: 22 }} />
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colors.textPrimary, lineHeight: 1.3 }}>
                              {w.webinarName}
                            </Typography>
                            {w.categoryName && (
                              <Chip
                                label={w.categoryName}
                                size="small"
                                sx={{
                                  mt: 0.5,
                                  height: 20,
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  bgcolor: 'rgba(217, 119, 6, 0.08)',
                                  color: '#D97706',
                                  border: '1px solid rgba(217, 119, 6, 0.2)'
                                }}
                              />
                            )}
                          </Box>
                        </Box>
                      </TableCell>

                      {/* Speaker / Conductor */}
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PersonIcon sx={{ fontSize: 16, color: colors.textMuted }} />
                          <Typography variant="body2" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                            {w.conductorName || 'Instructor'}
                          </Typography>
                        </Box>
                      </TableCell>

                      {/* Date & Time */}
                      <TableCell>
                        <Typography variant="body2" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                          {formatUtcToLocalDateOnly(w.webinarDate)}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 0.3 }}>
                          <AccessTimeIcon sx={{ fontSize: 13, color: colors.textMuted }} />
                          <Typography variant="caption" sx={{ color: colors.textMuted, fontSize: '11.5px' }}>
                            {formatUtcToLocalTimeOnly(w.startTime)} – {formatUtcToLocalTimeOnly(w.endTime)} ({w.durationMinutes}m)
                          </Typography>
                        </Box>
                      </TableCell>

                      {/* Type (Paid vs Free) */}
                      <TableCell align="center">
                        <Chip
                          label={w.isPaid ? 'PAID' : 'FREE'}
                          size="small"
                          sx={{
                            fontWeight: 800,
                            fontSize: '11px',
                            letterSpacing: '0.5px',
                            bgcolor: w.isPaid ? 'rgba(2, 132, 199, 0.1)' : 'rgba(22, 163, 74, 0.1)',
                            color: w.isPaid ? '#0284C7' : '#16A34A',
                            border: `1px solid ${w.isPaid ? 'rgba(2, 132, 199, 0.3)' : 'rgba(22, 163, 74, 0.3)'}`
                          }}
                        />
                      </TableCell>

                      {/* Amount Paid */}
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 800,
                            fontSize: '14px',
                            color: w.isPaid ? colors.textPrimary : '#16A34A'
                          }}
                        >
                          {w.isPaid ? formatCurrency(w.amountPaid) : 'Free'}
                        </Typography>
                      </TableCell>

                      {/* Registration Date */}
                      <TableCell align="center">
                        <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 500 }}>
                          {formatUtcToLocalDateOnly(w.registeredAt)}
                        </Typography>
                      </TableCell>

                      {/* Status */}
                      <TableCell align="center">
                        <Chip
                          label={w.isCompleted ? 'Completed' : 'Upcoming'}
                          size="small"
                          sx={{
                            fontWeight: 700,
                            fontSize: '11px',
                            bgcolor: w.isCompleted ? 'rgba(22, 163, 74, 0.1)' : 'rgba(217, 119, 6, 0.1)',
                            color: w.isCompleted ? '#16A34A' : '#D97706',
                            border: `1px solid ${w.isCompleted ? 'rgba(22, 163, 74, 0.25)' : 'rgba(217, 119, 6, 0.25)'}`
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* ── Pagination ───────────────────────────────────────── */}
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end', borderTop: `1px solid ${colors.border}` }}>
              <CustomPagination
                page={page}
                totalPages={totalPages}
                onPageChange={(newPage) => setPage(newPage)}
              />
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
}

