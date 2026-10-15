import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Tooltip,
  Dialog, DialogContent, DialogActions, TextField, MenuItem,
  CircularProgress, Divider, Menu, ListItemIcon, Switch,
  FormControlLabel, Chip, InputAdornment,
} from '@mui/material';
import AddIcon           from '@mui/icons-material/Add';
import DeleteIcon        from '@mui/icons-material/Delete';
import EditIcon          from '@mui/icons-material/Edit';
import CloseIcon         from '@mui/icons-material/Close';
import MoreVertIcon      from '@mui/icons-material/MoreVert';
import VideoCallIcon     from '@mui/icons-material/VideoCall';
import TimerIcon         from '@mui/icons-material/Timer';
import CurrencyRupeeIcon from '@mui/icons-material/CurrencyRupee';
import toast             from 'react-hot-toast';
import { webinarService, categoryService } from '../../services/api';
import { useAuth }          from '../../context/AuthContext';
import { useThemeColors }   from '../../context/ThemeContext';
import CustomSearchBar      from '../../components/CustomSearchBar';
import CustomTimePicker     from '../../components/CustomeTimePicker';
import CustomDatePicker     from '../../components/CustomeDatePicker';

const EMPTY_FORM = {
  webinarName:      '',
  categoryId:       '',
  webinarDate:      '',
  startTime:        '',   // "HH:mm"
  endTime:          '',   // "HH:mm"
  conductorName:    '',
  conductorPhone:   '',
  conductorEmail:   '',
  participantLimit: '',
  isPaid:           false,
  price:            '',
};

// ── Calculate duration in minutes from "HH:mm" strings ──
const calcDuration = (start, end) => {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff > 0 ? diff : null;
};

