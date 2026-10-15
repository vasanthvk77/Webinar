import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Tooltip,
  Dialog, DialogContent, DialogActions, TextField,
  CircularProgress, Divider, Menu, MenuItem, ListItemIcon,
} from '@mui/material';
import AddIcon      from '@mui/icons-material/Add';
import DeleteIcon   from '@mui/icons-material/Delete';
import EditIcon     from '@mui/icons-material/Edit';
import CloseIcon    from '@mui/icons-material/Close';
import CategoryIcon from '@mui/icons-material/Category';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import toast        from 'react-hot-toast';
import { categoryService } from '../../services/api';
import { useAuth }         from '../../context/AuthContext';
import { useThemeColors }  from '../../context/ThemeContext';
import CustomSearchBar     from '../../components/CustomSearchBar';

export default function Categories() {
  const colors           = useThemeColors();
  const { isSuperAdmin } = useAuth();

  const [categories, setCategories] = useState([]);
  const [filtered,   setFiltered]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');

  // Modal state: 'create' | 'edit' | 'delete' | null
  const [modal,     setModal]  = useState(null);
  const [target,    setTarget] = useState(null);
  const [saving,    setSaving] = useState(false);

  // Form
  const [categoryName, setCategoryName] = useState('');
  const [formError,    setFormError]    = useState('');

  // 3-dot menu anchor — { anchorEl, cat }
  const [menu, setMenu] = useState(null);

  // ── Load ─────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await categoryService.getAll();
      if (res.data.success) {
        setCategories(res.data.data);
        setFiltered(res.data.data);
      }
    } catch {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Search ───────────────────────────────────────────
  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q ? categories.filter(c => c.categoryName.toLowerCase().includes(q))
        : categories
    );
  }, [search, categories]);

  // ── 3-dot menu ────────────────────────────────────────
  const openMenu  = (e, cat) => setMenu({ anchorEl: e.currentTarget, cat });
  const closeMenu = ()        => setMenu(null);

  // ── Modals ───────────────────────────────────────────
  const openCreate = () => {
    setCategoryName(''); setFormError(''); setModal('create');
  };
  const openEdit = (cat) => {
    setTarget(cat); setCategoryName(cat.categoryName); setFormError(''); setModal('edit');
  };
  const openDelete = (cat) => {
    setTarget(cat); setModal('delete');
  };
  const closeModal = () => { setModal(null); setTarget(null); setSaving(false); };

  // ── Create ───────────────────────────────────────────
  const handleCreate = async () => {
    setFormError('');
    if (!categoryName.trim()) return setFormError('Category name is required');
    setSaving(true);
    try {
      const res = await categoryService.create(categoryName.trim());
      if (res.data.success) {
        toast.success('Category created');
        closeModal(); load();
      } else {
        setFormError(res.data.message || 'Creation failed');
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'An error occurred');
    } finally { setSaving(false); }
  };

  // ── Edit ─────────────────────────────────────────────
  const handleEdit = async () => {
    setFormError('');
    if (!categoryName.trim()) return setFormError('Category name is required');
    setSaving(true);
    try {
      const res = await categoryService.update(target.id, categoryName.trim());
      if (res.data.success) {
        toast.success('Category updated');
        closeModal(); load();
      } else {
        setFormError(res.data.message || 'Update failed');
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'An error occurred');
    } finally { setSaving(false); }
  };

  // ── Delete ────────────────────────────────────────────
  const handleDelete = async () => {
    setSaving(true);
    try {
      const res = await categoryService.delete(target.id);
      if (res.data.success) {
        toast.success('Category deleted');
        closeModal(); load();
      } else {
        toast.error(res.data.message || 'Delete failed');
      }
    } catch { toast.error('Failed to delete category');
    } finally { setSaving(false); }
  };

  // ── Shared input style ────────────────────────────────
  const inputSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: colors.surfaceAlt,
      '& fieldset': { borderColor: colors.border },
      '&:hover fieldset': { borderColor: colors.accent },
      '&.Mui-focused fieldset': { borderColor: colors.accent },
    },
  };

  // ── Helper: format date ───────────────────────────────
  const fmt = (d) => d ? new Date(d).toLocaleDateString() : '—';

  // ════════════════════════════════════════════════════
  return (
    <Box>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: colors.primary }}>Categories</Typography>
          <Typography sx={{ fontSize: '13px', color: colors.textMuted, mt: 0.5 }}>
            Manage webinar categories
          </Typography>
        </Box>
        {isSuperAdmin && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreate}
            sx={{
              bgcolor: colors.accent, color: colors.textOnAccent,
              '&:hover': { bgcolor: colors.accentDark },
              fontWeight: 700, borderRadius: 2, px: 3,
            }}
          >
            Create Category
          </Button>
        )}
      </Box>

      {/* ── Search ── */}
      <CustomSearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search categories…"
        sx={{ mb: 2.5 }}
      />

      {/* ── Table ── */}
      <Paper elevation={0} sx={{ border: `1px solid ${colors.border}`, borderRadius: 2, overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress sx={{ color: colors.accent }} />
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography sx={{ color: colors.textMuted, fontSize: '14px' }}>
              {search ? 'No categories match your search' : 'No categories yet. Create one to get started.'}
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: colors.surfaceAlt }}>
                  {['#', 'Category Name', 'Created By', 'Created At', 'Updated By', 'Updated At', 'Action'].map(h => (
                    <TableCell key={h} sx={{ fontSize: '11px', fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', py: 1.5 }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((cat, index) => (
                  <TableRow key={cat.id} sx={{ '&:hover': { bgcolor: colors.surfaceAlt }, transition: 'background 0.1s' }}>

                    {/* # */}
                    <TableCell sx={{ fontSize: '13px', color: colors.textMuted, width: 48 }}>
                      {index + 1}
                    </TableCell>

                    {/* Category Name */}
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: colors.accentMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <CategoryIcon sx={{ fontSize: 16, color: colors.accent }} />
                        </Box>
                        <Typography sx={{ fontSize: '13.5px', fontWeight: 600, color: colors.primary }}>
                          {cat.categoryName}
                        </Typography>
                      </Box>
                    </TableCell>

                    {/* Created By */}
                    <TableCell sx={{ fontSize: '13px', color: colors.textSecondary }}>
                      {cat.createdByName}
                    </TableCell>

                    {/* Created At */}
                    <TableCell sx={{ fontSize: '12px', color: colors.textMuted }}>
                      {fmt(cat.createdAt)}
                    </TableCell>

                    {/* Updated By */}
                    <TableCell sx={{ fontSize: '13px', color: colors.textSecondary }}>
                      {cat.updatedByName ?? '—'}
                    </TableCell>

                    {/* Updated At */}
                    <TableCell sx={{ fontSize: '12px', color: colors.textMuted }}>
                      {fmt(cat.updatedAt)}
                    </TableCell>

                    {/* Action — 3-dot menu (Super Admin only) */}
                    <TableCell>
                      {isSuperAdmin && (
                        <Tooltip title="Actions">
                          <IconButton
                            size="small"
                            onClick={e => openMenu(e, cat)}
                            sx={{ color: colors.textMuted, '&:hover': { color: colors.primary } }}
                          >
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

      {/* ── 3-dot dropdown menu ── */}
      <Menu
        anchorEl={menu?.anchorEl}
        open={Boolean(menu)}
        onClose={closeMenu}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          elevation: 3,
          sx: {
            borderRadius: 2,
            minWidth: 150,
            border: `1px solid ${colors.border}`,
            bgcolor: colors.surface,
            mt: 0.5,
            '& .MuiMenuItem-root': {
              fontSize: '13.5px',
              py: 1,
              px: 2,
              gap: 1,
            },
          },
        }}
      >
        <MenuItem
          onClick={() => { closeMenu(); openEdit(menu.cat); }}
          sx={{ color: colors.primary }}
        >
          <ListItemIcon sx={{ minWidth: 'unset' }}>
            <EditIcon sx={{ fontSize: 16, color: colors.primary }} />
          </ListItemIcon>
          Edit
        </MenuItem>

        <Divider sx={{ borderColor: colors.border, my: 0.5 }} />

        <MenuItem
          onClick={() => { closeMenu(); openDelete(menu.cat); }}
          sx={{ color: colors.error }}
        >
          <ListItemIcon sx={{ minWidth: 'unset' }}>
            <DeleteIcon sx={{ fontSize: 16, color: colors.error }} />
          </ListItemIcon>
          Delete
        </MenuItem>
      </Menu>

      {/* ══════════════════════════════════════════════════
          CREATE / EDIT MODAL  (shared layout, title changes)
      ══════════════════════════════════════════════════ */}
      <Dialog
        open={modal === 'create' || modal === 'edit'}
        onClose={closeModal}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: 'none' } }}
      >
        {/* Header */}
        <Box sx={{ px: 3.5, pt: 3, pb: 2, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: colors.accentMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {modal === 'edit'
                ? <EditIcon sx={{ fontSize: 20, color: colors.accent }} />
                : <CategoryIcon sx={{ fontSize: 20, color: colors.accent }} />}
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '17px', color: colors.primary }}>
                {modal === 'edit' ? 'Edit Category' : 'Create Category'}
              </Typography>
              <Typography sx={{ fontSize: '12.5px', color: colors.textMuted, mt: 0.1 }}>
                {modal === 'edit' ? 'Update the category name' : 'Enter a unique category name'}
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={closeModal} sx={{ color: colors.textMuted, mt: 0.25 }}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        <Divider sx={{ borderColor: colors.border }} />

        <DialogContent sx={{ px: 3.5, pt: 2.5, pb: 1 }}>
          <Typography sx={{ fontSize: '13px', fontWeight: 500, color: colors.textSecondary, mb: 0.75 }}>
            Category Name <span style={{ color: colors.error }}>*</span>
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="e.g. Technology"
            value={categoryName}
            onChange={e => { setCategoryName(e.target.value); setFormError(''); }}
            onKeyDown={e => e.key === 'Enter' && (modal === 'edit' ? handleEdit() : handleCreate())}
            autoFocus
            sx={inputSx}
          />
          {formError && (
            <Typography sx={{ fontSize: '12px', color: colors.error, mt: 1 }}>
              {formError}
            </Typography>
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
            sx={{ bgcolor: colors.accent, color: colors.textOnAccent, '&:hover': { bgcolor: colors.accentDark }, fontWeight: 700, borderRadius: 2, minWidth: 100 }}
          >
            {saving
              ? <CircularProgress size={18} sx={{ color: colors.textOnAccent }} />
              : modal === 'edit' ? 'Save Changes' : 'Create'}
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
          <Typography sx={{ fontWeight: 700, fontSize: '17px', color: colors.primary }}>
            Delete Category
          </Typography>
          <IconButton size="small" onClick={closeModal} sx={{ color: colors.textMuted }}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        <Divider sx={{ borderColor: colors.border }} />

        <DialogContent sx={{ px: 3.5, pt: 2.5, pb: 1 }}>
          <Typography sx={{ fontSize: '14px', color: colors.textSecondary, lineHeight: 1.7 }}>
            Are you sure you want to delete{' '}
            <strong style={{ color: colors.primary }}>{target?.categoryName}</strong>?
            This action cannot be undone.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 3.5, pb: 3, pt: 2, gap: 1 }}>
          <Button onClick={closeModal} disabled={saving} sx={{ color: colors.textSecondary, fontWeight: 600, borderRadius: 2 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleDelete}
            disabled={saving}
            sx={{ bgcolor: colors.error, color: '#fff', '&:hover': { bgcolor: colors.error, opacity: 0.88 }, fontWeight: 700, borderRadius: 2, minWidth: 100 }}
          >
            {saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
