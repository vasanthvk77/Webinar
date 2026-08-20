import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Chip, Avatar,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  InputAdornment, CircularProgress, Tooltip, Divider,
  Select, MenuItem, FormControl,
} from '@mui/material';
import EditIcon               from '@mui/icons-material/Edit';
import DeleteIcon             from '@mui/icons-material/Delete';
import LockIcon               from '@mui/icons-material/Lock';
import LockOpenIcon           from '@mui/icons-material/LockOpen';
import PersonAddIcon          from '@mui/icons-material/PersonAdd';
import VisibilityIcon         from '@mui/icons-material/Visibility';
import VisibilityOffIcon      from '@mui/icons-material/VisibilityOff';
import CloseIcon              from '@mui/icons-material/Close';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import toast                  from 'react-hot-toast';
import { adminService }       from '../../services/api';
import { useAuth }            from '../../context/AuthContext';
import { useThemeColors }     from '../../context/ThemeContext';
import CustomSearchBar        from '../../components/CustomSearchBar';

export default function AdminAccounts() {
  const colors = useThemeColors();
  const { isSuperAdmin } = useAuth();

  const [admins,    setAdmins]    = useState([]);
  const [filtered,  setFiltered]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [forbidden, setForbidden] = useState(false); // 403 state
  const [search,    setSearch]    = useState('');

  // Modal state
  const [modal,     setModal]     = useState(null); // 'create' | 'edit' | 'delete' | null
  const [target,    setTarget]    = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [showPass,  setShowPass]  = useState(false);

  // Form
  const [form,      setForm]      = useState({ firstName: '', lastName: '', email: '', password: '', roleId: 2 });
  const [formError, setFormError] = useState('');

  // ── Load ─────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setForbidden(false);
    try {
      const res = await adminService.getAll();
      if (res.data.success) {
        setAdmins(res.data.data);
        setFiltered(res.data.data);
      }
    } catch (err) {
      if (err.response?.status === 403) {
        setForbidden(true);
      } else {
        toast.error('Failed to load admin accounts');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Search ───────────────────────────────────────────
  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q ? admins.filter(a => `${a.firstName} ${a.lastName} ${a.email}`.toLowerCase().includes(q))
        : admins
    );
  }, [search, admins]);

  // ── Modals ───────────────────────────────────────────
  const openCreate = () => {
    setForm({ firstName: '', lastName: '', email: '', password: '', roleId: 2 });
    setFormError(''); setShowPass(false); setModal('create');
  };
  const openEdit = (admin) => {
    setTarget(admin);
    setForm({ firstName: admin.firstName, lastName: admin.lastName ?? '', email: admin.email, password: '', roleId: 2 });
    setFormError(''); setModal('edit');
  };
  const openDelete = (admin) => { setTarget(admin); setModal('delete'); };
  const closeModal = () => { setModal(null); setTarget(null); setSaving(false); };

  // ── Create ───────────────────────────────────────────
  const handleCreate = async () => {
    setFormError('');
    if (!form.firstName.trim()) return setFormError('First name is required');
    if (!form.email.trim())     return setFormError('Email address is required');
    if (form.password.length < 6) return setFormError('Password must be at least 6 characters');
    setSaving(true);
    try {
      const res = await adminService.create({
        firstName: form.firstName.trim(),
        lastName:  form.lastName.trim(),
        email:     form.email.trim(),
        password:  form.password,
        roleId:    form.roleId,       // pass role to backend
      });
      if (res.data.success) {
        toast.success(form.roleId === 1 ? 'Super Admin account created' : 'Admin account created');
        closeModal();
        load();
      } else {
        setFormError(res.data.message || 'Creation failed');
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'An error occurred');
    } finally { setSaving(false); }
  };

  // ── Edit (+ optional role promotion) ─────────────────
  const handleEdit = async () => {
    setFormError('');
    if (!form.firstName.trim()) return setFormError('First name is required');
    if (!form.email.trim())     return setFormError('Email is required');
    setSaving(true);
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName:  form.lastName.trim(),
        email:     form.email.trim(),
      };
      // Only send roleId if promoting (value is 1)
      if (form.roleId === 1) payload.roleId = 1;

      const res = await adminService.update(target.id, payload);
      if (res.data.success) { toast.success(res.data.message || 'Admin updated'); closeModal(); load(); }
      else setFormError(res.data.message || 'Update failed');
    } catch (err) {
      setFormError(err.response?.data?.message || 'An error occurred');
    } finally { setSaving(false); }
  };

  // ── Status toggle ─────────────────────────────────────
  const handleToggleStatus = async (admin) => {
    const next = !admin.isActive;
    try {
      const res = await adminService.setStatus(admin.id, next);
      if (res.data.success) { toast.success(next ? 'Access granted' : 'Access revoked'); load(); }
      else toast.error(res.data.message || 'Status update failed');
    } catch { toast.error('Failed to update status'); }
  };

  // ── Delete ────────────────────────────────────────────
  const handleDelete = async () => {
    setSaving(true);
    try {
      const res = await adminService.delete(target.id);
      if (res.data.success) { toast.success('Admin deleted'); closeModal(); load(); }
      else toast.error(res.data.message || 'Delete failed');
    } catch { toast.error('Failed to delete admin');
    } finally { setSaving(false); }
  };

  const initials = (a) => `${a.firstName?.[0] ?? ''}${a.lastName?.[0] ?? ''}`.toUpperCase() || '?';

  // ── Shared input style ────────────────────────────────
  const inputSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: colors.surfaceAlt,
      '& fieldset': { borderColor: colors.border },
      '&:hover fieldset': { borderColor: colors.accent },
      '&.Mui-focused fieldset': { borderColor: colors.accent },
    },
  };

  // ════════════════════════════════════════════════════
  // 403 state — Admin (not Super Admin) accessing this page
  // ════════════════════════════════════════════════════
  if (forbidden) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 120px)' }}>
        <Paper
          elevation={0}
          sx={{ textAlign: 'center', px: 6, py: 8, borderRadius: 3, border: `2px dashed ${colors.border}`, maxWidth: 480, bgcolor: colors.surface }}
        >
          <Box sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: 'rgba(234,179,8,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3 }}>
            <AdminPanelSettingsIcon sx={{ fontSize: 34, color: colors.accent }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: colors.primary, mb: 1 }}>
            Super Admin Access Required
          </Typography>
          <Typography sx={{ fontSize: '14px', color: colors.textSecondary, lineHeight: 1.7, mb: 2 }}>
            Only <strong>Super Admins</strong> can manage admin accounts.
          </Typography>
          <Typography sx={{ fontSize: '13px', color: colors.textMuted, lineHeight: 1.6 }}>
            Ask your Super Admin to promote your account to <strong>Super Admin</strong> via the Access Control panel to unlock this section.
          </Typography>
        </Paper>
      </Box>
    );
  }

  // ════════════════════════════════════════════════════
  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: colors.primary }}>Admin Accounts</Typography>
          <Typography sx={{ fontSize: '13px', color: colors.textMuted, mt: 0.5 }}>
            Manage admin users — create, edit, revoke or grant access
          </Typography>
        </Box>
        {isSuperAdmin && (
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={openCreate}
            sx={{ bgcolor: colors.accent, color: colors.textOnAccent, '&:hover': { bgcolor: colors.accentDark }, fontWeight: 700, borderRadius: 2, px: 3 }}
          >
            New Admin
          </Button>
        )}
      </Box>

      {/* Search */}
      <CustomSearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search by name or email…"
        sx={{ mb: 2.5 }}
      />

      {/* Table */}
      <Paper elevation={0} sx={{ border: `1px solid ${colors.border}`, borderRadius: 2, overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: colors.accent }} /></Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography sx={{ color: colors.textMuted, fontSize: '14px' }}>
              {search ? 'No admins match your search' : 'No admin accounts yet. Create one to get started.'}
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: colors.surfaceAlt }}>
                  {['Admin', 'Email', 'Status', 'Overrides', 'Created', 'Actions'].map(h => (
                    <TableCell key={h} sx={{ fontSize: '11px', fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', py: 1.5 }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map(admin => (
                  <TableRow key={admin.id} sx={{ '&:hover': { bgcolor: colors.surfaceAlt }, transition: 'background 0.1s' }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ width: 34, height: 34, bgcolor: colors.primary, fontSize: '12px', fontWeight: 700 }}>
                          {initials(admin)}
                        </Avatar>
                        <Box>
                          <Typography sx={{ fontSize: '13.5px', fontWeight: 600, color: colors.primary }}>
                            {admin.firstName} {admin.lastName}
                          </Typography>
                          <Typography sx={{ fontSize: '11px', color: colors.textMuted }}>{admin.roleName}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontSize: '13px', color: colors.textSecondary }}>{admin.email}</TableCell>
                    <TableCell>
                      <Chip label={admin.isActive ? 'Active' : 'Revoked'} size="small"
                        sx={{ fontSize: '11px', fontWeight: 700,
                          bgcolor: admin.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)',
                          color:   admin.isActive ? colors.success : colors.error }} />
                    </TableCell>
                    <TableCell>
                      <Chip label={admin.overrideCount} size="small"
                        sx={{ fontSize: '11px', fontWeight: 700,
                          bgcolor: admin.overrideCount > 0 ? colors.accentMuted : colors.surfaceAlt,
                          color:   admin.overrideCount > 0 ? colors.accent : colors.textMuted }} />
                    </TableCell>
                    <TableCell sx={{ fontSize: '12px', color: colors.textMuted }}>
                      {new Date(admin.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => openEdit(admin)} sx={{ color: colors.primaryMuted, '&:hover': { color: colors.primary } }}>
                            <EditIcon sx={{ fontSize: 17 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={admin.isActive ? 'Revoke Access' : 'Grant Access'}>
                          <IconButton size="small" onClick={() => handleToggleStatus(admin)}
                            sx={{ color: admin.isActive ? colors.error : colors.success }}>
                            {admin.isActive ? <LockIcon sx={{ fontSize: 17 }} /> : <LockOpenIcon sx={{ fontSize: 17 }} />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => openDelete(admin)} sx={{ color: colors.textMuted, '&:hover': { color: colors.error } }}>
                            <DeleteIcon sx={{ fontSize: 17 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* ═══ CREATE MODAL ═══ */}
      <Dialog
        open={modal === 'create'}
        onClose={closeModal}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            border: 'none',
          },
        }}
      >
        {/* Header */}
        <Box sx={{ px: 3.5, pt: 3, pb: 2, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: colors.accentMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PersonAddIcon sx={{ fontSize: 20, color: colors.accent }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '17px', color: colors.primary }}>
                Create New User
              </Typography>
              <Typography sx={{ fontSize: '12.5px', color: colors.textMuted, mt: 0.1 }}>
                Fill in details and assign a role
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={closeModal} sx={{ color: colors.textMuted, mt: 0.25 }}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        <Divider sx={{ borderColor: colors.border }} />

        <DialogContent sx={{ px: 3.5, pt: 2.5, pb: 1 }}>
          {/* Full Name row — First + Last side by side */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '13px', fontWeight: 500, color: colors.textSecondary, mb: 0.75 }}>
                First Name <span style={{ color: colors.error }}>*</span>
              </Typography>
              <TextField
                fullWidth size="small"
                placeholder="e.g. John"
                value={form.firstName}
                onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))}
                sx={inputSx}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '13px', fontWeight: 500, color: colors.textSecondary, mb: 0.75 }}>
                Last Name
              </Typography>
              <TextField
                fullWidth size="small"
                placeholder="e.g. Smith"
                value={form.lastName}
                onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))}
                sx={inputSx}
              />
            </Box>
          </Box>

          {/* Email */}
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: '13px', fontWeight: 500, color: colors.textSecondary, mb: 0.75 }}>
              Email Address <span style={{ color: colors.error }}>*</span>
            </Typography>
            <TextField
              fullWidth size="small"
              type="email"
              placeholder="john@company.com"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              sx={inputSx}
            />
          </Box>

          {/* Password */}
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: '13px', fontWeight: 500, color: colors.textSecondary, mb: 0.75 }}>
              Password <span style={{ color: colors.error }}>*</span>
            </Typography>
            <TextField
              fullWidth size="small"
              type={showPass ? 'text' : 'password'}
              placeholder="Min. 6 characters"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPass(s => !s)} tabIndex={-1} edge="end">
                      {showPass ? <VisibilityOffIcon sx={{ fontSize: 17 }} /> : <VisibilityIcon sx={{ fontSize: 17 }} />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={inputSx}
            />
          </Box>

          {/* Role */}
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: '13px', fontWeight: 500, color: colors.textSecondary, mb: 0.75 }}>
              Role
            </Typography>
            <FormControl fullWidth size="small">
              <Select
                value={form.roleId}
                onChange={e => setForm(p => ({ ...p, roleId: e.target.value }))}
                sx={{
                  bgcolor: colors.surfaceAlt,
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: colors.accent },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.border },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: colors.accent },
                }}
              >
                <MenuItem value={2}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: colors.info }} />
                    Admin
                  </Box>
                </MenuItem>
                <MenuItem value={1}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: colors.accent }} />
                    Super Admin
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
            {form.roleId === 1 && (
              <Typography sx={{ fontSize: '11.5px', color: colors.warning, mt: 0.75, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                ⚠️ Super Admin has full unrestricted access to all modules.
              </Typography>
            )}
          </Box>

          {formError && (
            <Typography sx={{ fontSize: '12.5px', color: colors.error, mt: 0.5, mb: 1 }}>
              {formError}
            </Typography>
          )}
        </DialogContent>

        {/* Footer */}
        <Box sx={{ px: 3.5, py: 2.5, display: 'flex', justifyContent: 'flex-end', gap: 1.5, borderTop: `1px solid ${colors.border}` }}>
          <Button
            onClick={closeModal}
            sx={{ color: colors.textSecondary, fontWeight: 500, borderRadius: 2, px: 2.5 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={saving}
            startIcon={saving ? null : <PersonAddIcon sx={{ fontSize: 17 }} />}
            sx={{
              bgcolor: colors.accent,
              color: colors.textOnAccent,
              fontWeight: 700,
              borderRadius: 2,
              px: 3,
              '&:hover': { bgcolor: colors.accentDark },
              '&:disabled': { bgcolor: colors.accentLight },
            }}
          >
            {saving ? <CircularProgress size={16} sx={{ color: colors.textOnAccent }} /> : 'Create User'}
          </Button>
        </Box>
      </Dialog>

      {/* ═══ EDIT MODAL ═══ */}
      <Dialog open={modal === 'edit'} onClose={closeModal} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: 'none' } }}>

        {/* Header */}
        <Box sx={{ px: 3.5, pt: 3, pb: 2, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: colors.accentMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <EditIcon sx={{ fontSize: 20, color: colors.accent }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '17px', color: colors.primary }}>Edit Admin</Typography>
              <Typography sx={{ fontSize: '12.5px', color: colors.textMuted, mt: 0.1 }}>
                Update account details or promote role
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={closeModal} sx={{ color: colors.textMuted, mt: 0.25 }}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        <Divider sx={{ borderColor: colors.border }} />

        <DialogContent sx={{ px: 3.5, pt: 2.5, pb: 1 }}>
          {/* Name row */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '13px', fontWeight: 500, color: colors.textSecondary, mb: 0.75 }}>
                First Name <span style={{ color: colors.error }}>*</span>
              </Typography>
              <TextField fullWidth size="small" value={form.firstName}
                onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} sx={inputSx} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '13px', fontWeight: 500, color: colors.textSecondary, mb: 0.75 }}>
                Last Name
              </Typography>
              <TextField fullWidth size="small" value={form.lastName}
                onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} sx={inputSx} />
            </Box>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: '13px', fontWeight: 500, color: colors.textSecondary, mb: 0.75 }}>
              Email Address <span style={{ color: colors.error }}>*</span>
            </Typography>
            <TextField fullWidth size="small" type="email" value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))} sx={inputSx} />
          </Box>

          {/* Role promotion */}
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: '13px', fontWeight: 500, color: colors.textSecondary, mb: 0.75 }}>
              Role
            </Typography>
            <FormControl fullWidth size="small">
              <Select
                value={form.roleId}
                onChange={e => setForm(p => ({ ...p, roleId: e.target.value }))}
                sx={{
                  bgcolor: colors.surfaceAlt,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.border },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: colors.accent },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: colors.accent },
                }}
              >
                <MenuItem value={2}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: colors.info }} />
                    Admin
                  </Box>
                </MenuItem>
                <MenuItem value={1}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: colors.accent }} />
                    Promote to Super Admin
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
            {form.roleId === 1 && (
              <Typography sx={{ fontSize: '11.5px', color: colors.warning, mt: 0.75 }}>
                ⚠️ This will grant full unrestricted access. This cannot be undone.
              </Typography>
            )}
          </Box>

          {formError && <Typography sx={{ fontSize: '12.5px', color: colors.error, mb: 1 }}>{formError}</Typography>}
        </DialogContent>

        <Box sx={{ px: 3.5, py: 2.5, display: 'flex', justifyContent: 'flex-end', gap: 1.5, borderTop: `1px solid ${colors.border}` }}>
          <Button onClick={closeModal} sx={{ color: colors.textSecondary, fontWeight: 500, borderRadius: 2, px: 2.5 }}>Cancel</Button>
          <Button variant="contained" onClick={handleEdit} disabled={saving}
            sx={{
              bgcolor: form.roleId === 1 ? colors.accent : colors.primary,
              color:   form.roleId === 1 ? colors.textOnAccent : colors.textOnDark,
              '&:hover': { bgcolor: form.roleId === 1 ? colors.accentDark : colors.primaryLight },
              fontWeight: 700, borderRadius: 2, px: 3,
            }}>
            {saving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : form.roleId === 1 ? 'Promote' : 'Save Changes'}
          </Button>
        </Box>
      </Dialog>

      {/* ═══ DELETE MODAL ═══ */}
      <Dialog open={modal === 'delete'} onClose={closeModal} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3, border: `1px solid ${colors.border}` } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontWeight: 700, color: colors.error }}>Delete Admin</Typography>
          <IconButton size="small" onClick={closeModal}><CloseIcon sx={{ fontSize: 18 }} /></IconButton>
        </DialogTitle>
        <Divider />
        <DialogContent>
          <Typography sx={{ fontSize: '14px', color: colors.textSecondary, lineHeight: 1.6 }}>
            Are you sure you want to delete <strong>{target?.firstName} {target?.lastName}</strong>?
            This cannot be undone and will remove all their tab access overrides.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={closeModal} sx={{ color: colors.textSecondary }}>Cancel</Button>
          <Button variant="contained" onClick={handleDelete} disabled={saving}
            sx={{ bgcolor: colors.error, color: '#fff', '&:hover': { bgcolor: '#dc2626' }, fontWeight: 700, borderRadius: 2, minWidth: 100 }}>
            {saving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
