import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Tooltip,
  Dialog, DialogContent, DialogActions, TextField, MenuItem,
  CircularProgress, Divider, Menu, ListItemIcon, Switch,
  FormControlLabel, Chip, InputAdornment, Select, Checkbox,
  FormControl,
} from '@mui/material';
import AddIcon           from '@mui/icons-material/Add';
import DeleteIcon        from '@mui/icons-material/Delete';
import EditIcon          from '@mui/icons-material/Edit';
import CloseIcon         from '@mui/icons-material/Close';
import MoreVertIcon      from '@mui/icons-material/MoreVert';
import VideoCallIcon     from '@mui/icons-material/VideoCall';
import TimerIcon         from '@mui/icons-material/Timer';
import CurrencyRupeeIcon from '@mui/icons-material/CurrencyRupee';
import ContentCopyIcon   from '@mui/icons-material/ContentCopy';
import SendIcon          from '@mui/icons-material/Send';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import CalendarMonthIcon   from '@mui/icons-material/CalendarMonth';
import AutorenewIcon       from '@mui/icons-material/Autorenew';
import CloudUploadIcon     from '@mui/icons-material/CloudUpload';
import ImageIcon           from '@mui/icons-material/Image';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import toast             from 'react-hot-toast';
import { webinarService, categoryService, certificateTemplateService, meetingService } from '../../services/api';
import { useAuth }          from '../../context/AuthContext';
import { useThemeColors }   from '../../context/ThemeContext';
import CustomSearchBar      from '../../components/CustomSearchBar';
import CustomPagination     from '../../components/CustomPagination';
import CustomTimePicker     from '../../components/CustomeTimePicker';
import CustomDatePicker     from '../../components/CustomeDatePicker';
import {
  getFlagEmoji,
  getCountryNameFromCode,
  getCountryFromCode,
  getCurrencySymbolFromCountryCode,
} from '../../utils/countryUtils';
import {
  formatUtcToLocal,
  formatUtcToLocalDateOnly,
  formatUtcToLocalTimeOnly,
  formatUtcToLocalDateDDMMYYYY,
  formatUtcToLocalTime24,
  formatUtcToLocalDateInput
} from '../../utils/validation';

const EMPTY_MEETING_FORM = {
  webinarId: null,
  name: '',
  meetingID: '',
  maxParticipants: '',
  duration: '',
  record: false,
  autoStartRecording: false,
  allowStartStopRecording: true,
  logoutURL: '',
  meetingExpireIfNoUserJoinedInMinutes: 10,
  meetingExpireWhenLastUserLeftInMinutes: 1,
  endWhenNoModerator: false,
  guestPolicy: 'ALWAYS_ACCEPT',
  muteOnStart: true,
  meetingLayout: 'UNIFIED_LAYOUT',
  lockSettingsPresenterPolicy: 'default',
  moderatorPW: '',
  attendeePW: '',
};

const generateRandomMeetingId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let res = '';
  for (let i = 0; i < 8; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
};