// ── Format duration nicely ───────────────────────────────
const fmtDuration = (mins) => {
  if (!mins || mins <= 0) return '—';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

export default function Webinars() {
  const colors           = useThemeColors();
  const { isSuperAdmin } = useAuth();

  const [webinars,   setWebinars]   = useState([]);
  const [filtered,   setFiltered]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');

  const [modal,     setModal]     = useState(null);
  const [target,    setTarget]    = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  const [menu, setMenu] = useState(null);

  // Live-calculated duration shown in the read-only field
  const calculatedDuration = useMemo(
    () => calcDuration(form.startTime, form.endTime),
    [form.startTime, form.endTime]
  );

  // ── Load ─────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [wRes, cRes] = await Promise.all([
        webinarService.getAll(),
        categoryService.getAll(),
      ]);
      if (wRes.data.success) { setWebinars(wRes.data.data); setFiltered(wRes.data.data); }
      if (cRes.data.success)   setCategories(cRes.data.data);
    } catch {
      toast.error('Failed to load webinars');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Search ───────────────────────────────────────────
  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q ? webinars.filter(w =>
            w.webinarName.toLowerCase().includes(q) ||
            w.categoryName.toLowerCase().includes(q) ||
            w.conductorName.toLowerCase().includes(q))
        : webinars
    );
  }, [search, webinars]);

  // ── Menu ─────────────────────────────────────────────
  const openMenu  = (e, row) => setMenu({ anchorEl: e.currentTarget, row });
  const closeMenu = ()       => setMenu(null);

  // ── Helpers ───────────────────────────────────────────
  const setField = (key, val) => { setForm(p => ({ ...p, [key]: val })); setFormError(''); };

  const toISOLocal = (d) => d ? new Date(d).toLocaleDateString() : '—';

  const fmtTime = (d) => d
    ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
    : '—';

  // Extract "HH:mm" from a stored datetime string
  const toTimeOnly = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toTimeString().slice(0, 5); // "HH:mm"
  };

  const toInputDate = (d) => {
    if (!d) return '';
    return new Date(d).toISOString().slice(0, 10);
  };

  // ── Modals ───────────────────────────────────────────
  const openCreate = () => {
    setForm(EMPTY_FORM); setFormError(''); setModal('create');
  };

  const openEdit = (row) => {
    setTarget(row);
    setForm({
      webinarName:      row.webinarName,
      categoryId:       String(row.categoryId),
      webinarDate:      toInputDate(row.webinarDate),
      startTime:        toTimeOnly(row.startTime),
      endTime:          toTimeOnly(row.endTime),
      conductorName:    row.conductorName,
      conductorPhone:   row.conductorPhone ?? '',
      conductorEmail:   row.conductorEmail ?? '',
      participantLimit: String(row.participantLimit),
      isPaid:           row.isPaid,
      price:            row.price != null ? String(row.price) : '',
    });
    setFormError('');
    setModal('edit');
  };

  const openDelete = (row) => { setTarget(row); setModal('delete'); };
  const closeModal = ()    => { setModal(null); setTarget(null); setSaving(false); };

  // ── Validate & build payload ──────────────────────────
  const buildPayload = () => {
    if (!form.webinarName.trim())   return { err: 'Webinar name is required' };
    if (!form.categoryId)           return { err: 'Category is required' };
    if (!form.webinarDate)          return { err: 'Webinar date is required' };
    if (!form.startTime)            return { err: 'Start time is required' };
    if (!form.endTime)              return { err: 'End time is required' };

    const duration = calcDuration(form.startTime, form.endTime);
    if (!duration || duration <= 0) return { err: 'End time must be after start time' };

    if (!form.conductorName.trim()) return { err: 'Conductor name is required' };
    if (!form.participantLimit || Number(form.participantLimit) <= 0)
                                    return { err: 'Participant limit must be greater than 0' };
    if (form.isPaid && (!form.price || Number(form.price) <= 0))
                                    return { err: 'Price must be greater than 0 for paid webinars' };

    // Combine WebinarDate + time-only strings into full datetime strings for backend
    const startDateTime = `${form.webinarDate}T${form.startTime}:00`;
    const endDateTime   = `${form.webinarDate}T${form.endTime}:00`;

    return {
      payload: {
        webinarName:      form.webinarName.trim(),
        categoryId:       Number(form.categoryId),
        durationMinutes:  duration,
        webinarDate:      form.webinarDate,
        startTime:        startDateTime,
        endTime:          endDateTime,
        conductorName:    form.conductorName.trim(),
        conductorPhone:   form.conductorPhone.trim() || null,
        conductorEmail:   form.conductorEmail.trim() || null,
        participantLimit: Number(form.participantLimit),
        isPaid:           form.isPaid,
        price:            form.isPaid ? Number(form.price) : null,
      }
    };
  };

  // ── Create ───────────────────────────────────────────
  const handleCreate = async () => {
    setFormError('');
    const { err, payload } = buildPayload();
    if (err) return setFormError(err);
    setSaving(true);
    try {
      const res = await webinarService.create(payload);
      if (res.data.success) { toast.success('Webinar created'); closeModal(); load(); }
      else {
        const errorMsg = res.data.message || 'Creation failed';
        setFormError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (e) {
      const errorMsg = e.response?.data?.message || e.message || 'An error occurred';
      setFormError(errorMsg);
      toast.error(errorMsg);
    } finally { setSaving(false); }
  };

  // ── Update ───────────────────────────────────────────
  const handleEdit = async () => {
    setFormError('');
    const { err, payload } = buildPayload();
    if (err) return setFormError(err);
    setSaving(true);
    try {
      const res = await webinarService.update(target.id, payload);
      if (res.data.success) { toast.success('Webinar updated'); closeModal(); load(); }
      else {
        const errorMsg = res.data.message || 'Update failed';
        setFormError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (e) {
      const errorMsg = e.response?.data?.message || e.message || 'An error occurred';
      setFormError(errorMsg);
      toast.error(errorMsg);
    } finally { setSaving(false); }
  };

  // ── Delete ────────────────────────────────────────────
  const handleDelete = async () => {
    setSaving(true);
    try {
      const res = await webinarService.delete(target.id);
      if (res.data.success) { toast.success('Webinar deleted'); closeModal(); load(); }
      else toast.error(res.data.message || 'Delete failed');
    } catch { toast.error('Failed to delete webinar');
    } finally { setSaving(false); }
  };

  // ── Shared styles ─────────────────────────────────────
  const inputSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: colors.surfaceAlt,
      '& fieldset': { borderColor: colors.border },
      '&:hover fieldset': { borderColor: colors.accent },
      '&.Mui-focused fieldset': { borderColor: colors.accent },
    },
  };

  const readOnlySx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: colors.bg,
      '& fieldset': { borderColor: colors.border },
    },
  };

  const Label = ({ text, required }) => (
    <Typography sx={{ fontSize: '13px', fontWeight: 500, color: colors.textSecondary, mb: 0.75 }}>
      {text} {required && <span style={{ color: colors.error }}>*</span>}
    </Typography>
  );

  // ════════════════════════════════════════════════════
  return (
    <Box>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: colors.primary }}>Webinars</Typography>
          <Typography sx={{ fontSize: '13px', color: colors.textMuted, mt: 0.5 }}>
            Manage webinars — create, edit and delete
          </Typography>
        </Box>
        {isSuperAdmin && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreate}
            sx={{ bgcolor: colors.accent, color: colors.textOnAccent, '&:hover': { bgcolor: colors.accentDark }, fontWeight: 700, borderRadius: 2, px: 3 }}
          >
            Create Webinar
          </Button>
        )}
      </Box>

      {/* ── Search ── */}
      <CustomSearchBar value={search} onChange={setSearch} placeholder="Search by name, category, conductor…" sx={{ mb: 2.5 }} />

      {/* ── Table ── */}
      <Paper elevation={0} sx={{ border: `1px solid ${colors.border}`, borderRadius: 2, overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: colors.accent }} /></Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography sx={{ color: colors.textMuted, fontSize: '14px' }}>
              {search ? 'No webinars match your search' : 'No webinars yet. Create one to get started.'}
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: colors.surfaceAlt }}>
                  {['#', 'Webinar', 'Category', 'Date', 'Time', 'Duration', 'Conductor', 'Limit', 'Price', 'Action'].map(h => (
                    <TableCell key={h} sx={{ fontSize: '11px', fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', py: 1.5 }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((w, idx) => (
                  <TableRow key={w.id} sx={{ '&:hover': { bgcolor: colors.surfaceAlt }, transition: 'background 0.1s' }}>
                    <TableCell sx={{ fontSize: '13px', color: colors.textMuted, width: 40 }}>{idx + 1}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: colors.accentMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <VideoCallIcon sx={{ fontSize: 16, color: colors.accent }} />
                        </Box>
                        <Typography sx={{ fontSize: '13.5px', fontWeight: 600, color: colors.primary, maxWidth: 180 }} noWrap>
                          {w.webinarName}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontSize: '13px', color: colors.textSecondary }}>{w.categoryName}</TableCell>
                    <TableCell sx={{ fontSize: '12px', color: colors.textMuted }}>{toISOLocal(w.webinarDate)}</TableCell>
                    <TableCell sx={{ fontSize: '12px', color: colors.textMuted, whiteSpace: 'nowrap' }}>
                      {fmtTime(w.startTime)} – {fmtTime(w.endTime)}
                    </TableCell>
                    <TableCell sx={{ fontSize: '12px', color: colors.textMuted }}>{fmtDuration(w.durationMinutes)}</TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '13px', color: colors.textSecondary }}>{w.conductorName}</Typography>
                      {w.conductorEmail && <Typography sx={{ fontSize: '11px', color: colors.textMuted }}>{w.conductorEmail}</Typography>}
                    </TableCell>
                    <TableCell sx={{ fontSize: '13px', color: colors.textSecondary }}>{w.participantLimit}</TableCell>
                    <TableCell>
                      {w.isPaid
                        ? <Chip label={`₹${w.price}`} size="small" sx={{ fontSize: '11px', fontWeight: 700, bgcolor: 'rgba(34,197,94,0.12)', color: colors.success }} />
                        : <Chip label="Free"          size="small" sx={{ fontSize: '11px', fontWeight: 700, bgcolor: colors.surfaceAlt, color: colors.textMuted }} />
                      }
                    </TableCell>
                    <TableCell>
                      {isSuperAdmin && (
                        <Tooltip title="Actions">
                          <IconButton size="small" onClick={e => openMenu(e, w)} sx={{ color: colors.textMuted, '&:hover': { color: colors.primary } }}>
                            <MoreVertIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* ── 3-dot menu ── */}
      <Menu
        anchorEl={menu?.anchorEl}
        open={Boolean(menu)}
        onClose={closeMenu}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          elevation: 3,
          sx: { borderRadius: 2, minWidth: 150, border: `1px solid ${colors.border}`, bgcolor: colors.surface, mt: 0.5,
            '& .MuiMenuItem-root': { fontSize: '13.5px', py: 1, px: 2, gap: 1 } },
        }}
      >
        <MenuItem onClick={() => { closeMenu(); openEdit(menu.row); }} sx={{ color: colors.primary }}>
          <ListItemIcon sx={{ minWidth: 'unset' }}><EditIcon sx={{ fontSize: 16, color: colors.primary }} /></ListItemIcon>
          Edit
        </MenuItem>
        <Divider sx={{ borderColor: colors.border, my: 0.5 }} />
        <MenuItem onClick={() => { closeMenu(); openDelete(menu.row); }} sx={{ color: colors.error }}>
          <ListItemIcon sx={{ minWidth: 'unset' }}><DeleteIcon sx={{ fontSize: 16, color: colors.error }} /></ListItemIcon>
          Delete
        </MenuItem>
      </Menu>

      {/* ══════════════════════════════════════════════════
          CREATE / EDIT MODAL
      ══════════════════════════════════════════════════ */}
      <Dialog
        open={modal === 'create' || modal === 'edit'}
        onClose={closeModal}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: 'none' } }}
      >
        {/* Header */}
        <Box sx={{ px: 3.5, pt: 3, pb: 2, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: colors.accentMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {modal === 'edit' ? <EditIcon sx={{ fontSize: 20, color: colors.accent }} /> : <VideoCallIcon sx={{ fontSize: 20, color: colors.accent }} />}
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '17px', color: colors.primary }}>
                {modal === 'edit' ? 'Edit Webinar' : 'Create Webinar'}
              </Typography>
              <Typography sx={{ fontSize: '12.5px', color: colors.textMuted, mt: 0.1 }}>
                {modal === 'edit' ? 'Update webinar details' : 'Fill in the details to schedule a new webinar'}
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={closeModal} sx={{ color: colors.textMuted, mt: 0.25 }}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        <Divider sx={{ borderColor: colors.border }} />

        <DialogContent sx={{ px: 3.5, pt: 2.5, pb: 1 }}>

          {/* Row 1 — Webinar Name + Category */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Box sx={{ flex: 2 }}>
              <Label text="Webinar Name" required />
              <TextField fullWidth size="small" placeholder="e.g. Introduction to React"
                value={form.webinarName} onChange={e => setField('webinarName', e.target.value)} sx={inputSx} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Label text="Category" required />
              <TextField fullWidth size="small" select value={form.categoryId}
                onChange={e => setField('categoryId', e.target.value)} sx={inputSx}
                SelectProps={{ displayEmpty: true }}
              >
                <MenuItem value="" disabled>Select category</MenuItem>
                {categories.map(c => (
                  <MenuItem key={c.id} value={String(c.id)}>{c.categoryName}</MenuItem>
                ))}
              </TextField>
            </Box>
          </Box>

          {/* Row 2 — Webinar Date + Participant Limit */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Box sx={{ flex: 1 }}>
              <CustomDatePicker
                label="Webinar Date"
                starStyle={{ color: colors.error }}
                value={form.webinarDate}
                onChange={e => setField('webinarDate', e.target.value)}
                inputStyle={inputSx}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Label text="Participant Limit" required />
              <TextField fullWidth size="small" type="number" placeholder="e.g. 100"
                value={form.participantLimit} onChange={e => setField('participantLimit', e.target.value)}
                inputProps={{ min: 1 }} sx={inputSx} />
            </Box>
          </Box>

          {/* Row 3 — Start Time + End Time + Duration (auto) */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Box sx={{ flex: 1 }}>
              <CustomTimePicker
                label="Start Time"
                starStyle={{ color: colors.error }}
                value={form.startTime}
                onChange={e => setField('startTime', e.target.value)}
                inputStyle={inputSx}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <CustomTimePicker
                label="End Time"
                starStyle={{ color: colors.error }}
                value={form.endTime}
                onChange={e => setField('endTime', e.target.value)}
                inputStyle={inputSx}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Label text="Duration" />
              {/* Read-only — calculated automatically */}
              <TextField
                fullWidth size="small"
                value={calculatedDuration ? fmtDuration(calculatedDuration) : '—'}
                InputProps={{
                  readOnly: true,
                  startAdornment: (
                    <InputAdornment position="start">
                      <TimerIcon sx={{ fontSize: 16, color: colors.textMuted }} />
                    </InputAdornment>
                  ),
                }}
                sx={readOnlySx}
              />
            </Box>
          </Box>

          <Divider sx={{ borderColor: colors.border, my: 2 }} />

          {/* Row 4 — Conductor Name + Phone + Email */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Label text="Conductor Name" required />
              <TextField fullWidth size="small" placeholder="e.g. John Smith"
                value={form.conductorName} onChange={e => setField('conductorName', e.target.value)} sx={inputSx} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Label text="Conductor Phone" />
              <TextField fullWidth size="small" placeholder="+91 9876543210"
                value={form.conductorPhone} onChange={e => setField('conductorPhone', e.target.value)} sx={inputSx} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Label text="Conductor Email" />
              <TextField fullWidth size="small" type="email" placeholder="john@example.com"
                value={form.conductorEmail} onChange={e => setField('conductorEmail', e.target.value)} sx={inputSx} />
            </Box>
          </Box>

          <Divider sx={{ borderColor: colors.border, my: 2 }} />

          {/* Row 5 — IsPaid toggle + Price */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3, mb: 1 }}>
            <Box sx={{ pt: 0.5 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.isPaid}
                    onChange={e => { setField('isPaid', e.target.checked); if (!e.target.checked) setField('price', ''); }}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': { color: colors.accent },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: colors.accent },
                    }}
                  />
                }
                label={
                  <Typography sx={{ fontSize: '13px', fontWeight: 500, color: colors.textSecondary }}>
                    Paid Webinar
                  </Typography>
                }
              />
            </Box>
            {form.isPaid && (
              <Box sx={{ flex: 1, maxWidth: 220 }}>
                <Label text="Price" required />
                <TextField
                  fullWidth size="small" type="number" placeholder="0.00"
                  value={form.price} onChange={e => setField('price', e.target.value)}
                  inputProps={{ min: 0.01, step: '0.01' }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <CurrencyRupeeIcon sx={{ fontSize: 16, color: colors.textMuted }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={inputSx}
                />
              </Box>
            )}
          </Box>

          {formError && (
            <Typography sx={{ fontSize: '12px', color: colors.error, mt: 1 }}>{formError}</Typography>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3.5, pb: 3, pt: 2, gap: 1 }}>
          <Button onClick={closeModal} disabled={saving} sx={{ color: colors.textSecondary, fontWeight: 600, borderRadius: 2 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={modal === 'edit' ? handleEdit : handleCreate}
            disabled={saving}
            sx={{ bgcolor: colors.accent, color: colors.textOnAccent, '&:hover': { bgcolor: colors.accentDark }, fontWeight: 700, borderRadius: 2, minWidth: 120 }}
          >
            {saving
              ? <CircularProgress size={18} sx={{ color: colors.textOnAccent }} />
              : modal === 'edit' ? 'Save Changes' : 'Create Webinar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ══════════════════════════════════════════════════
          DELETE CONFIRM MODAL
      ══════════════════════════════════════════════════ */}
      <Dialog
        open={modal === 'delete'}
        onClose={closeModal}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: 'none' } }}
      >
        <Box sx={{ px: 3.5, pt: 3, pb: 2, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Typography sx={{ fontWeight: 700, fontSize: '17px', color: colors.primary }}>Delete Webinar</Typography>
          <IconButton size="small" onClick={closeModal} sx={{ color: colors.textMuted }}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
        <Divider sx={{ borderColor: colors.border }} />
        <DialogContent sx={{ px: 3.5, pt: 2.5, pb: 1 }}>
          <Typography sx={{ fontSize: '14px', color: colors.textSecondary, lineHeight: 1.7 }}>
            Are you sure you want to delete{' '}
            <strong style={{ color: colors.primary }}>{target?.webinarName}</strong>?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3.5, pb: 3, pt: 2, gap: 1 }}>
          <Button onClick={closeModal} disabled={saving} sx={{ color: colors.textSecondary, fontWeight: 600, borderRadius: 2 }}>
            Cancel
          </Button>
          <Button
            variant="contained" onClick={handleDelete} disabled={saving}
            sx={{ bgcolor: colors.error, color: '#fff', '&:hover': { bgcolor: colors.error, opacity: 0.88 }, fontWeight: 700, borderRadius: 2, minWidth: 100 }}
          >
            {saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
