import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Avatar, Collapse,
  IconButton, Tooltip, CircularProgress, Select, MenuItem,
  FormControl, Pagination, Divider,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import ManageSearchIcon       from '@mui/icons-material/ManageSearch';
import FilterListIcon         from '@mui/icons-material/FilterList';
import RestartAltIcon         from '@mui/icons-material/RestartAlt';
import HistoryIcon            from '@mui/icons-material/History';
import { activityLogService } from '../../services/api';
import { useThemeColors }     from '../../context/ThemeContext';
import CustomSearchBar        from '../../components/CustomSearchBar';

// ── Helpers ────────────────────────────────────────────────────────────────

// Map action names to colour schemes
const ACTION_COLOUR = {
  CREATE:  { bg: 'rgba(34,197,94,0.14)',  text: '#16A34A', border: 'rgba(34,197,94,0.35)'  },
  LOGIN:   { bg: 'rgba(59,130,246,0.14)', text: '#2563EB', border: 'rgba(59,130,246,0.35)' },
  LOGOUT:  { bg: 'rgba(148,163,184,0.14)',text: '#64748B', border: 'rgba(148,163,184,0.35)'},
  UPDATE:  { bg: 'rgba(234,179,8,0.14)',  text: '#CA8A04', border: 'rgba(234,179,8,0.35)'  },
  DELETE:  { bg: 'rgba(239,68,68,0.14)',  text: '#DC2626', border: 'rgba(239,68,68,0.35)'  },
  REVOKE:  { bg: 'rgba(239,68,68,0.14)',  text: '#DC2626', border: 'rgba(239,68,68,0.35)'  },
  GRANT:   { bg: 'rgba(34,197,94,0.14)',  text: '#16A34A', border: 'rgba(34,197,94,0.35)'  },
  READ:    { bg: 'rgba(99,102,241,0.14)', text: '#4F46E5', border: 'rgba(99,102,241,0.35)' },
  BLOCKED: { bg: 'rgba(239,68,68,0.14)',  text: '#DC2626', border: 'rgba(239,68,68,0.35)'  },
};

function actionStyle(name) {
  return ACTION_COLOUR[name?.toUpperCase()] ?? { bg: 'rgba(148,163,184,0.14)', text: '#64748B', border: 'rgba(148,163,184,0.35)' };
}

// Parse Changes JSON into an array of { field, before, after }
function parseChanges(changesJson) {
  if (!changesJson) return null;
  try {
    const parsed = JSON.parse(changesJson);
    if (!parsed || typeof parsed !== 'object') return null;
    if (Array.isArray(parsed)) return parsed;
    return Object.entries(parsed).map(([field, val]) => ({
      field,
      before: typeof val === 'object' ? (val.old ?? val.before ?? val.from ?? '-') : val,
      after:  typeof val === 'object' ? (val.new ?? val.after  ?? val.to   ?? '-') : val,
    }));
  } catch {
    return null;
  }
}

function initials(name = '') {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_PALETTES = [
  '#6366F1','#8B5CF6','#EC4899','#EF4444',
  '#F97316','#EAB308','#22C55E','#06B6D4','#3B82F6','#14B8A6',
];
function avatarBg(id) { return AVATAR_PALETTES[id % AVATAR_PALETTES.length]; }

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    year:'numeric', month:'short', day:'2-digit',
    hour:'2-digit', minute:'2-digit', second:'2-digit',
  });
}

// ── Changes Diff Table ─────────────────────────────────────────────────────