export const getFullWebinarImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const apiBase = (import.meta.env.VITE_API_BASE_URL || 'https://localhost:7001').replace(/\/$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${apiBase}${cleanPath}`;
};

const EMPTY_FORM = {
  webinarName:      '',
  categoryId:       '',
  certificateTempId: '',
  webinarDate:      '',
  startTime:        '',   // "HH:mm"
  endTime:          '',   // "HH:mm"
  conductorName:    '',
  conductorPhone:   '',
  conductorEmail:   '',
  participantLimit: '',
  isPaid:           false,
  price:            '',
  imageUrl:         '',
  selectedCountries: [],
  countryPrices:    {},
};

// â”€â”€ Calculate duration in minutes from "HH:mm" strings â”€â”€
const calcDuration = (start, end) => {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff > 0 ? diff : null;
};

// â”€â”€ Format duration nicely â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const fmtDuration = (mins) => {
  if (!mins || mins <= 0) return '-';
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
  const [certificateTemplates, setCertificateTemplates] = useState([]);
  const [availableCountryCodes, setAvailableCountryCodes] = useState(['+91', '+1']);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');

  const [modal,     setModal]     = useState(null);
  const [target,    setTarget]    = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imagePreview, setImagePreview]           = useState(null);
  const [uploadingImage, setUploadingImage]       = useState(false);
  const imageInputRef                             = useRef(null);

  const [meetingForm, setMeetingForm]   = useState(EMPTY_MEETING_FORM);
  const [meetingError, setMeetingError] = useState('');
  const setMeetingField = (key, val) => { setMeetingForm(p => ({ ...p, [key]: val })); setMeetingError(''); };

  const [menu, setMenu] = useState(null);
  const [bulkLoadingId, setBulkLoadingId] = useState(null);
  const [regeneratingId, setRegeneratingId] = useState(null);

  // Live-calculated duration shown in the read-only field
  const calculatedDuration = useMemo(
    () => calcDuration(form.startTime, form.endTime),
    [form.startTime, form.endTime]
  );

  // ── Load ─────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [wRes, cRes, tRes, ccRes] = await Promise.all([
        webinarService.getAll(),
        categoryService.getAll(),
        certificateTemplateService.getAll().catch(() => ({ data: { success: false, data: [] } })),
        webinarService.getCountryCodes().catch(() => ({ data: { success: false, data: [] } })),
      ]);
      if (wRes.data.success) { setWebinars(wRes.data.data); setFiltered(wRes.data.data); }
      if (cRes.data.success)   setCategories(cRes.data.data);
      if (tRes.data?.success)  setCertificateTemplates(tRes.data.data);
      if (ccRes.data?.success && Array.isArray(ccRes.data.data) && ccRes.data.data.length > 0) {
        setAvailableCountryCodes(ccRes.data.data);
      }
    } catch {
      toast.error('Failed to load webinars');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Pagination State ─────────────────────────────────
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q ? webinars.filter(w =>
            w.webinarName.toLowerCase().includes(q) ||
            w.categoryName.toLowerCase().includes(q) ||
            w.conductorName.toLowerCase().includes(q))
        : webinars
    );
    setPage(1);
  }, [search, webinars]);

  // ── Paginated Webinars ────────────────────────────────
  const paginatedWebinars = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // ── Menu ─────────────────────────────────────────────
  const openMenu  = (e, row) => {
    if (row?.isCompleted) return;
    setMenu({ anchorEl: e.currentTarget, row });
  };
  const closeMenu = ()       => setMenu(null);

  // ── Helpers ──────────────────────────────────────────
  const setField = (key, val) => { setForm(p => ({ ...p, [key]: val })); setFormError(''); };

  const toISOLocal = (d) => formatUtcToLocalDateDDMMYYYY(d);

  const fmtTime = (d) => formatUtcToLocalTimeOnly(d);

  // Extract local "HH:mm" from stored UTC datetime string
  const toTimeOnly = (d) => formatUtcToLocalTime24(d);

  // Extract local "YYYY-MM-DD" from stored UTC datetime string
  const toInputDate = (d) => formatUtcToLocalDateInput(d);

  // ── Modals ───────────────────────────────────────────
  const openCreate = () => {
    setSelectedImageFile(null);
    setImagePreview(null);
    const initialCode = availableCountryCodes.length > 0 ? availableCountryCodes[0] : '+91';
    setForm({
      ...EMPTY_FORM,
      selectedCountries: [initialCode],
      countryPrices: { [initialCode]: '' },
    });
    setFormError('');
    setModal('create');
  };

  const openEdit = async (row) => {
    setTarget(row);
    setSelectedImageFile(null);
    setImagePreview(row.imageUrl ? getFullWebinarImageUrl(row.imageUrl) : null);

    let selected = [];
    let pricesMap = {};

    try {
      const pRes = await webinarService.getWebinarPrices(row.id);
      if (pRes.data?.success && Array.isArray(pRes.data.data) && pRes.data.data.length > 0) {
        pRes.data.data.forEach(p => {
          selected.push(p.countryCode);
          pricesMap[p.countryCode] = String(p.amount);
        });
      }
    } catch (err) {
      console.error('Failed to load country prices for webinar', err);
    }

    if (selected.length === 0 && row.isPaid) {
      const fallbackCode = availableCountryCodes.length > 0 ? availableCountryCodes[0] : '+91';
      selected = [fallbackCode];
      pricesMap[fallbackCode] = row.price != null ? String(row.price) : '';
    }

    setForm({
      webinarName:       row.webinarName,
      categoryId:        String(row.categoryId),
      certificateTempId: row.certificateTempId ? String(row.certificateTempId) : '',
      webinarDate:       toInputDate(row.startTime || row.webinarDate),
      startTime:         toTimeOnly(row.startTime),
      endTime:           toTimeOnly(row.endTime),
      conductorName:     row.conductorName,
      conductorPhone:    row.conductorPhone ?? '',
      conductorEmail:    row.conductorEmail ?? '',
      participantLimit:  String(row.participantLimit),
      isPaid:            row.isPaid,
      price:             row.price != null ? String(row.price) : '',
      imageUrl:          row.imageUrl || '',
      selectedCountries: selected,
      countryPrices:    pricesMap,
    });
    setFormError('');
    setModal('edit');
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Only JPG, PNG, and WEBP formats are supported.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Webinar banner size must be under 10MB.');
      return;
    }

    setSelectedImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const openDelete = (row) => { setTarget(row); setModal('delete'); };

  const openScheduleMeeting = async (row) => {
    setTarget(row);
    setMeetingError('');
    const randomMeetingId = generateRandomMeetingId();
    const randomModeratorPW = generateRandomMeetingId();
    const randomAttendeePW = generateRandomMeetingId();
    const defaults = {
      ...EMPTY_MEETING_FORM,
      webinarId: row.id,
      name: row.webinarName || '',
      meetingID: randomMeetingId,
      maxParticipants: row.participantLimit || 100,
      duration: row.durationMinutes || 60,
      moderatorPW: randomModeratorPW,
      attendeePW: randomAttendeePW,
    };
    setMeetingForm(defaults);
    setModal('schedule');

    try {
      const res = await meetingService.getByWebinarId(row.id);
      if (res.data?.success && res.data?.data) {
        const m = res.data.data;
        setMeetingForm({
          webinarId: m.webinarId,
          name: m.name || row.webinarName,
          meetingID: m.meetingID || randomMeetingId,
          maxParticipants: m.maxParticipants || row.participantLimit,
          duration: m.duration || row.durationMinutes,
          record: Boolean(m.record),
          autoStartRecording: Boolean(m.autoStartRecording),
          allowStartStopRecording: m.allowStartStopRecording !== undefined ? Boolean(m.allowStartStopRecording) : true,
          logoutURL: m.logoutURL || '',
          meetingExpireIfNoUserJoinedInMinutes: m.meetingExpireIfNoUserJoinedInMinutes ?? 10,
          meetingExpireWhenLastUserLeftInMinutes: m.meetingExpireWhenLastUserLeftInMinutes ?? 1,
          endWhenNoModerator: Boolean(m.endWhenNoModerator),
          guestPolicy: m.guestPolicy || 'ALWAYS_ACCEPT',
          muteOnStart: m.muteOnStart !== undefined ? Boolean(m.muteOnStart) : true,
          meetingLayout: m.meetingLayout || 'UNIFIED_LAYOUT',
          lockSettingsPresenterPolicy: m.lockSettingsPresenterPolicy || 'default',
          moderatorPW: m.moderatorPW || randomModeratorPW,
          attendeePW: m.attendeePW || randomAttendeePW,
        });
      }
    } catch {
      // keep defaults
    }
  };

  const handleScheduleSubmit = async () => {
    setMeetingError('');
    if (!meetingForm.name?.trim()) {
      setMeetingError('Meeting name is required.');
      return;
    }
    if (!meetingForm.meetingID?.trim()) {
      setMeetingError('Meeting ID is required.');
      return;
    }
    if (!meetingForm.maxParticipants || Number(meetingForm.maxParticipants) <= 0) {
      setMeetingError('Max participants must be greater than 0.');
      return;
    }
    if (!meetingForm.duration || Number(meetingForm.duration) <= 0) {
      setMeetingError('Duration must be greater than 0.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        webinarId: Number(meetingForm.webinarId),
        meetingID: meetingForm.meetingID.trim(),
        name: meetingForm.name.trim(),
        maxParticipants: Number(meetingForm.maxParticipants),
        duration: Number(meetingForm.duration),
        record: Boolean(meetingForm.record),
        autoStartRecording: Boolean(meetingForm.autoStartRecording),
        allowStartStopRecording: Boolean(meetingForm.allowStartStopRecording),
        logoutURL: meetingForm.logoutURL?.trim() || null,
        meetingExpireIfNoUserJoinedInMinutes: Number(meetingForm.meetingExpireIfNoUserJoinedInMinutes) || 10,
        meetingExpireWhenLastUserLeftInMinutes: Number(meetingForm.meetingExpireWhenLastUserLeftInMinutes) || 1,
        endWhenNoModerator: Boolean(meetingForm.endWhenNoModerator),
        guestPolicy: meetingForm.guestPolicy || 'ALWAYS_ACCEPT',
        muteOnStart: Boolean(meetingForm.muteOnStart),
        meetingLayout: meetingForm.meetingLayout || 'UNIFIED_LAYOUT',
        lockSettingsPresenterPolicy: meetingForm.lockSettingsPresenterPolicy || 'default',
        moderatorPW: meetingForm.moderatorPW?.trim() || null,
        attendeePW: meetingForm.attendeePW?.trim() || null,
      };

      const res = await meetingService.schedule(payload);
      if (res.data?.success) {
        toast.success(res.data.message || 'Meeting scheduled successfully!');
        closeModal();
        try {
          await load();
        } catch {
          // ignore refresh error
        }
      } else {
        const errorMsg = res.data?.message || 'Failed to schedule meeting.';
        setMeetingError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to schedule meeting.';
      setMeetingError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const closeModal = () => {
    setModal(null);
    setTarget(null);
    setSaving(false);
    setUploadingImage(false);
    setSelectedImageFile(null);
    setImagePreview(null);
    setMeetingError('');
  };

  // â”€â”€ Validate & build payload â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    if (form.isPaid) {
      if (!form.selectedCountries || form.selectedCountries.length === 0) {
        return { err: 'Please select at least one country for pricing' };
      }
      for (const code of form.selectedCountries) {
        const countryName = getCountryNameFromCode(code);
        const amt = form.countryPrices?.[code];
        if (amt === undefined || amt === '' || isNaN(Number(amt)) || Number(amt) <= 0) {
          return { err: `Please enter a valid price (> 0) for ${countryName} (${code})` };
        }
      }
    }

    // Parse user's selected date and time using their local system timezone (no hardcoded offset)
    const [year, month, day] = form.webinarDate.split('-').map(Number);
    const [startH, startM]   = form.startTime.split(':').map(Number);
    const [endH, endM]       = form.endTime.split(':').map(Number);

    // new Date(y, m-1, d, h, m) creates a Date in the user's local operating system timezone
    const localStart = new Date(year, month - 1, day, startH, startM, 0);
    const localEnd   = new Date(year, month - 1, day, endH, endM, 0);

    // .toISOString() automatically converts the user's system local time into UTC with 'Z' suffix
    const startDateTime = localStart.toISOString();
    const endDateTime   = localEnd.toISOString();

    const countryPricesPayload = form.isPaid
      ? form.selectedCountries.map(code => ({
          countryCode: code,
          amount: Number(form.countryPrices[code])
        }))
      : [];

    const basePrice = form.isPaid && countryPricesPayload.length > 0
      ? countryPricesPayload[0].amount
      : null;

    return {
      payload: {
        webinarName:       form.webinarName.trim(),
        categoryId:        Number(form.categoryId),
        certificateTempId: form.certificateTempId ? Number(form.certificateTempId) : null,
        durationMinutes:   duration,
        webinarDate:       form.webinarDate,
        startTime:         startDateTime,
        endTime:           endDateTime,
        conductorName:     form.conductorName.trim(),
        conductorPhone:    form.conductorPhone.trim() || null,
        conductorEmail:    form.conductorEmail.trim() || null,
        participantLimit:  Number(form.participantLimit),
        isPaid:            form.isPaid,
        price:             basePrice,
        countryPrices:     countryPricesPayload,
        imageUrl:          form.imageUrl || null,
      }
    };
  };

  // â”€â”€ Create â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleCreate = async () => {
    setFormError('');
    const { err, payload } = buildPayload();
    if (err) return setFormError(err);
    setSaving(true);
    try {
      let finalImageUrl = form.imageUrl || null;
      if (selectedImageFile) {
        setUploadingImage(true);
        const uploadRes = await webinarService.uploadImage(selectedImageFile);
        if (uploadRes.data?.success && uploadRes.data?.url) {
          finalImageUrl = uploadRes.data.url;
        }
      }
      payload.imageUrl = finalImageUrl;

      const res = await webinarService.create(payload);
      if (res.data.success) {
        toast.success('Webinar created');
        closeModal();
        load();
      } else {
        const errorMsg = res.data.message || 'Creation failed';
        setFormError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (e) {
      const errorMsg = e.response?.data?.message || e.message || 'An error occurred';
      setFormError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSaving(false);
      setUploadingImage(false);
    }
  };

  // â”€â”€ Update â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleEdit = async () => {
    setFormError('');
    const { err, payload } = buildPayload();
    if (err) return setFormError(err);
    setSaving(true);
    try {
      let finalImageUrl = form.imageUrl || null;
      if (selectedImageFile) {
        setUploadingImage(true);
        // Pass existing image URL so the backend deletes the old image file from WebinarImages
        const uploadRes = await webinarService.uploadImage(selectedImageFile, form.imageUrl);
        if (uploadRes.data?.success && uploadRes.data?.url) {
          finalImageUrl = uploadRes.data.url;
        }
      }
      payload.imageUrl = finalImageUrl;

      const res = await webinarService.update(target.id, payload);
      if (res.data.success) {
        toast.success('Webinar updated');
        closeModal();
        load();
      } else {
        const errorMsg = res.data.message || 'Update failed';
        setFormError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (e) {
      const errorMsg = e.response?.data?.message || e.message || 'An error occurred';
      setFormError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSaving(false);
      setUploadingImage(false);
    }
  };

  // â”€â”€ Delete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleDelete = async () => {
    setSaving(true);
    try {
      const res = await webinarService.delete(target.id);
      if (res.data.success) { toast.success('Webinar deleted'); closeModal(); load(); }
      else toast.error(res.data.message || 'Delete failed');
    } catch { toast.error('Failed to delete webinar');
    } finally { setSaving(false); }
  };

  // â”€â”€ Share Link â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleCopyShareLink = (w) => {
    const link = `${window.location.origin}/webinar-registration?trackingId=${w.shareId || w.id}`;
    navigator.clipboard.writeText(link);
    toast.success('Registration link copied to clipboard!');
  };

  // â”€â”€ Bulk Invite â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleBulkInvite = async (w) => {
    setBulkLoadingId(w.id);
    try {
      const res = await webinarService.bulkInvite(w.id);
      if (res.data?.success) {
        // Point 1: Toast: "Invites queued successfully for X users!"
        toast.success(res.data.message || `Invites queued successfully for ${res.data.count} users!`);
        // Point 3: Monitor until all emails for this webinar are sent, then show confirmation snackbar!
        startEmailStatusMonitoring(w.id, w.webinarName);
      } else {
        toast.error(res.data?.message || 'Failed to queue bulk invites');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error sending bulk invites');
    } finally {
      setBulkLoadingId(null);
    }
  };

  const startEmailStatusMonitoring = (webinarId, webinarName) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await webinarService.getEmailStatus(webinarId);
        if (res.data?.success && res.data.isFinished) {
          clearInterval(interval);
          // Point 3: Confirmation snack to admin at UI like emails sent successfully
          toast.success(`All bulk invitation emails for "${webinarName}" have been sent successfully!`, {
            duration: 6000,
            icon: 'ðŸ“¨'
          });
        } else if (attempts >= 60) {
          clearInterval(interval);
        }
      } catch {
        clearInterval(interval);
      }
    }, 5000);
  };

  // â”€â”€ Regenerate Moderator Link â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleRegenerateLink = async (w) => {
    setRegeneratingId(w.id);
    const toastId = toast.loading(`Regenerating moderator link for "${w.webinarName}"...`);
    try {
      const res = await meetingService.regenerateModeratorLink(w.id);
      if (res.data?.success && res.data?.moderatorJoinUrl) {
        const newUrl = res.data.moderatorJoinUrl;
        setWebinars(prev => prev.map(item => item.id === w.id ? { ...item, moderatorJoinUrl: newUrl, isMeetingCreated: true } : item));
        setFiltered(prev => prev.map(item => item.id === w.id ? { ...item, moderatorJoinUrl: newUrl, isMeetingCreated: true } : item));
        toast.success('Moderator link regenerated successfully!', { id: toastId });
      } else {
        toast.error(res.data?.message || 'Failed to regenerate moderator link.', { id: toastId });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Error regenerating moderator link.', { id: toastId });
    } finally {
      setRegeneratingId(null);
    }
  };

  // â”€â”€ Shared styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Table cell styles (compact so all columns fit the page width) â”€â”€
  const headCellSx = {
    fontSize: '11px', fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase',
    letterSpacing: '0.4px', py: 1.5, px: 1.25, whiteSpace: 'nowrap',
    overflow: 'hidden', textOverflow: 'ellipsis',
  };
  const bodyCellSx = { px: 1.25, py: 1.5, overflow: 'hidden', verticalAlign: 'middle' };

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  return (
    <Box>
      {/* â”€â”€ Header â”€â”€ */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: colors.primary }}>Webinars</Typography>
          <Typography sx={{ fontSize: '13px', color: colors.textMuted, mt: 0.5 }}>
            Manage webinars - create, edit and delete
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
      <CustomSearchBar value={search} onChange={setSearch} placeholder="Search by name, category, conductor..." sx={{ mb: 2.5 }} />

      {/* â”€â”€ Table â”€â”€ */}
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
          <>
            <TableContainer sx={{ width: '100%', overflowX: 'auto' }}>
            {/* Fixed layout = columns share the available width, so the table fits the page
                instead of scrolling. It only scrolls on very small screens (minWidth). */}
            <Table sx={{ width: '100%', tableLayout: 'fixed', minWidth: 980 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: colors.surfaceAlt }}>
                  <TableCell sx={{ ...headCellSx, width: '3%' }}>#</TableCell>
                  <TableCell sx={{ ...headCellSx, width: '15%' }}>Webinar</TableCell>
                  <TableCell sx={{ ...headCellSx, width: '13%' }}>Category</TableCell>
                  <TableCell sx={{ ...headCellSx, width: '15%' }}>Date &amp; Time</TableCell>
                  <TableCell sx={{ ...headCellSx, width: '14%' }}>Conductor</TableCell>
                  <TableCell sx={{ ...headCellSx, width: '7%' }}>
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                      <PeopleAltOutlinedIcon sx={{ fontSize: 14, color: colors.textMuted }} />
                      Regs.
                    </Box>
                  </TableCell>
                  <TableCell sx={{ ...headCellSx, width: '7%' }}>Limit</TableCell>
                  <TableCell sx={{ ...headCellSx, width: '8%' }}>Price</TableCell>
                  <TableCell sx={{ ...headCellSx, width: '13%' }}>Status</TableCell>
                  <TableCell sx={{ ...headCellSx, width: '5%', textAlign: 'center' }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedWebinars.map((w, idx) => {
                  const itemIndex = (page - 1) * pageSize + idx + 1;
                  return (
                    <TableRow key={w.id} sx={{ '&:hover': { bgcolor: colors.surfaceAlt }, transition: 'background 0.1s', '&:last-child td': { borderBottom: 0 } }}>
                      <TableCell sx={{ ...bodyCellSx, fontSize: '13px', color: colors.textMuted }}>{itemIndex}</TableCell>

                    {/* Webinar */}
                    <TableCell sx={bodyCellSx}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                        <Box sx={{ width: 30, height: 30, borderRadius: 1.5, bgcolor: colors.accentMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <VideoCallIcon sx={{ fontSize: 16, color: colors.accent }} />
                        </Box>
                        <Tooltip title={w.webinarName} placement="top-start">
                          <Typography sx={{ fontSize: '13px', fontWeight: 600, color: colors.primary, minWidth: 0 }} noWrap>
                            {w.webinarName}
                          </Typography>
                        </Tooltip>
                      </Box>
                    </TableCell>

                    {/* Category + certificate */}
                    <TableCell sx={bodyCellSx}>
                      <Typography sx={{ fontSize: '13px', color: colors.textSecondary }} noWrap>{w.categoryName}</Typography>
                      {w.certificateTemplateName ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.4, minWidth: 0 }}>
                          <WorkspacePremiumIcon sx={{ fontSize: 13, color: colors.accent, flexShrink: 0 }} />
                          <Typography sx={{ fontSize: '11px', color: colors.accent, fontWeight: 500 }} noWrap>
                            {w.certificateTemplateName}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography sx={{ fontSize: '10.5px', color: colors.textMuted, mt: 0.4 }} noWrap>
                          Default Certificate
                        </Typography>
                      )}
                    </TableCell>

                    {/* Date + Time + Duration in ONE column */}
                    <TableCell sx={bodyCellSx}>
                      <Typography sx={{ fontSize: '13px', fontWeight: 600, color: colors.textSecondary, whiteSpace: 'nowrap' }}>
                        {toISOLocal(w.startTime || w.webinarDate)}
                      </Typography>
                      <Typography sx={{ fontSize: '11.5px', color: colors.textMuted, mt: 0.3, whiteSpace: 'nowrap' }}>
                        {fmtTime(w.startTime)} - {fmtTime(w.endTime)}
                      </Typography>
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, mt: 0.4, color: colors.textMuted }}>
                        <TimerIcon sx={{ fontSize: 12 }} />
                        <Typography sx={{ fontSize: '11px', color: colors.textMuted }}>{fmtDuration(w.durationMinutes)}</Typography>
                      </Box>
                    </TableCell>

                    {/* Conductor */}
                    <TableCell sx={bodyCellSx}>
                      <Typography sx={{ fontSize: '13px', color: colors.textSecondary }} noWrap>{w.conductorName}</Typography>
                      {w.conductorEmail && (
                        <Tooltip title={w.conductorEmail} placement="bottom-start">
                          <Typography sx={{ fontSize: '11px', color: colors.textMuted }} noWrap>{w.conductorEmail}</Typography>
                        </Tooltip>
                      )}
                    </TableCell>

                    {/* ── Regs. Count Badge ── */}
                    <TableCell sx={bodyCellSx}>
                      {(() => {
                        const hasRegs = (w.registrationCount || 0) > 0;
                        return (
                          <Chip
                            label={w.registrationCount || 0}
                            size="small"
                            sx={{
                              bgcolor: hasRegs ? 'rgba(234, 179, 8, 0.14)' : colors.surfaceAlt,
                              color: hasRegs ? '#b45309' : colors.textMuted,
                              border: hasRegs ? '1px solid rgba(234, 179, 8, 0.35)' : `1px solid ${colors.border}`,
                              fontWeight: 700,
                              fontSize: '12px',
                              borderRadius: '999px',
                              px: 0.5,
                              height: 24,
                              minWidth: 32
                            }}
                          />
                        );
                      })()}
                    </TableCell>

                    <TableCell sx={{ ...bodyCellSx, fontSize: '13px', color: colors.textSecondary }}>{w.participantLimit}</TableCell>
                    <TableCell sx={bodyCellSx}>
                      {w.isPaid ? (
                        w.countryPrices && w.countryPrices.length > 0 ? (
                          <Tooltip
                            title={
                              <Box sx={{ p: 0.5 }}>
                                <Typography sx={{ fontSize: '11px', fontWeight: 800, color: '#16a34a', mb: 0.75, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                                  Country Pricing
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                                  {w.countryPrices.map((cp) => {
                                    const cName = getCountryNameFromCode(cp.countryCode);
                                    const cObj = getCountryFromCode(cp.countryCode);
                                    const flag = cObj?.flag || getFlagEmoji(cObj?.iso2) || '🌐';
                                    const sym = getCurrencySymbolFromCountryCode(cp.countryCode);
                                    return (
                                      <Box key={cp.countryCode} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600, color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: 0.6 }}>
                                          <span style={{ fontSize: '14px' }}>{flag}</span> {cName} ({cp.countryCode})
                                        </Typography>
                                        <Typography sx={{ fontSize: '12.5px', fontWeight: 800, color: colors.primary }}>
                                          {sym}{cp.amount}
                                        </Typography>
                                      </Box>
                                    );
                                  })}
                                </Box>
                              </Box>
                            }
                            arrow
                            slotProps={{
                              tooltip: {
                                sx: {
                                  bgcolor: colors.surface,
                                  color: colors.primary,
                                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12), 0 8px 10px -6px rgba(0,0,0,0.08)',
                                  border: `1px solid ${colors.border}`,
                                  borderRadius: '10px',
                                  p: 1.25,
                                  minWidth: 200
                                }
                              },
                              arrow: {
                                sx: {
                                  color: colors.surface,
                                  '&::before': {
                                    border: `1px solid ${colors.border}`
                                  }
                                }
                              }
                            }}
                          >
                            <Chip
                              label={
                                w.countryPrices.length === 1
                                  ? `${getCurrencySymbolFromCountryCode(w.countryPrices[0].countryCode)}${w.countryPrices[0].amount}`
                                  : `${getCurrencySymbolFromCountryCode(w.countryPrices[0].countryCode)}${w.countryPrices[0].amount} (${w.countryPrices.length} countries)`
                              }
                              size="small"
                              sx={{
                                fontSize: '11px',
                                fontWeight: 700,
                                bgcolor: 'rgba(34,197,94,0.12)',
                                color: colors.success,
                                cursor: 'pointer',
                              }}
                            />
                          </Tooltip>
                        ) : (
                          <Chip label={`₹${w.price}`} size="small" sx={{ fontSize: '11px', fontWeight: 700, bgcolor: 'rgba(34,197,94,0.12)', color: colors.success }} />
                        )
                      ) : (
                        <Chip label="Free" size="small" sx={{ fontSize: '11px', fontWeight: 700, bgcolor: colors.surfaceAlt, color: colors.textMuted }} />
                      )}
                    </TableCell>

                    {/* Status / quick actions */}
                    <TableCell sx={bodyCellSx}>
                      {Boolean(w.isCompleted) ? (
                        <Chip
                          label="Completed"
                          size="small"
                          sx={{
                            bgcolor: 'rgba(147, 51, 234, 0.12)',
                            color: '#9333EA',
                            fontWeight: 700,
                            fontSize: '11px',
                            borderRadius: 1.5,
                            py: 0.2
                          }}
                        />
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                            <Tooltip title="Copy Share Link">
                              <IconButton size="small" onClick={() => handleCopyShareLink(w)} sx={{ color: colors.accent, '&:hover': { bgcolor: colors.accentMuted } }}>
                                <ContentCopyIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Send Bulk Invite">
                              <IconButton
                                size="small"
                                onClick={() => handleBulkInvite(w)}
                                disabled={bulkLoadingId === w.id}
                                sx={{ color: colors.primary, '&:hover': { bgcolor: colors.surfaceAlt } }}
                              >
                                {bulkLoadingId === w.id ? (
                                  <CircularProgress size={16} sx={{ color: colors.primary }} />
                                ) : (
                                  <SendIcon sx={{ fontSize: 16 }} />
                                )}
                              </IconButton>
                            </Tooltip>
                          </Box>
                          {Boolean(w.isMeetingCreated) && w.moderatorJoinUrl ? (
                            <Button
                              variant="contained"
                              size="small"
                              disabled={regeneratingId === w.id}
                              startIcon={regeneratingId === w.id ? <CircularProgress size={14} color="inherit" /> : <VideoCallIcon sx={{ fontSize: 16 }} />}
                              onClick={() => window.open(w.moderatorJoinUrl, '_blank', 'noopener,noreferrer')}
                              sx={{
                                bgcolor: colors.success,
                                color: '#fff',
                                '&:hover': { bgcolor: '#16a34a' },
                                fontSize: '11px',
                                fontWeight: 700,
                                textTransform: 'none',
                                py: 0.4,
                                px: 1.2,
                                borderRadius: 1.5,
                                whiteSpace: 'nowrap',
                                boxShadow: 'none',
                              }}
                            >
                              {regeneratingId === w.id ? 'Regenerating...' : 'Join Webinar'}
                            </Button>
                          ) : null}
                        </Box>
                      )}
                    </TableCell>

                    <TableCell sx={{ ...bodyCellSx, textAlign: 'center' }}>
                      {isSuperAdmin && !w.isCompleted ? (
                        <Tooltip title="Actions">
                          <IconButton size="small" onClick={e => openMenu(e, w)} sx={{ color: colors.textMuted, '&:hover': { color: colors.primary } }}>
                            <MoreVertIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
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

      {/* â”€â”€ 3-dot menu (only for active/upcoming webinars) â”€â”€ */}
      <Menu
        anchorEl={menu?.anchorEl}
        open={Boolean(menu) && !menu?.row?.isCompleted}
        onClose={closeMenu}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          elevation: 3,
          sx: { borderRadius: 2, minWidth: 150, border: `1px solid ${colors.border}`, bgcolor: colors.surface, mt: 0.5,
            '& .MuiMenuItem-root': { fontSize: '13.5px', py: 1, px: 2, gap: 1 } },
        }}
      >
        <MenuItem onClick={() => { closeMenu(); handleCopyShareLink(menu.row); }} sx={{ color: colors.accent }}>
          <ListItemIcon sx={{ minWidth: 'unset' }}><ContentCopyIcon sx={{ fontSize: 16, color: colors.accent }} /></ListItemIcon>
          Copy Share Link
        </MenuItem>
        <MenuItem onClick={() => { closeMenu(); handleBulkInvite(menu.row); }} sx={{ color: colors.primary }}>
          <ListItemIcon sx={{ minWidth: 'unset' }}><SendIcon sx={{ fontSize: 16, color: colors.primary }} /></ListItemIcon>
          Send Bulk Invite
        </MenuItem>
        <Divider sx={{ borderColor: colors.border, my: 0.5 }} />
        {Boolean(menu?.row?.isMeetingCreated) && menu?.row?.moderatorJoinUrl && (
          <>
            <MenuItem
              onClick={() => {
                const url = menu.row.moderatorJoinUrl;
                closeMenu();
                window.open(url, '_blank', 'noopener,noreferrer');
              }}
              sx={{ color: colors.success, fontWeight: 600 }}
            >
              <ListItemIcon sx={{ minWidth: 'unset' }}><VideoCallIcon sx={{ fontSize: 16, color: colors.success }} /></ListItemIcon>
              Join as Moderator
            </MenuItem>
            <MenuItem
              onClick={() => {
                const row = menu.row;
                closeMenu();
                handleRegenerateLink(row);
              }}
              disabled={regeneratingId === menu.row.id}
              sx={{ color: colors.primary, fontWeight: 500 }}
            >
              <ListItemIcon sx={{ minWidth: 'unset' }}>
                <AutorenewIcon sx={{ fontSize: 16, color: colors.primary }} />
              </ListItemIcon>
              Regenerate link
            </MenuItem>
          </>
        )}
        <MenuItem onClick={() => { closeMenu(); openScheduleMeeting(menu.row); }} sx={{ color: colors.primary }}>
          <ListItemIcon sx={{ minWidth: 'unset' }}><CalendarMonthIcon sx={{ fontSize: 16, color: colors.accent }} /></ListItemIcon>
          Schedule Meeting
        </MenuItem>
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

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          CREATE / EDIT MODAL
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
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

          {/* Webinar Thumbnail / Cover Image Upload */}
          <Box sx={{ mb: 2.5 }}>
            <Label text="Webinar Cover Image" />
            <Box
              sx={{
                p: 2,
                borderRadius: '16px',
                border: '1.5px dashed',
                borderColor: imagePreview ? colors.accent : colors.border,
                bgcolor: colors.surfaceAlt,
                display: 'flex',
                alignItems: 'center',
                gap: 2.5,
                transition: 'border-color 0.2s',
              }}
            >
              {/* Preview Thumbnail Box */}
              <Box
                sx={{
                  width: 90,
                  height: 64,
                  borderRadius: '12px',
                  bgcolor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}
              >
                {imagePreview ? (
                  <Box
                    component="img"
                    src={imagePreview}
                    alt="Webinar Preview"
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <ImageIcon sx={{ fontSize: 32, color: colors.textMuted }} />
                )}
              </Box>

              {/* Upload Controls & Instructions */}
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary, mb: 0.25 }}>
                  {imagePreview ? 'Cover Image Selected' : 'Upload Webinar Thumbnail'}
                </Typography>
                <Typography sx={{ fontSize: '11.5px', color: colors.textMuted, mb: 1 }}>
                  PNG, JPG, or WEBP up to 10MB (stored in WebinarImages folder)
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <input
                    type="file"
                    ref={imageInputRef}
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    onChange={handleImageSelect}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<CloudUploadIcon sx={{ fontSize: 16 }} />}
                    onClick={() => imageInputRef.current?.click()}
                    sx={{
                      borderRadius: '10px',
                      textTransform: 'none',
                      fontSize: '12px',
                      fontWeight: 650,
                      borderColor: colors.accent,
                      color: colors.accent,
                      py: 0.4,
                      px: 1.5,
                      '&:hover': {
                        borderColor: colors.accent,
                        bgcolor: 'rgba(236, 145, 9, 0.08)',
                      },
                    }}
                  >
                    {imagePreview ? 'Change Image' : 'Select Image'}
                  </Button>

                  {imagePreview && (
                    <Button
                      size="small"
                      color="inherit"
                      onClick={() => {
                        setSelectedImageFile(null);
                        setImagePreview(null);
                        setField('imageUrl', '');
                        if (imageInputRef.current) imageInputRef.current.value = '';
                      }}
                      sx={{
                        borderRadius: '10px',
                        textTransform: 'none',
                        fontSize: '12px',
                        color: colors.textMuted,
                        py: 0.4,
                        px: 1.25,
                        '&:hover': { color: colors.error },
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Row 1 â€” Webinar Name + Category */}
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

          {/* Row 2 â€” Certificate Template + Webinar Date + Participant Limit */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Box sx={{ flex: 1.2 }}>
              <Label text="Certificate Template" />
              <TextField fullWidth size="small" select value={form.certificateTempId}
                onChange={e => setField('certificateTempId', e.target.value)} sx={inputSx}
                SelectProps={{
                  displayEmpty: true,
                  renderValue: (selected) => {
                    if (!selected) {
                      return (
                        <Typography sx={{ fontSize: '13px', color: colors.textMuted }}>
                          Select certificate template
                        </Typography>
                      );
                    }
                    const found = certificateTemplates.find(t => String(t.id) === String(selected));
                    return found ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <WorkspacePremiumIcon sx={{ fontSize: 16, color: colors.accent }} />
                        <Typography sx={{ fontSize: '13px' }}>{found.certificateName}</Typography>
                      </Box>
                    ) : selected;
                  }
                }}
              >
                <MenuItem value="">
                  <Typography sx={{ fontSize: '13px', color: colors.textMuted, fontStyle: 'italic' }}>
                    None (Default Certificate)
                  </Typography>
                </MenuItem>
                {certificateTemplates.map(t => (
                  <MenuItem key={t.id} value={String(t.id)}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <WorkspacePremiumIcon sx={{ fontSize: 16, color: colors.accent }} />
                      <Typography sx={{ fontSize: '13px', fontWeight: 500 }}>{t.certificateName}</Typography>
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            <Box sx={{ flex: 1 }}>
              <CustomDatePicker
                label="Webinar Date"
                starStyle={{ color: colors.error }}
                value={form.webinarDate}
                onChange={e => setField('webinarDate', e.target.value)}
                inputStyle={inputSx}
              />
            </Box>
            <Box sx={{ flex: 0.9 }}>
              <Label text="Participant Limit" required />
              <TextField fullWidth size="small" type="number" placeholder="e.g. 100"
                value={form.participantLimit} onChange={e => setField('participantLimit', e.target.value)}
                inputProps={{ min: 1 }} sx={inputSx} />
            </Box>
          </Box>

          {/* Row 3 â€” Start Time + End Time + Duration (auto) */}
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
              {/* Read-only - calculated automatically */}
              <TextField
                fullWidth size="small"
                value={calculatedDuration ? fmtDuration(calculatedDuration) : '-'}
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

          {/* Row 4 â€” Conductor Name + Phone + Email */}
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

          {/* Row 5 — IsPaid toggle + Multi-Country Localized Pricing */}
          <Box sx={{ mb: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.isPaid}
                  onChange={e => {
                    const checked = e.target.checked;
                    setField('isPaid', checked);
                    if (checked && (!form.selectedCountries || form.selectedCountries.length === 0)) {
                      const initialCode = availableCountryCodes.length > 0 ? availableCountryCodes[0] : '+91';
                      setForm(p => ({
                        ...p,
                        isPaid: true,
                        selectedCountries: [initialCode],
                        countryPrices: { ...(p.countryPrices || {}), [initialCode]: p.countryPrices?.[initialCode] || '' },
                      }));
                    }
                  }}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: colors.accent },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: colors.accent },
                  }}
                />
              }
              label={
                <Typography sx={{ fontSize: '13px', fontWeight: 600, color: colors.textSecondary }}>
                  Paid Webinar
                </Typography>
              }
            />

            {form.isPaid && (
              <Box sx={{ mt: 2, p: 2.2, bgcolor: colors.surfaceAlt, borderRadius: 2.5, border: `1px solid ${colors.border}` }}>
                {/* Country Multi-Select Dropdown with Checkboxes */}
                <Box sx={{ mb: 2 }}>
                  <Label text="Select Pricing Countries" required />
                  <FormControl fullWidth size="small" sx={inputSx}>
                    <Select
                      multiple
                      value={form.selectedCountries || []}
                      onChange={e => {
                        const val = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
                        setForm(p => {
                          const newPrices = { ...(p.countryPrices || {}) };
                          val.forEach(c => {
                            if (newPrices[c] === undefined) newPrices[c] = '';
                          });
                          return {
                            ...p,
                            selectedCountries: val,
                            countryPrices: newPrices,
                          };
                        });
                        setFormError('');
                      }}
                      renderValue={selected => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                          {selected.map(code => {
                            const countryName = getCountryNameFromCode(code);
                            const countryObj  = getCountryFromCode(code);
                            const flag        = countryObj?.flag || getFlagEmoji(countryObj?.iso2) || '🌐';
                            return (
                              <Chip
                                key={code}
                                label={`${flag} ${countryName} (${code})`}
                                size="small"
                                sx={{
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  bgcolor: 'rgba(255, 122, 0, 0.12)',
                                  color: colors.accent,
                                  borderRadius: 1.5,
                                }}
                              />
                            );
                          })}
                        </Box>
                      )}
                    >
                      {Array.from(new Set([...availableCountryCodes, ...(form.selectedCountries || []), '+91', '+1'])).map(code => {
                        const countryName = getCountryNameFromCode(code);
                        const countryObj  = getCountryFromCode(code);
                        const flag        = countryObj?.flag || getFlagEmoji(countryObj?.iso2) || '🌐';
                        const currSymbol  = getCurrencySymbolFromCountryCode(code);
                        const isChecked   = (form.selectedCountries || []).includes(code);

                        return (
                          <MenuItem key={code} value={code} sx={{ py: 1 }}>
                            <Checkbox checked={isChecked} size="small" sx={{ mr: 1, '&.Mui-checked': { color: colors.accent } }} />
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, width: '100%' }}>
                              <Typography sx={{ fontSize: 18 }}>{flag}</Typography>
                              <Typography sx={{ fontSize: 13, fontWeight: 600, color: colors.primary, flex: 1 }}>
                                {countryName} ({code})
                              </Typography>
                              <Chip
                                label={`Currency: ${currSymbol}`}
                                size="small"
                                sx={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  bgcolor: 'rgba(0,0,0,0.06)',
                                  color: colors.textSecondary,
                                  height: 22,
                                }}
                              />
                            </Box>
                          </MenuItem>
                        );
                      })}
                    </Select>
                  </FormControl>
                </Box>

                {/* Dynamic Price Inputs for Every Selected Country */}
                {form.selectedCountries && form.selectedCountries.length > 0 && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Typography sx={{ fontSize: '12px', fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Set Payment Amount for Selected Countries
                    </Typography>

                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                      {form.selectedCountries.map(code => {
                        const countryName = getCountryNameFromCode(code);
                        const countryObj  = getCountryFromCode(code);
                        const flag        = countryObj?.flag || getFlagEmoji(countryObj?.iso2) || '🌐';
                        const currSymbol  = getCurrencySymbolFromCountryCode(code);
                        const priceVal    = form.countryPrices?.[code] ?? '';

                        return (
                          <Box
                            key={code}
                            sx={{
                              p: 1.8,
                              borderRadius: 2,
                              bgcolor: colors.surface,
                              border: `1px solid ${colors.border}`,
                              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography sx={{ fontSize: 18 }}>{flag}</Typography>
                                <Typography sx={{ fontSize: '13px', fontWeight: 700, color: colors.primary }}>
                                  {countryName}
                                </Typography>
                              </Box>
                              <Chip
                                label={code}
                                size="small"
                                sx={{ fontSize: '11px', fontWeight: 600, bgcolor: colors.surfaceAlt, color: colors.textSecondary, height: 20 }}
                              />
                            </Box>

                            <Label text={`${countryName} Price (${currSymbol})`} required />
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              placeholder={`e.g. ${code === '+91' ? '299' : '4'}`}
                              value={priceVal}
                              onChange={e => {
                                const val = e.target.value;
                                setForm(p => ({
                                  ...p,
                                  countryPrices: {
                                    ...(p.countryPrices || {}),
                                    [code]: val,
                                  },
                                }));
                                setFormError('');
                              }}
                              inputProps={{ min: 0.01, step: '0.01' }}
                              InputProps={{
                                startAdornment: (
                                  <InputAdornment position="start">
                                    <Typography sx={{ fontSize: 15, fontWeight: 800, color: colors.accent }}>
                                      {currSymbol}
                                    </Typography>
                                  </InputAdornment>
                                ),
                              }}
                              sx={inputSx}
                            />
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                )}
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
            disabled={saving || uploadingImage}
            sx={{ bgcolor: colors.accent, color: colors.textOnAccent, '&:hover': { bgcolor: colors.accentDark }, fontWeight: 700, borderRadius: 2, minWidth: 120 }}
          >
            {saving || uploadingImage
              ? <CircularProgress size={18} sx={{ color: colors.textOnAccent }} />
              : modal === 'edit' ? 'Save Changes' : 'Create Webinar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          DELETE CONFIRM MODAL
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
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

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          SCHEDULE MEETING MODAL
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <Dialog
        open={modal === 'schedule'}
        onClose={closeModal}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: 'none' } }}
      >
        {/* Header */}
        <Box sx={{ px: 3.5, pt: 3, pb: 2, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: colors.accentMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CalendarMonthIcon sx={{ fontSize: 20, color: colors.accent }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '17px', color: colors.primary }}>
                Schedule Meeting
              </Typography>
              <Typography sx={{ fontSize: '12.5px', color: colors.textMuted, mt: 0.1 }}>
                Configure and schedule meeting settings for this webinar
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={closeModal} sx={{ color: colors.textMuted, mt: 0.25 }}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        <Divider sx={{ borderColor: colors.border }} />

        <DialogContent sx={{ px: 3.5, pt: 2.5, pb: 1 }}>
          {/* Row 1 â€” Meeting Name + Meeting ID */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Box sx={{ flex: 2 }}>
              <Label text="Meeting Name" required />
              <TextField
                fullWidth
                size="small"
                placeholder="e.g. Machine Learning Live Session"
                value={meetingForm.name}
                onChange={e => setMeetingField('name', e.target.value)}
                sx={inputSx}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Label text="Meeting ID (Generated)" required />
              <TextField
                fullWidth
                size="small"
                disabled
                value={meetingForm.meetingID}
                helperText="Auto-generated 8-character ID"
                FormHelperTextProps={{ sx: { fontSize: '11px', color: colors.textMuted } }}
                sx={readOnlySx}
              />
            </Box>
          </Box>

          {/* Row â€” Role Passwords (Generated) */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Label text="Moderator Password (Generated)" required />
              <TextField
                fullWidth
                size="small"
                disabled
                value={meetingForm.moderatorPW}
                helperText="Auto-generated role password for Moderator"
                FormHelperTextProps={{ sx: { fontSize: '11px', color: colors.textMuted } }}
                sx={readOnlySx}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Label text="Attendee Password (Generated)" required />
              <TextField
                fullWidth
                size="small"
                disabled
                value={meetingForm.attendeePW}
                helperText="Auto-generated role password for Students"
                FormHelperTextProps={{ sx: { fontSize: '11px', color: colors.textMuted } }}
                sx={readOnlySx}
              />
            </Box>
          </Box>

          {/* Row 2 â€” Max Participants + Duration + Logout URL */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Label text="Max Participants" required />
              <TextField
                fullWidth
                size="small"
                type="number"
                value={meetingForm.maxParticipants}
                onChange={e => setMeetingField('maxParticipants', e.target.value)}
                sx={inputSx}
                inputProps={{ min: 1 }}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Label text="Duration (Minutes)" required />
              <TextField
                fullWidth
                size="small"
                type="number"
                value={meetingForm.duration}
                onChange={e => setMeetingField('duration', e.target.value)}
                sx={inputSx}
                inputProps={{ min: 1 }}
              />
            </Box>
            <Box sx={{ flex: 1.5 }}>
              <Label text="Logout URL" />
              <TextField
                fullWidth
                size="small"
                placeholder="https://example.com/thanks"
                value={meetingForm.logoutURL}
                onChange={e => setMeetingField('logoutURL', e.target.value)}
                sx={inputSx}
              />
            </Box>
          </Box>

          {/* Row 3 â€” Expiry Settings */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Label text="Expire If No User Joined (Mins)" />
              <TextField
                fullWidth
                size="small"
                type="number"
                disabled
                value={meetingForm.meetingExpireIfNoUserJoinedInMinutes}
                helperText="Auto-calculated in backend (Default: 10 mins)"
                FormHelperTextProps={{ sx: { fontSize: '11px', color: colors.textMuted } }}
                sx={readOnlySx}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Label text="Expire When Last User Left (Mins)" />
              <TextField
                fullWidth
                size="small"
                type="number"
                value={meetingForm.meetingExpireWhenLastUserLeftInMinutes}
                onChange={e => setMeetingField('meetingExpireWhenLastUserLeftInMinutes', e.target.value)}
                sx={inputSx}
                inputProps={{ min: 0 }}
              />
            </Box>
          </Box>

          {/* Row 4 â€” Policies & Layout */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Label text="Guest Policy" />
              <TextField
                fullWidth
                size="small"
                select
                value={meetingForm.guestPolicy}
                onChange={e => setMeetingField('guestPolicy', e.target.value)}
                sx={inputSx}
              >
                <MenuItem value="ALWAYS_ACCEPT">ALWAYS_ACCEPT (Default)</MenuItem>
                <MenuItem value="ASK_MODERATOR">ASK_MODERATOR</MenuItem>
                <MenuItem value="ALWAYS_DENY">ALWAYS_DENY</MenuItem>
              </TextField>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Label text="Meeting Layout" />
              <TextField
                fullWidth
                size="small"
                select
                value={meetingForm.meetingLayout}
                onChange={e => setMeetingField('meetingLayout', e.target.value)}
                sx={inputSx}
              >
                <MenuItem value="UNIFIED_LAYOUT">UNIFIED_LAYOUT (Default)</MenuItem>
                <MenuItem value="SMART_LAYOUT">SMART_LAYOUT</MenuItem>
                <MenuItem value="PRESENTATION_FOCUS">PRESENTATION_FOCUS</MenuItem>
                <MenuItem value="VIDEO_FOCUS">VIDEO_FOCUS</MenuItem>
              </TextField>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Label text="Presenter Policy" />
              <TextField
                fullWidth
                size="small"
                select
                value={meetingForm.lockSettingsPresenterPolicy}
                onChange={e => setMeetingField('lockSettingsPresenterPolicy', e.target.value)}
                sx={inputSx}
              >
                <MenuItem value="default">Default</MenuItem>
                <MenuItem value="allow">Allow</MenuItem>
                <MenuItem value="deny">Deny</MenuItem>
              </TextField>
            </Box>
          </Box>

          {/* Row 5 â€” Flags & Toggles */}
          <Box
            sx={{
              p: 2,
              bgcolor: colors.surfaceAlt,
              borderRadius: 2,
              border: `1px solid ${colors.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              mb: 1.5,
            }}
          >
            <Typography sx={{ fontSize: '13px', fontWeight: 600, color: colors.primary }}>
              Meeting Rules & Recording
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' },
                gap: 1.5,
              }}
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={meetingForm.muteOnStart}
                    onChange={e => setMeetingField('muteOnStart', e.target.checked)}
                    color="primary"
                  />
                }
                label={<Typography sx={{ fontSize: '13px', color: colors.textSecondary }}>Mute On Start</Typography>}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={meetingForm.record}
                    onChange={e => setMeetingField('record', e.target.checked)}
                    color="primary"
                  />
                }
                label={<Typography sx={{ fontSize: '13px', color: colors.textSecondary }}>Record Meeting</Typography>}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={meetingForm.autoStartRecording}
                    onChange={e => setMeetingField('autoStartRecording', e.target.checked)}
                    color="primary"
                  />
                }
                label={<Typography sx={{ fontSize: '13px', color: colors.textSecondary }}>Auto Start Recording</Typography>}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={meetingForm.allowStartStopRecording}
                    onChange={e => setMeetingField('allowStartStopRecording', e.target.checked)}
                    color="primary"
                  />
                }
                label={<Typography sx={{ fontSize: '13px', color: colors.textSecondary }}>Allow Start/Stop Recording</Typography>}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={meetingForm.endWhenNoModerator}
                    onChange={e => setMeetingField('endWhenNoModerator', e.target.checked)}
                    color="primary"
                  />
                }
                label={<Typography sx={{ fontSize: '13px', color: colors.textSecondary }}>End When No Moderator</Typography>}
              />
            </Box>
          </Box>

          {meetingError && (
            <Typography sx={{ fontSize: '12px', color: colors.error, mt: 1 }}>{meetingError}</Typography>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3.5, pb: 3, pt: 2, gap: 1 }}>
          <Button onClick={closeModal} disabled={saving} sx={{ color: colors.textSecondary, fontWeight: 600, borderRadius: 2 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleScheduleSubmit}
            disabled={saving}
            sx={{
              bgcolor: colors.accent,
              color: colors.textOnAccent,
              '&:hover': { bgcolor: colors.accentDark },
              fontWeight: 700,
              borderRadius: 2,
              minWidth: 120,
            }}
          >
            {saving ? <CircularProgress size={18} sx={{ color: colors.textOnAccent }} /> : 'Schedule'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
