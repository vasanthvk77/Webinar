import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Avatar,
  CircularProgress, Tooltip, IconButton, Card, CardContent,
  Grid, Button
} from '@mui/material';
import PaymentsIcon          from '@mui/icons-material/Payments';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import GroupsIcon            from '@mui/icons-material/Groups';
import VideoCameraFrontIcon  from '@mui/icons-material/VideoCameraFront';
import RefreshIcon           from '@mui/icons-material/Refresh';
import FileDownloadIcon      from '@mui/icons-material/FileDownload';
import CheckCircleIcon       from '@mui/icons-material/CheckCircle';
import AccessTimeIcon        from '@mui/icons-material/AccessTime';
import toast                 from 'react-hot-toast';

import { webinarService }    from '../../services/api';
import { useThemeColors, useAppTheme } from '../../context/ThemeContext';
import CustomSearchBar       from '../../components/CustomSearchBar';
import CustomPagination      from '../../components/CustomPagination';
import { formatUtcToLocalDateOnly, formatUtcToLocalTimeOnly } from '../../utils/validation';

// Helper: Format Currency (INR standard: ₹)
const formatCurrency = (amount) => {
  const num = Number(amount || 0);
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function Payments() {
  const colors = useThemeColors();
  const { isDark } = useAppTheme();

  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summaryData, setSummaryData] = useState({
    totalRevenue: 0,
    totalRegistrations: 0,
    totalPaidRegistrations: 0,
    totalWebinars: 0,
    totalPaidWebinars: 0,
    totalFreeWebinars: 0,
    webinars: []
  });
  const [search, setSearch]         = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'paid' | 'free'
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(10);

  // ── Load Payments via wms.GetPayments ─────────────────────────────
  const loadPayments = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await webinarService.getPayments();
      if (res.data?.success && res.data?.data) {
        setSummaryData(res.data.data);
      } else {
        toast.error(res.data?.message || 'Failed to load payments data');
      }
    } catch (err) {
      console.error('Failed to load payments data:', err);
      toast.error('Unable to fetch payments records');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // ── Search & Filter Logic ────────────────────────────────────────
  const filteredWebinars = useMemo(() => {
    let list = summaryData.webinars || [];

    if (filterType === 'paid') {
      list = list.filter((w) => w.isPaid);
    } else if (filterType === 'free') {
      list = list.filter((w) => !w.isPaid);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((w) =>
        (w.webinarName || '').toLowerCase().includes(q) ||
        (w.conductorName || '').toLowerCase().includes(q) ||
        (w.categoryName || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [summaryData.webinars, filterType, search]);

  // Total amount of currently filtered list
  const filteredTotalRevenue = useMemo(() => {
    return filteredWebinars.reduce((sum, w) => sum + (w.totalAmount || 0), 0);
  }, [filteredWebinars]);

  const filteredTotalRegistrations = useMemo(() => {
    return filteredWebinars.reduce((sum, w) => sum + (w.registrationCount || 0), 0);
  }, [filteredWebinars]);

  // Reset page when search or filter changes
  useEffect(() => {
    setPage(1);
  }, [search, filterType]);

  // ── Paginated Webinars ───────────────────────────────────────────
  const paginatedWebinars = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredWebinars.slice(start, start + pageSize);
  }, [filteredWebinars, page, pageSize]);

  // ── CSV Export ───────────────────────────────────────────────────
  const handleExportCSV = () => {
    if (filteredWebinars.length === 0) {
      toast.error('No payment records to export');
      return;
    }

    const headers = [
      'Webinar ID',
      'Webinar Name',
      'Category',
      'Conductor',
      'Date',
      'Start Time',
      'Type',
      'Fee Per Seat (INR)',
      'Registrations Count',
      'Capacity Limit',
      'Total Payment (INR)'
    ];

    const rows = filteredWebinars.map((w) => [
      w.webinarId,
      `"${(w.webinarName || '').replace(/"/g, '""')}"`,
      `"${(w.categoryName || 'General').replace(/"/g, '""')}"`,
      `"${(w.conductorName || '').replace(/"/g, '""')}"`,
      formatUtcToLocalDateOnly(w.webinarDate),
      formatUtcToLocalTimeOnly(w.startTime),
      w.isPaid ? 'Paid' : 'Free',
      w.price || 0,
      w.registrationCount || 0,
      w.participantLimit || 'Unlimited',
      w.totalAmount || 0
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Webinar_Payments_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Payments report exported successfully');
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1400, mx: 'auto' }}>
      {/* ── Top Header Bar ───────────────────────────────────────── */}
      <Box sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'flex-start', md: 'center' },
        gap: 2,
        mb: 3
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{
            bgcolor: 'rgba(217, 119, 6, 0.14)',
            color: '#D97706',
            width: 48,
            height: 48,
            boxShadow: '0 4px 12px rgba(217, 119, 6, 0.18)'
          }}>
            <PaymentsIcon sx={{ fontSize: 26 }} />
          </Avatar>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: colors.textPrimary, letterSpacing: '-0.02em' }}>
              Payments & Revenue
            </Typography>
            <Typography variant="body2" sx={{ color: colors.textMuted, fontSize: '13px' }}>
              Monitor student registration collections, fees per webinar, and overall earnings
            </Typography>
          </Box>
        </Box>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, alignSelf: { xs: 'stretch', sm: 'auto' } }}>
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
            disabled={loading || filteredWebinars.length === 0}
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

      {/* ── KPI Summary Cards ────────────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Total Revenue */}
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{
            border: `1px solid ${colors.border}`,
            borderRadius: 2.5,
            bgcolor: colors.surface,
            background: isDark
              ? 'linear-gradient(135deg, rgba(217, 119, 6, 0.12) 0%, rgba(17, 24, 39, 0.95) 100%)'
              : 'linear-gradient(135deg, #FFFBEB 0%, #FFFFFF 100%)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
          }}>
            <CardContent sx={{ p: 2.2, '&:last-child': { pb: 2.2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: '#D97706', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    Total Revenue
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 850, color: colors.textPrimary, mt: 0.5, letterSpacing: '-0.02em' }}>
                    {formatCurrency(summaryData.totalRevenue)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: colors.textMuted, fontSize: '11.5px', mt: 0.3, display: 'block' }}>
                    From {summaryData.totalPaidRegistrations} paid enrolments
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(217, 119, 6, 0.16)', color: '#D97706', width: 46, height: 46 }}>
                  <AccountBalanceWalletIcon sx={{ fontSize: 24 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Total Registrations */}
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ border: `1px solid ${colors.border}`, borderRadius: 2.5, bgcolor: colors.surface }}>
            <CardContent sx={{ p: 2.2, '&:last-child': { pb: 2.2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Total Registrations
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#0284C7', mt: 0.5 }}>
                    {summaryData.totalRegistrations}
                  </Typography>
                  <Typography variant="caption" sx={{ color: colors.textMuted, fontSize: '11.5px', mt: 0.3, display: 'block' }}>
                    Across all {summaryData.totalWebinars} sessions
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(2, 132, 199, 0.12)', color: '#0284C7', width: 44, height: 44 }}>
                  <GroupsIcon sx={{ fontSize: 22 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Paid Registrations */}
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ border: `1px solid ${colors.border}`, borderRadius: 2.5, bgcolor: colors.surface }}>
            <CardContent sx={{ p: 2.2, '&:last-child': { pb: 2.2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Paid Enrolments
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#10B981', mt: 0.5 }}>
                    {summaryData.totalPaidRegistrations}
                  </Typography>
                  <Typography variant="caption" sx={{ color: colors.textMuted, fontSize: '11.5px', mt: 0.3, display: 'block' }}>
                    {summaryData.totalRegistrations > 0
                      ? `${Math.round((summaryData.totalPaidRegistrations / summaryData.totalRegistrations) * 100)}% of total students`
                      : 'No enrolments yet'}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(16, 185, 129, 0.12)', color: '#10B981', width: 44, height: 44 }}>
                  <CheckCircleIcon sx={{ fontSize: 22 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Monetized Webinars */}
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ border: `1px solid ${colors.border}`, borderRadius: 2.5, bgcolor: colors.surface }}>
            <CardContent sx={{ p: 2.2, '&:last-child': { pb: 2.2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Paid Webinars
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#8B5CF6', mt: 0.5 }}>
                    {summaryData.totalPaidWebinars} <Typography component="span" sx={{ fontSize: '14px', fontWeight: 600, color: colors.textMuted }}>/ {summaryData.totalWebinars}</Typography>
                  </Typography>
                  <Typography variant="caption" sx={{ color: colors.textMuted, fontSize: '11.5px', mt: 0.3, display: 'block' }}>
                    {summaryData.totalFreeWebinars} free webinar sessions
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(139, 92, 246, 0.12)', color: '#8B5CF6', width: 44, height: 44 }}>
                  <VideoCameraFrontIcon sx={{ fontSize: 22 }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Search & Filter Controls ─────────────────────────────── */}
      <Paper elevation={0} sx={{
        p: 2,
        mb: 2.5,
        borderRadius: 2.5,
        border: `1px solid ${colors.border}`,
        bgcolor: colors.surface,
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2
      }}>
        {/* Custom Search Bar */}
        <Box sx={{ width: { xs: '100%', sm: 360 } }}>
          <CustomSearchBar
            value={search}
            onChange={(val) => setSearch(val)}
            placeholder="Search by webinar, conductor, or category..."
          />
        </Box>

        {/* Filter Pills */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' } }}>
          {[
            { key: 'all', label: `All (${summaryData.totalWebinars})` },
            { key: 'paid', label: `Paid Only (${summaryData.totalPaidWebinars})` },
            { key: 'free', label: `Free Only (${summaryData.totalFreeWebinars})` }
          ].map((pill) => {
            const active = filterType === pill.key;
            return (
              <Chip
                key={pill.key}
                label={pill.label}
                onClick={() => setFilterType(pill.key)}
                clickable
                sx={{
                  fontWeight: active ? 750 : 600,
                  fontSize: '12.5px',
                  bgcolor: active ? '#D97706' : colors.surfaceHover,
                  color: active ? '#FFFFFF' : colors.textSecondary,
                  border: `1px solid ${active ? '#D97706' : colors.border}`,
                  '&:hover': {
                    bgcolor: active ? '#B45309' : colors.surfaceHover
                  }
                }}
              />
            );
          })}
        </Box>
      </Paper>

      {/* ── Payments Data Table ───────────────────────────────────── */}
      <Paper elevation={0} sx={{
        borderRadius: 2.5,
        border: `1px solid ${colors.border}`,
        bgcolor: colors.surface,
        overflow: 'hidden'
      }}>
        <TableContainer>
          <Table sx={{ minWidth: 800 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC' }}>
                <TableCell sx={{ fontWeight: 800, fontSize: '12.5px', color: colors.textSecondary, py: 1.8 }}>
                  WEBINAR DETAILS
                </TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '12.5px', color: colors.textSecondary, py: 1.8 }}>
                  SCHEDULE & SPEAKER
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 800, fontSize: '12.5px', color: colors.textSecondary, py: 1.8 }}>
                  TYPE / TICKET FEE
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 800, fontSize: '12.5px', color: colors.textSecondary, py: 1.8 }}>
                  REGISTRATIONS
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, fontSize: '12.5px', color: colors.textSecondary, py: 1.8 }}>
                  TOTAL PAYMENT
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                    <CircularProgress size={36} sx={{ color: '#D97706' }} />
                    <Typography variant="body2" sx={{ color: colors.textMuted, mt: 1.5, fontWeight: 600 }}>
                      Loading webinar payment records...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : filteredWebinars.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                    <Box sx={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      bgcolor: colors.surfaceHover,
                      display: 'grid',
                      placeItems: 'center',
                      mx: 'auto',
                      mb: 1.5,
                      color: colors.textMuted
                    }}>
                      <PaymentsIcon sx={{ fontSize: 28 }} />
                    </Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 750, color: colors.textPrimary }}>
                      No payment records found
                    </Typography>
                    <Typography variant="body2" sx={{ color: colors.textMuted, mt: 0.5, fontSize: '13px' }}>
                      {search ? 'Try adjusting your search or filter criteria' : 'No webinar sessions have been created yet'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedWebinars.map((w) => {
                  const isPaid = Boolean(w.isPaid);
                  const price = Number(w.price || 0);
                  const regCount = Number(w.registrationCount || 0);
                  const total = Number(w.totalAmount || 0);
                  const limit = w.participantLimit;

                  return (
                    <TableRow
                      key={w.webinarId}
                      hover
                      sx={{
                        transition: 'background-color 0.15s ease',
                        '&:last-child td, &:last-child th': { border: 0 },
                        '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(217, 119, 6, 0.03)' }
                      }}
                    >
                      {/* Webinar Details */}
                      <TableCell sx={{ py: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.8 }}>
                          <Avatar
                            src={w.imageUrl}
                            variant="rounded"
                            sx={{
                              width: 46,
                              height: 46,
                              borderRadius: 2,
                              bgcolor: isPaid ? 'rgba(217, 119, 6, 0.12)' : colors.surfaceHover,
                              color: isPaid ? '#D97706' : colors.textSecondary,
                              fontWeight: 800,
                              fontSize: '14px',
                              border: `1px solid ${colors.border}`
                            }}
                          >
                            {(w.webinarName || 'W').charAt(0).toUpperCase()}
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 750, fontSize: '14px', color: colors.textPrimary, lineHeight: 1.3 }}>
                              {w.webinarName}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                              <Chip
                                size="small"
                                label={w.categoryName || 'General'}
                                sx={{
                                  height: 20,
                                  fontSize: '11px',
                                  fontWeight: 650,
                                  bgcolor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                                  color: colors.textSecondary
                                }}
                              />
                              {w.isCompleted && (
                                <Chip
                                  size="small"
                                  label="Ended"
                                  sx={{
                                    height: 20,
                                    fontSize: '10.5px',
                                    fontWeight: 700,
                                    bgcolor: 'rgba(100, 116, 139, 0.1)',
                                    color: '#64748B'
                                  }}
                                />
                              )}
                            </Box>
                          </Box>
                        </Box>
                      </TableCell>

                      {/* Schedule & Speaker */}
                      <TableCell sx={{ py: 2 }}>
                        <Typography sx={{ fontWeight: 650, fontSize: '13px', color: colors.textPrimary }}>
                          {formatUtcToLocalDateOnly(w.webinarDate)}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 0.3 }}>
                          <AccessTimeIcon sx={{ fontSize: 13, color: colors.textMuted }} />
                          <Typography sx={{ fontSize: '12px', color: colors.textMuted }}>
                            {formatUtcToLocalTimeOnly(w.startTime)} ({w.durationMinutes || 60}m)
                          </Typography>
                        </Box>
                        {w.conductorName && (
                          <Typography sx={{ fontSize: '12px', color: colors.textSecondary, mt: 0.3, fontWeight: 550 }}>
                            By {w.conductorName}
                          </Typography>
                        )}
                      </TableCell>

                      {/* Type / Fee */}
                      <TableCell align="center" sx={{ py: 2 }}>
                        {isPaid ? (
                          <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Chip
                              label={`Paid · ${formatCurrency(price)}`}
                              size="small"
                              sx={{
                                bgcolor: isDark ? 'rgba(217, 119, 6, 0.16)' : '#FEF3C7',
                                color: '#D97706',
                                fontWeight: 800,
                                fontSize: '12px',
                                border: '1px solid rgba(217, 119, 6, 0.28)'
                              }}
                            />
                            <Typography variant="caption" sx={{ color: colors.textMuted, fontSize: '11px', mt: 0.4 }}>
                              per seat
                            </Typography>
                          </Box>
                        ) : (
                          <Chip
                            label="Free Session"
                            size="small"
                            sx={{
                              bgcolor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                              color: colors.textSecondary,
                              fontWeight: 700,
                              fontSize: '11.5px'
                            }}
                          />
                        )}
                      </TableCell>

                      {/* Registrations */}
                      <TableCell align="center" sx={{ py: 2 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: '15px', color: regCount > 0 ? colors.textPrimary : colors.textMuted }}>
                          {regCount}
                        </Typography>
                        <Typography variant="caption" sx={{ color: colors.textMuted, fontSize: '11.5px' }}>
                          {limit && limit > 0 ? `of ${limit} limit` : 'registered'}
                        </Typography>
                      </TableCell>

                      {/* Total Amount (Count * Price) */}
                      <TableCell align="right" sx={{ py: 2 }}>
                        <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <Typography sx={{
                            fontWeight: 850,
                            fontSize: '16px',
                            color: total > 0 ? (isDark ? '#34D399' : '#059669') : colors.textMuted,
                            letterSpacing: '-0.01em'
                          }}>
                            {formatCurrency(total)}
                          </Typography>
                          {isPaid && regCount > 0 && (
                            <Typography variant="caption" sx={{ color: colors.textMuted, fontSize: '11px' }}>
                              {regCount} × {formatCurrency(price)}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* ── Table Pagination ── */}
        {!loading && filteredWebinars.length > 0 && (
          <CustomPagination
            totalItems={filteredWebinars.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 20, 30, 50, 100]}
          />
        )}

        {/* ── Table Bottom Grand Total Footer ────────────────────────── */}
        {!loading && filteredWebinars.length > 0 && (
          <Box sx={{
            px: 3,
            py: 2.2,
            borderTop: `2px dashed ${colors.border}`,
            bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#F8FAFC',
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            gap: 1.5
          }}>
            <Box>
              <Typography sx={{ fontSize: '13px', fontWeight: 700, color: colors.textSecondary }}>
                Showing {filteredWebinars.length} {filterType !== 'all' ? `${filterType} ` : ''}webinars
              </Typography>
              <Typography variant="caption" sx={{ color: colors.textMuted }}>
                Total Enrolments: <b>{filteredTotalRegistrations}</b> students
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography sx={{ fontSize: '14px', fontWeight: 750, color: colors.textSecondary }}>
                {filterType === 'all' ? 'Grand Total Payment:' : 'Filtered Total Payment:'}
              </Typography>
              <Typography sx={{
                fontSize: '20px',
                fontWeight: 900,
                color: '#D97706',
                letterSpacing: '-0.02em',
                bgcolor: isDark ? 'rgba(217, 119, 6, 0.15)' : '#FEF3C7',
                px: 2,
                py: 0.6,
                borderRadius: 2,
                border: '1px solid rgba(217, 119, 6, 0.3)'
              }}>
                {formatCurrency(filteredTotalRevenue)}
              </Typography>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
}

