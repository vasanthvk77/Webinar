import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Avatar, Chip, Switch, CircularProgress,
  IconButton, Button, Slide,
} from '@mui/material';
import PersonIcon       from '@mui/icons-material/Person';
import SaveIcon         from '@mui/icons-material/Save';
import UndoIcon         from '@mui/icons-material/Undo';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import toast             from 'react-hot-toast';
import { accessService } from '../../services/api';
import { colors }        from '../../utils/theme';
import adminTabs         from '../../config/adminTabs';
import CustomSearchBar   from '../../components/CustomSearchBar';

// ─────────────────────────────────────────────────────────
// Build the "module structure" from adminTabs config so the
// Access Control page knows which tabs are parents/children.
//
// Each entry: { label, routes: [route, ...childRoutes] }
//   - Flat tab  → routes = [tab.route]
//   - Parent tab → routes = [child.route, ...] (children only,
//     the virtual parent route e.g. /admin/master is not in DB)
// ─────────────────────────────────────────────────────────
const moduleStructure = adminTabs
  .filter(t => t.route !== '/admin/access') // hide access-control from matrix
  .map(t => {
    if (t.children?.length) {
      return {
        label:    t.label,
        icon:     t.icon,
        isParent: true,
        routes:   t.children.map(c => c.route),
        children: t.children,
      };
    }
    return {
      label:    t.label,
      icon:     t.icon,
      isParent: false,
      routes:   [t.route],
      children: [],
    };
  });