function ChangesDiff({ changesJson, colors }) {
  const rows = parseChanges(changesJson);
  if (!rows || rows.length === 0) return null;

  return (
    <Box sx={{ mt: 1.5, borderRadius: 2, overflow: 'hidden', border: `1px solid ${colors.border}` }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', px: 2, py: 0.75, backgroundColor: colors.panelHeader, gap: 1 }}>
        {['Field / Property', 'Before', 'After'].map((h) => (
          <Typography key={h} sx={{ fontSize: 11, fontWeight: 700, color: colors.panelHeaderText, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            {h}
          </Typography>
        ))}
      </Box>
      {rows.map((row, idx) => (
        <Box key={idx} sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', px: 2, py: 1, gap: 1,
          borderTop: idx > 0 ? `1px solid ${colors.border}` : 'none',
          backgroundColor: idx % 2 === 0 ? colors.surface : colors.surfaceAlt, alignItems: 'flex-start' }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary }}>
            {String(row.field ?? '—')}
          </Typography>
          <Typography sx={{ fontSize: 12, color: colors.error, px: 1, py: 0.25, borderRadius: 1,
            backgroundColor: 'rgba(239,68,68,0.08)', wordBreak: 'break-word', fontFamily: 'monospace' }}>
            {String(row.before ?? '—')}
          </Typography>
          <Typography sx={{ fontSize: 12, color: colors.success, px: 1, py: 0.25, borderRadius: 1,
            backgroundColor: 'rgba(34,197,94,0.08)', wordBreak: 'break-word', fontFamily: 'monospace' }}>
            {String(row.after ?? '—')}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

// ── Single Expandable Row ──────────────────────────────────────────────────

function LogRow({ log, colors }) {
  const [open, setOpen] = useState(false);
  const hasChanges = !!log.changes;
  const style = actionStyle(log.actionName);

  return (
    <>
      <TableRow hover sx={{ cursor: hasChanges ? 'pointer' : 'default', transition: 'background 0.15s',
        '&:hover': { backgroundColor: colors.surfaceAlt }, '& td': { borderBottom: `1px solid ${colors.border}` } }}
        onClick={() => hasChanges && setOpen((p) => !p)}>

        <TableCell sx={{ width: 42, py: 1.25, px: 1 }}>
          {hasChanges ? (
            <Tooltip title={open ? 'Hide changes' : 'View changes'} arrow>
              <IconButton size="small" sx={{ color: colors.textMuted }}>
                {open ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          ) : <Box sx={{ width: 28 }} />}
        </TableCell>

        <TableCell sx={{ py: 1.25, minWidth: 160 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Avatar sx={{ width: 34, height: 34, fontSize: 12, fontWeight: 700, backgroundColor: avatarBg(log.actorId), flexShrink: 0 }}>
              {initials(log.actorName)}
            </Avatar>
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary, lineHeight: 1.25 }}>
                {log.actorName || '—'}
              </Typography>
              <Typography sx={{ fontSize: 11, color: colors.textMuted }}>{log.actorRoleName || '—'}</Typography>
            </Box>
          </Box>
        </TableCell>

        <TableCell sx={{ py: 1.25, width: 110 }}>
          <Chip label={log.actionName || '—'} size="small"
            sx={{ fontSize: 11, fontWeight: 700, backgroundColor: style.bg, color: style.text,
              border: `1px solid ${style.border}`, borderRadius: '6px', height: 22 }} />
        </TableCell>

        <TableCell sx={{ py: 1.25, width: 140 }}>
          <Chip label={log.moduleName || '—'} size="small" variant="outlined"
            sx={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary, borderColor: colors.borderMid, borderRadius: '6px', height: 22 }} />
        </TableCell>

        <TableCell sx={{ py: 1.25 }}>
          <Typography sx={{ fontSize: 12.5, color: colors.textPrimary, lineHeight: 1.5 }}>
            {log.description || '—'}
          </Typography>
        </TableCell>

        <TableCell sx={{ py: 1.25, width: 160, whiteSpace: 'nowrap' }}>
          <Typography sx={{ fontSize: 12, color: colors.textSecondary }}>{fmtDate(log.createdAt)}</Typography>
        </TableCell>
      </TableRow>

      {hasChanges && (
        <TableRow sx={{ '& td': { p: 0, border: 0 } }}>
          <TableCell colSpan={6}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box sx={{ px: 3, pb: 2, pt: 0.5, backgroundColor: colors.surfaceAlt }}>
                <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: colors.textSecondary, mb: 0.75, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Change Details
                </Typography>
                <ChangesDiff changesJson={log.changes} colors={colors} />
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

export default function ActivityLogs() {
  const colors = useThemeColors();

  const [modules, setModules] = useState([]);
  const [actions, setActions] = useState([]);

  const [search,    setSearch]    = useState('');
  const [moduleId,  setModuleId]  = useState('');
  const [actionId,  setActionId]  = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate,   setEndDate]   = useState('');
  const [pageSize,  setPageSize]  = useState(DEFAULT_PAGE_SIZE);

  const [applied, setApplied] = useState({ search:'', moduleId:'', actionId:'', startDate:'', endDate:'' });

  const [logs,       setLogs]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);

  // Load lookups once
  useEffect(() => {
    activityLogService.getLookups()
      .then((res) => {
        if (res.data?.success) {
          setModules(res.data.data.modules ?? []);
          setActions(res.data.data.actions ?? []);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch logs
  const fetchLogs = useCallback(async (params) => {
    setLoading(true);
    try {
      const qp = {
        pageNumber: params.pageNumber ?? 1,
        pageSize:   params.pageSize   ?? DEFAULT_PAGE_SIZE,
        ...(params.search    && { searchQuery: params.search }),
        ...(params.moduleId  && { moduleId:    params.moduleId }),
        ...(params.actionId  && { actionId:    params.actionId }),
        ...(params.startDate && { startDate:   params.startDate }),
        ...(params.endDate   && { endDate:     params.endDate }),
      };
      const res = await activityLogService.getLogs(qp);
      if (res.data?.success) {
        const data = res.data.data;
        if (Array.isArray(data)) {
          setLogs(data); setTotalCount(data.length);
        } else {
          setLogs(data.items ?? []); setTotalCount(data.totalCount ?? (data.items?.length ?? 0));
        }
      }
    } catch { setLogs([]); setTotalCount(0); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLogs({ ...applied, pageNumber, pageSize }); }, [applied, pageNumber, pageSize, fetchLogs]);

  function applyFilters() { setPageNumber(1); setApplied({ search, moduleId, actionId, startDate, endDate }); }

  function resetFilters() {
    setSearch(''); setModuleId(''); setActionId(''); setStartDate(''); setEndDate('');
    setPageNumber(1);
    setApplied({ search:'', moduleId:'', actionId:'', startDate:'', endDate:'' });
  }

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / pageSize)), [totalCount, pageSize]);
  const activeFilterCount = [applied.search, applied.moduleId, applied.actionId, applied.startDate, applied.endDate].filter(Boolean).length;

  const selectSx = {
    height: 38, fontSize: 13,
    backgroundColor: colors.surfaceAlt,
    color: colors.textPrimary,
    '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.border },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: colors.primaryMuted },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: colors.accent },
    '& .MuiSvgIcon-root': { color: colors.textMuted },
  };

  const labelSx = { fontSize: 12, color: colors.textSecondary };

  const inputStyle = {
    height: '38px',
    paddingLeft: '12px', paddingRight: '8px',
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
    backgroundColor: colors.surfaceAlt,
    color: colors.textPrimary,
    fontSize: '13px',
    outline: 'none',
    fontFamily: '"Inter", sans-serif',
    cursor: 'pointer',
    width: '100%',
    boxSizing: 'border-box',
    colorScheme: colors.bg === '#F8FAFC' ? 'light' : 'dark',
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, minHeight: '100vh', backgroundColor: colors.bg }}>

      {/* Page Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Box sx={{ width: 42, height: 42, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryLight})` }}>
          <HistoryIcon sx={{ color: colors.textOnDark, fontSize: 22 }} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: colors.textPrimary, lineHeight: 1.2, fontSize: 18 }}>
            Activity Logs
          </Typography>
          <Typography sx={{ fontSize: 12, color: colors.textMuted }}>
            System-wide audit trail — every action captured
          </Typography>
        </Box>
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors.success,
            animation: 'pulse 2s infinite',
            '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
          <Typography sx={{ fontSize: 11, color: colors.textMuted }}>Live</Typography>
        </Box>
      </Box>

      {/* Filter Panel */}
      <Paper elevation={0} sx={{ mb: 2.5, p: 2, border: `1px solid ${colors.border}`, borderRadius: 2, backgroundColor: colors.surface }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, gap: 1 }}>
          <FilterListIcon sx={{ fontSize: 16, color: colors.textMuted }} />
          <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: colors.textSecondary }}>Filters</Typography>
          {activeFilterCount > 0 && (
            <Chip label={`${activeFilterCount} active`} size="small"
              sx={{ fontSize: 10, height: 18, fontWeight: 700, backgroundColor: colors.accentMuted, color: colors.accent, borderRadius: '6px' }} />
          )}
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '2fr 1fr 1fr 1fr 1fr' }, gap: 1.5, alignItems: 'end' }}>
          <Box>
            <Typography sx={{ ...labelSx, mb: 0.5 }}>Search</Typography>
            <CustomSearchBar value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Actor name, description…" sx={{ height: 38 }} />
          </Box>

          <Box>
            <Typography sx={{ ...labelSx, mb: 0.5 }}>Module</Typography>
            <FormControl fullWidth size="small">
              <Select value={moduleId} onChange={(e) => setModuleId(e.target.value)} displayEmpty sx={selectSx}>
                <MenuItem value=""><em style={{ color: colors.textMuted, fontStyle: 'normal', fontSize: 13 }}>All Modules</em></MenuItem>
                {modules.map((m) => <MenuItem key={m.id} value={m.id} sx={{ fontSize: 13 }}>{m.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>

          <Box>
            <Typography sx={{ ...labelSx, mb: 0.5 }}>Action</Typography>
            <FormControl fullWidth size="small">
              <Select value={actionId} onChange={(e) => setActionId(e.target.value)} displayEmpty sx={selectSx}>
                <MenuItem value=""><em style={{ color: colors.textMuted, fontStyle: 'normal', fontSize: 13 }}>All Actions</em></MenuItem>
                {actions.map((a) => <MenuItem key={a.id} value={a.id} sx={{ fontSize: 13 }}>{a.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>

          <Box>
            <Typography sx={{ ...labelSx, mb: 0.5 }}>From</Typography>
            <input id="al-date-from" type="date" value={startDate} max={endDate || undefined}
              onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
          </Box>

          <Box>
            <Typography sx={{ ...labelSx, mb: 0.5 }}>To</Typography>
            <input id="al-date-to" type="date" value={endDate} min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mt: 1.75, justifyContent: 'flex-end' }}>
          <Box component="button" id="al-reset-btn" onClick={resetFilters}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 2, py: 0.75, borderRadius: 1.5,
              fontSize: 12.5, fontWeight: 600, border: `1px solid ${colors.border}`,
              backgroundColor: colors.surfaceAlt, color: colors.textSecondary, cursor: 'pointer',
              transition: 'all 0.15s', '&:hover': { backgroundColor: colors.border, color: colors.textPrimary } }}>
            <RestartAltIcon sx={{ fontSize: 15 }} /> Reset
          </Box>
          <Box component="button" id="al-apply-btn" onClick={applyFilters}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 2.5, py: 0.75, borderRadius: 1.5,
              fontSize: 12.5, fontWeight: 700, border: 'none', backgroundColor: colors.primary,
              color: colors.textOnDark, cursor: 'pointer', transition: 'all 0.15s',
              '&:hover': { backgroundColor: colors.primaryLight } }}>
            <ManageSearchIcon sx={{ fontSize: 15 }} /> Apply
          </Box>
        </Box>
      </Paper>

      {/* Table Panel */}
      <Paper elevation={0} sx={{ border: `1px solid ${colors.border}`, borderRadius: 2, overflow: 'hidden', backgroundColor: colors.surface }}>
        {/* Panel header */}
        <Box sx={{ px: 2.5, py: 1.5, backgroundColor: colors.panelHeader, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: colors.panelHeaderText }}>
            {loading ? 'Loading…' : `${totalCount.toLocaleString()} record${totalCount !== 1 ? 's' : ''}`}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: 12, color: colors.panelHeaderText, opacity: 0.7 }}>Rows:</Typography>
            <Select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPageNumber(1); }} size="small"
              sx={{ height: 28, fontSize: 12, color: colors.panelHeaderText,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                '& .MuiSvgIcon-root': { color: colors.panelHeaderText },
                '& .MuiSelect-select': { py: '2px' } }}>
              {PAGE_SIZE_OPTIONS.map((s) => <MenuItem key={s} value={s} sx={{ fontSize: 12 }}>{s}</MenuItem>)}
            </Select>
          </Box>
        </Box>

        <TableContainer>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {['', 'Actor', 'Action', 'Module', 'Description', 'Date & Time'].map((h, i) => (
                  <TableCell key={i} sx={{ backgroundColor: colors.surfaceAlt, color: colors.textSecondary,
                    fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase',
                    borderBottom: `2px solid ${colors.border}`, py: 1.25, px: i === 0 ? 1 : 2 }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ textAlign: 'center', py: 6 }}>
                    <CircularProgress size={28} sx={{ color: colors.accent }} />
                    <Typography sx={{ mt: 1.5, fontSize: 13, color: colors.textMuted }}>Loading activity logs…</Typography>
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ textAlign: 'center', py: 6 }}>
                    <ManageSearchIcon sx={{ fontSize: 40, color: colors.textMuted, mb: 1 }} />
                    <Typography sx={{ fontSize: 14, color: colors.textMuted }}>
                      No activity logs found for the selected filters.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => <LogRow key={log.id} log={log} colors={colors} />)
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination Footer */}
        {!loading && logs.length > 0 && (
          <>
            <Divider sx={{ borderColor: colors.border }} />
            <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
              <Typography sx={{ fontSize: 12, color: colors.textMuted }}>
                Page {pageNumber} of {totalPages}
              </Typography>
              <Pagination count={totalPages} page={pageNumber} onChange={(_, val) => setPageNumber(val)}
                size="small" shape="rounded" showFirstButton showLastButton
                sx={{ '& .MuiPaginationItem-root': { color: colors.textSecondary, border: `1px solid ${colors.border}`, fontSize: 12,
                  '&.Mui-selected': { backgroundColor: colors.primary, color: colors.textOnDark, borderColor: colors.primary,
                    '&:hover': { backgroundColor: colors.primaryLight } },
                  '&:hover': { backgroundColor: colors.surfaceAlt } } }} />
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
}