// -------------------------------------------------------
// AccessControl — Super Admin only
//
// 3-box layout:
//   Box 1 — Admin list
//   Box 2 — Modules (each as a card with toggle)
//   Box 3 — Sub-modules of selected parent module
//
// Changes are staged locally. A floating Save bar appears
// when there are unsaved changes.
// -------------------------------------------------------
export default function AccessControl() {
  // ── Box 1: Admins ────────────────────────────────────
  const [admins,        setAdmins]        = useState([]);
  const [adminsLoading, setAdminsLoading] = useState(true);
  const [adminSearch,   setAdminSearch]   = useState('');
  const [selectedAdmin, setSelectedAdmin] = useState(null);

  // ── Matrix from API: tabId → { isAllowed, roleDefault, userOverride } ──
  const [matrix,        setMatrix]        = useState({});
  const [matrixLoading, setMatrixLoading] = useState(false);

  // ── Local staged changes: tabId → bool ─────────────────
  const [staged,        setStaged]        = useState({});

  // ── Box 2: selected module ───────────────────────────
  const [selectedModule, setSelectedModule] = useState(null);

  // ── Saving state ────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const hasUnsaved = Object.keys(staged).length > 0;

  // ── Load admin list ──────────────────────────────────
  const loadAdmins = useCallback(async () => {
    setAdminsLoading(true);
    try {
      const res = await accessService.getAdmins();
      if (res.data.success) setAdmins(res.data.data);
    } catch {
      toast.error('Failed to load admins');
    } finally {
      setAdminsLoading(false);
    }
  }, []);

  useEffect(() => { loadAdmins(); }, [loadAdmins]);

  // ── Load tab matrix for selected admin ───────────────
  const loadMatrix = useCallback(async (adminId) => {
    setMatrixLoading(true);
    setMatrix({});
    setStaged({});
    setSelectedModule(null);
    try {
      const res = await accessService.getTabMatrix(adminId);
      if (res.data.success) {
        // Convert array → map keyed by route for fast lookup
        const map = {};
        res.data.data.forEach(t => { map[t.route] = t; });
        setMatrix(map);
      }
    } catch {
      toast.error('Failed to load permissions');
    } finally {
      setMatrixLoading(false);
    }
  }, []);

  const selectAdmin = (admin) => {
    if (hasUnsaved) {
      if (!window.confirm('You have unsaved changes. Switch admin anyway?')) return;
    }
    setSelectedAdmin(admin);
    loadMatrix(admin.id);
  };

  // ── Staged toggle (no API call yet) ─────────────────
  const handleToggle = (route, newValue) => {
    const original = matrix[route];
    // If toggling back to original value, remove from staged
    if (original && original.isAllowed === newValue) {
      setStaged(prev => {
        const next = { ...prev };
        delete next[route];
        return next;
      });
    } else {
      setStaged(prev => ({ ...prev, [route]: newValue }));
    }
  };

  // ── Effective value for a tab (staged takes priority) ─
  const effectiveValue = (route) => {
    if (route in staged) return staged[route];
    return matrix[route]?.isAllowed ?? false;
  };

  // ── Discard staged changes ───────────────────────────
  const handleDiscard = () => {
    setStaged({});
  };

  // ── Save all staged changes ──────────────────────────
  const handleSave = async () => {
    if (!selectedAdmin || !hasUnsaved) return;
    setSaving(true);

    const entries = Object.entries(staged); // [[route, bool], ...]
    let successCount = 0;
    let failCount = 0;

    for (const [route, isAllowed] of entries) {
      const tab = matrix[route];
      if (!tab) continue;
      try {
        const res = await accessService.setTabOverride(
          selectedAdmin.id, tab.tabId, isAllowed
        );
        if (res.data.success) {
          successCount++;
          // Update local matrix with saved value
          setMatrix(prev => ({
            ...prev,
            [route]: { ...prev[route], isAllowed, userOverride: isAllowed },
          }));
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setSaving(false);
    setStaged({});

    if (failCount === 0) {
      toast.success(`${successCount} permission${successCount !== 1 ? 's' : ''} saved`);
    } else {
      toast.error(`${failCount} change${failCount !== 1 ? 's' : ''} failed to save`);
    }

    loadAdmins(); // refresh override count badge
  };

  // ── Reset all overrides to role defaults ─────────────
  const handleReset = async () => {
    if (!selectedAdmin) return;
    if (!window.confirm('Reset all overrides to role defaults? This cannot be undone.')) return;

    setResetting(true);
    try {
      const res = await accessService.resetOverrides(selectedAdmin.id);
      if (res.data.success) {
        toast.success('All overrides reset to role defaults');
        setStaged({});
        await loadMatrix(selectedAdmin.id);
        loadAdmins();
      } else {
        toast.error(res.data.message || 'Reset failed');
      }
    } catch (err) {
      toast.error('Failed to reset overrides');
    } finally {
      setResetting(false);
    }
  };

  // ── Helpers ──────────────────────────────────────────
  const initials = (a) =>
    `${a.firstName?.[0] ?? ''}${a.lastName?.[0] ?? ''}`.toUpperCase() || '?';

  const filteredAdmins = adminSearch
    ? admins.filter(a =>
        `${a.firstName} ${a.lastName} ${a.email}`
          .toLowerCase().includes(adminSearch.toLowerCase())
      )
    : admins;

  // Whether a module has any change staged
  const moduleHasStagedChange = (mod) =>
    mod.routes.some(r => r in staged);

  // Effective module-level toggle:
  //   true  = all routes in module are allowed
  //   false = all denied
  //   null  = mixed
  const moduleEffective = (mod) => {
    const vals = mod.routes.map(r => effectiveValue(r));
    if (vals.every(v => v === true))  return true;
    if (vals.every(v => v === false)) return false;
    return null; // mixed
  };

  // Toggle ALL routes in a module at once
  const handleModuleToggle = (mod, newValue) => {
    const updates = {};
    mod.routes.forEach(r => {
      const original = matrix[r];
      if (original && original.isAllowed === newValue) {
        // Already at this value — no change needed
      } else {
        updates[r] = newValue;
      }
    });
    // Remove any routes that would revert to original
    setStaged(prev => {
      const next = { ...prev };
      mod.routes.forEach(r => {
        const original = matrix[r];
        if (original && original.isAllowed === newValue) {
          delete next[r];
        } else {
          next[r] = newValue;
        }
      });
      return next;
    });
  };

  // ════════════════════════════════════════════════════
  return (
    <Box sx={{ pb: hasUnsaved ? 10 : 0 }}>
      {/* ── Page header ── */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: colors.primary }}>
            Access Control
          </Typography>
          <Typography sx={{ fontSize: '13px', color: colors.textMuted, mt: 0.5 }}>
            Configure per-admin module permissions. Select an admin → select a module → configure access.
          </Typography>
        </Box>
        {selectedAdmin && (
          <Button
            size="small"
            onClick={handleReset}
            disabled={resetting}
            sx={{
              fontSize: '12px', fontWeight: 600, borderRadius: 1.5,
              color: colors.error, border: `1px solid rgba(239,68,68,0.3)`,
              '&:hover': { bgcolor: 'rgba(239,68,68,0.06)' },
            }}
          >
            {resetting ? <CircularProgress size={14} sx={{ mr: 0.5 }} /> : null}
            Reset to Defaults
          </Button>
        )}
      </Box>

      {/* ── 3-box layout ── */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>

        {/* ═══════════════════════════════════
            BOX 1 — Admin List
        ═══════════════════════════════════ */}
        <Paper elevation={0} sx={{ width: 250, flexShrink: 0, border: `1px solid ${colors.border}`, borderRadius: 2, overflow: 'hidden' }}>
          {/* Header */}
          <Box sx={{ px: 2, py: 1.5, bgcolor: colors.primary }}>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Admin Users
            </Typography>
          </Box>
          {/* Search */}
          <Box sx={{ px: 1.5, py: 0.75, borderBottom: `1px solid ${colors.border}`, bgcolor: colors.surfaceAlt }}>
            <CustomSearchBar
              value={adminSearch}
              onChange={setAdminSearch}
              placeholder="Search admins…"
              size="sm"
            />
          </Box>
          {/* List */}
          <Box sx={{ height: 'calc(100vh - 290px)', overflowY: 'auto', '&::-webkit-scrollbar': { width: 3 }, '&::-webkit-scrollbar-thumb': { bgcolor: colors.border } }}>
            {adminsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={20} sx={{ color: colors.accent }} /></Box>
            ) : filteredAdmins.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <PersonIcon sx={{ fontSize: 28, color: colors.border }} />
                <Typography sx={{ fontSize: '12px', color: colors.textMuted, mt: 0.5 }}>No admins</Typography>
              </Box>
            ) : filteredAdmins.map(admin => {
              const sel = selectedAdmin?.id === admin.id;
              return (
                <Box
                  key={admin.id}
                  onClick={() => selectAdmin(admin)}
                  sx={{
                    px: 2, py: 1.5, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 1.25,
                    bgcolor: sel ? colors.accentMuted : 'transparent',
                    borderLeft: sel ? `3px solid ${colors.accent}` : '3px solid transparent',
                    borderBottom: `1px solid ${colors.border}`,
                    transition: 'all 0.12s',
                    '&:hover': { bgcolor: sel ? colors.accentMuted : colors.surfaceAlt },
                  }}
                >
                  <Avatar sx={{ width: 30, height: 30, flexShrink: 0, bgcolor: sel ? colors.accent : colors.primaryLight, fontSize: '10px', fontWeight: 700, color: '#fff' }}>
                    {initials(admin)}
                  </Avatar>
                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: sel ? colors.accent : colors.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {admin.firstName} {admin.lastName}
                    </Typography>
                    <Typography sx={{ fontSize: '10.5px', color: colors.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {admin.email}
                    </Typography>
                  </Box>
                  <Box sx={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, bgcolor: admin.isActive ? colors.success : colors.error }} />
                </Box>
              );
            })}
          </Box>
        </Paper>

        {/* ═══════════════════════════════════
            BOX 2 — Modules
        ═══════════════════════════════════ */}
        <Paper elevation={0} sx={{ width: 400, flexShrink: 0, border: `1px solid ${colors.border}`, borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ px: 2, py: 1.5, bgcolor: colors.primary }}>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Modules
            </Typography>
            {selectedAdmin && (
              <Typography sx={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.5)', mt: 0.25 }}>
                {selectedAdmin.firstName} {selectedAdmin.lastName}
              </Typography>
            )}
          </Box>

          <Box sx={{ height: 'calc(100vh - 290px)', overflowY: 'auto', p: 1.5, '&::-webkit-scrollbar': { width: 3 }, '&::-webkit-scrollbar-thumb': { bgcolor: colors.border } }}>
            {!selectedAdmin ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', px: 2 }}>
                <PersonIcon sx={{ fontSize: 36, color: colors.border, mb: 1 }} />
                <Typography sx={{ fontSize: '12px', color: colors.textMuted, textAlign: 'center' }}>
                  Select an admin to configure modules
                </Typography>
              </Box>
            ) : matrixLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}><CircularProgress size={24} sx={{ color: colors.accent }} /></Box>
            ) : (
              moduleStructure.map(mod => {
                const effective = moduleEffective(mod);
                const isSelected = selectedModule?.label === mod.label;
                const hasStagedChange = moduleHasStagedChange(mod);

                return (
                  <Box
                    key={mod.label}
                    onClick={() => setSelectedModule(mod)}
                    sx={{
                      mb: 1, p: 1.5, borderRadius: 2, cursor: 'pointer',
                      border: `1px solid ${isSelected ? colors.accent : colors.border}`,
                      bgcolor: isSelected ? colors.accentMuted : colors.surface,
                      transition: 'all 0.15s',
                      '&:hover': { borderColor: colors.accent, bgcolor: colors.accentMuted },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                        <mod.icon sx={{ fontSize: 17, color: isSelected ? colors.accent : colors.primaryMuted, flexShrink: 0 }} />
                        <Typography sx={{ fontSize: '13px', fontWeight: 600, color: isSelected ? colors.accent : colors.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {mod.label}
                        </Typography>
                        {hasStagedChange && (
                          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: colors.accent, flexShrink: 0 }} />
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Switch
                          checked={effective === true}
                          indeterminate={effective === null}
                          onChange={e => { e.stopPropagation(); handleModuleToggle(mod, e.target.checked); }}
                          onClick={e => e.stopPropagation()}
                          size="small"
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': { color: colors.accent },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: colors.accent },
                          }}
                        />
                        {mod.isParent && (
                          <ChevronRightIcon sx={{ fontSize: 16, color: isSelected ? colors.accent : colors.textMuted, transition: 'transform 0.15s', transform: isSelected ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                        )}
                      </Box>
                    </Box>
                    {/* Permitted / Denied badge */}
                    <Box sx={{ mt: 0.75, ml: 3.25 }}>
                      <Chip
                        label={effective === true ? 'PERMITTED' : effective === false ? 'DENIED' : 'PARTIAL'}
                        size="small"
                        sx={{
                          fontSize: '9px', fontWeight: 700, height: 16,
                          bgcolor: effective === true ? 'rgba(34,197,94,0.12)' : effective === false ? 'rgba(239,68,68,0.10)' : colors.accentLight,
                          color:   effective === true ? colors.success : effective === false ? colors.error : colors.accentDark,
                        }}
                      />
                    </Box>
                  </Box>
                );
              })
            )}
          </Box>
        </Paper>

        {/* ═══════════════════════════════════
            BOX 3 — Sub-modules
        ═══════════════════════════════════ */}
        <Paper elevation={0} sx={{ flexGrow: 1, border: `1px solid ${colors.border}`, borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ px: 2, py: 1.5, bgcolor: colors.primary }}>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              {selectedModule ? selectedModule.label : 'Sub-modules'}
            </Typography>
            {selectedModule && (
              <Typography sx={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.5)', mt: 0.25 }}>
                {selectedModule.isParent ? `${selectedModule.children.length} sub-modules` : 'Single module'}
              </Typography>
            )}
          </Box>

          <Box sx={{ height: 'calc(100vh - 290px)', overflowY: 'auto', p: 1.5, '&::-webkit-scrollbar': { width: 3 }, '&::-webkit-scrollbar-thumb': { bgcolor: colors.border } }}>
            {!selectedAdmin ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography sx={{ fontSize: '12px', color: colors.textMuted }}>Select an admin first</Typography>
              </Box>
            ) : !selectedModule ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <ChevronRightIcon sx={{ fontSize: 36, color: colors.border, mb: 1 }} />
                <Typography sx={{ fontSize: '12px', color: colors.textMuted, textAlign: 'center' }}>
                  Select a module to configure sub-permissions
                </Typography>
              </Box>
            ) : (
              /* Show the routes belonging to the selected module */
              selectedModule.routes.map(route => {
                const tab = matrix[route];
                if (!tab) return null;

                const current   = effectiveValue(route);
                const isStaged  = route in staged;
                const childInfo = selectedModule.children.find(c => c.route === route);
                const label     = childInfo?.label ?? tab.tabName;
                const IconComp  = childInfo?.icon ?? null;

                return (
                  <Box
                    key={route}
                    sx={{
                      mb: 1, p: 1.75, borderRadius: 2,
                      border: `1px solid ${isStaged ? colors.accent : colors.border}`,
                      bgcolor: isStaged ? colors.accentMuted : colors.surface,
                      transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                      {IconComp && <IconComp sx={{ fontSize: 18, color: current ? colors.accent : colors.primaryMuted }} />}
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Typography sx={{ fontSize: '13.5px', fontWeight: 600, color: colors.primary }}>
                            {label}
                          </Typography>
                          {isStaged && (
                            <Chip label="Modified" size="small" sx={{ fontSize: '9px', fontWeight: 700, height: 16, bgcolor: colors.accentLight, color: colors.accentDark }} />
                          )}
                        </Box>
                        <Typography sx={{ fontSize: '11px', color: colors.textMuted }}>{route}</Typography>
                        <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5 }}>
                          <Chip
                            label={tab.roleDefault ? 'Role: Allowed' : 'Role: Denied'}
                            size="small"
                            sx={{
                              fontSize: '9px', fontWeight: 700, height: 16,
                              bgcolor: tab.roleDefault ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.08)',
                              color:   tab.roleDefault ? colors.success : colors.error,
                            }}
                          />
                          {tab.userOverride !== null && tab.userOverride !== undefined && !isStaged && (
                            <Chip
                              label={tab.userOverride ? 'Override: Granted' : 'Override: Denied'}
                              size="small"
                              sx={{
                                fontSize: '9px', fontWeight: 700, height: 16,
                                bgcolor: tab.userOverride ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.08)',
                                color:   tab.userOverride ? colors.success : colors.error,
                              }}
                            />
                          )}
                        </Box>
                      </Box>
                    </Box>

                    {/* Toggle */}
                    <Switch
                      checked={current}
                      onChange={e => handleToggle(route, e.target.checked)}
                      size="small"
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': { color: colors.accent },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: colors.accent },
                      }}
                    />
                  </Box>
                );
              })
            )}
          </Box>
        </Paper>
      </Box>

      {/* ════════════════════════════════════════════════════
          FLOATING SAVE BAR — appears when there are unsaved changes
      ════════════════════════════════════════════════════ */}
      <Slide direction="up" in={hasUnsaved} mountOnEnter unmountOnExit>
        <Box
          sx={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1300,
            bgcolor: colors.primary,
            color: colors.textOnDark,
            borderRadius: 3,
            px: 3, py: 1.5,
            display: 'flex', alignItems: 'center', gap: 2,
            boxShadow: '0 8px 32px rgba(30,41,59,0.25)',
            minWidth: 340,
          }}
        >
          <Box sx={{ flexGrow: 1 }}>
            <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
              Unsaved Changes
            </Typography>
            <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
              {Object.keys(staged).length} permission{Object.keys(staged).length !== 1 ? 's' : ''} modified
            </Typography>
          </Box>
          <Button
            size="small"
            startIcon={<UndoIcon sx={{ fontSize: 15 }} />}
            onClick={handleDiscard}
            disabled={saving}
            sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: '12px', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' } }}
          >
            Discard
          </Button>
          <Button
            size="small"
            variant="contained"
            startIcon={saving ? <CircularProgress size={13} sx={{ color: '#fff' }} /> : <SaveIcon sx={{ fontSize: 15 }} />}
            onClick={handleSave}
            disabled={saving}
            sx={{
              bgcolor: colors.accent, color: colors.textOnAccent,
              fontWeight: 700, fontSize: '12px', borderRadius: 2,
              '&:hover': { bgcolor: colors.accentDark },
              minWidth: 90,
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </Box>
      </Slide>
    </Box>
  );
}
