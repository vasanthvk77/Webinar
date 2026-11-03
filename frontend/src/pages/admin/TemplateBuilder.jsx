import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Divider,
  Card,
  CardMedia,
  CardContent,
  CardActions
} from '@mui/material';

import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CropIcon from '@mui/icons-material/Crop';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import AspectRatioIcon from '@mui/icons-material/AspectRatio';
import RefreshIcon from '@mui/icons-material/Refresh';
import DesignServicesIcon from '@mui/icons-material/DesignServices';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import EditIcon from '@mui/icons-material/Edit';
import LayersIcon from '@mui/icons-material/Layers';
import CalculateIcon from '@mui/icons-material/Calculate';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import OpenWithIcon from '@mui/icons-material/OpenWith';
import FormatPaintIcon from '@mui/icons-material/FormatPaint';
import CloseIcon from '@mui/icons-material/Close';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import PaletteIcon from '@mui/icons-material/Palette';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import toast from 'react-hot-toast';

import { certificateTemplateService, certificateService } from '../../services/api';
import { useThemeColors } from '../../context/ThemeContext';
import { validateImageFile } from '../../utils/imageCropper';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5270';

const resolveImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
};

// Canva-style Format Painter (Paint Roller) cursor for copying & pasting slot dimensions
const paintRollerCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Cg transform='rotate(-20 16 16)'%3E%3Crect x='6' y='4' width='18' height='8' rx='2.5' fill='%232563EB' stroke='%231D4ED8' stroke-width='1.5'/%3E%3Crect x='8' y='6' width='14' height='2' rx='1' fill='%2360A5FA'/%3E%3Cpath d='M15 12v4a3 3 0 0 1-3 3h-2v8a2 2 0 0 0 4 0v-8h1a3 3 0 0 0 3-3v-4' fill='none' stroke='%23334155' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3Crect x='12' y='21' width='4' height='7' rx='1.5' fill='%23F59E0B' stroke='%23B45309' stroke-width='1'/%3E%3C/g%3E%3C/svg%3E") 4 4, crosshair`;

export default function TemplateBuilder() {
  const colors = useThemeColors();

  // View mode: 'LIST' (existing templates) or 'BUILDER' (Canva-like editor)
  const [viewMode, setViewMode] = useState('LIST');

  // Existing templates list
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // Active template being edited (null = brand new template)
  const [activeTemplateId, setActiveTemplateId] = useState(null);
  const [certificateName, setCertificateName] = useState('Webinar Completion Certificate');

  // Canva-like: initially 0, dynamically adopted from uploaded image's native resolution
  const [backgroundUrl, setBackgroundUrl] = useState('');
  const [designWidth, setDesignWidth] = useState(0);
  const [designHeight, setDesignHeight] = useState(0);

  // Logo Slots array
  const [logoSlots, setLogoSlots] = useState([]);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [selectedSlotIds, setSelectedSlotIds] = useState([]);

  // Canva Marquee Drag Selection State
  const [marqueeBox, setMarqueeBox] = useState(null);
  const coordinatePlaneRef = useRef(null);
  const isMarqueeRef = useRef(false);

  // Canva Element Clipboard for Copy / Paste / Duplicate (Ctrl+C / Ctrl+V / Ctrl+D)
  const [copiedSlotElements, setCopiedSlotElements] = useState([]);
  const pasteOffsetRef = useRef(1);

  // Canva-style Format Painter (Copy Size / Dimensions) state
  const [copiedDimensions, setCopiedDimensions] = useState(null); // { width: number, height: number, sourceId: string }
  const [hoveredSlotId, setHoveredSlotId] = useState(null);

  // Saving state
  const [saving, setSaving] = useState(false);

  // Row Generator Form state (N logo slots formula: X_i = X_0 + i * (W + G))
  const [rowConfig, setRowConfig] = useState({
    count: 3,
    startX: 60,
    startY: 40,
    width: 140,
    height: 70,
    gapX: 25
  });

  // Slot Logo Upload Modal state (Canva Frame Mode - Original Preserved)
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [targetSlot, setTargetSlot] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [selectedLogoFile, setSelectedLogoFile] = useState(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState(null);
  const [originalFileName, setOriginalFileName] = useState('');

  // Canvas zoom & container reference
  const containerRef = useRef(null);
  const [canvasScale, setCanvasScale] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(100);

  // Hidden file input refs
  const bgFileInputRef = useRef(null);
  const logoFileInputRef = useRef(null);

  // ── Trigger browser download from blob ───────────────────
  const triggerBlobDownload = (blobData, filename) => {
    const url = window.URL.createObjectURL(new Blob([blobData], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadSamplePdf = async (tplId, tplName) => {
    const toastId = toast.loading('Generating QuestPDF sample...');
    try {
      const res = await certificateService.downloadPdf(tplId, {
        participantName: 'Vasanth Kumar',
        webinarName: 'Advanced Web Development',
        certificateId: `PDX-WB-${new Date().getFullYear()}-0001`
      });
      triggerBlobDownload(res.data, `${tplName || 'Certificate'}-Sample.pdf`);
      toast.success('Sample PDF downloaded! 🎓', { id: toastId });
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast.error('Failed to generate sample PDF', { id: toastId });
    }
  };

  // ── Load Templates List from API ─────────────────────────
  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res = await certificateTemplateService.getAll();
      if (res.data?.success) {
        setTemplates(res.data.data || []);
      }
    } catch (err) {
      console.error('Error loading certificate templates:', err);
      toast.error('Failed to load existing templates');
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // ── Auto-Scale Canvas to fit the Canva Workspace ─────────
  const updateCanvasFit = useCallback(() => {
    if (!containerRef.current || designWidth <= 0 || designHeight <= 0) {
      setCanvasScale(1);
      return;
    }
    const containerWidth = containerRef.current.clientWidth - 64;
    const containerHeight = containerRef.current.clientHeight - 64;

    const scaleX = containerWidth / designWidth;
    const scaleY = containerHeight > 200 ? containerHeight / designHeight : scaleX;
    const baseScale = Math.min(scaleX, scaleY, 1);

    setCanvasScale(Math.max(0.15, baseScale * (zoomLevel / 100)));
  }, [designWidth, designHeight, zoomLevel]);

  useEffect(() => {
    updateCanvasFit();
    window.addEventListener('resize', updateCanvasFit);
    return () => window.removeEventListener('resize', updateCanvasFit);
  }, [updateCanvasFit]);

  // ── Switch to Builder for New Template ───────────────────
  // Canvas width and height are initially 0; backgroundUrl is empty!
  const handleCreateNew = () => {
    setActiveTemplateId(null);
    setCertificateName('Webinar Completion Certificate');
    setBackgroundUrl('');
    setDesignWidth(0);
    setDesignHeight(0);
    setLogoSlots([]);
    setSelectedSlotId(null);
    setSelectedSlotIds([]);
    setRowConfig({
      count: 3,
      startX: 60,
      startY: 40,
      width: 140,
      height: 70,
      gapX: 25
    });
    setZoomLevel(100);
    setViewMode('BUILDER');
  };

  // ── Switch to Builder for Existing Template ──────────────
  const handleEditTemplate = (tpl) => {
    setActiveTemplateId(tpl.id);
    setCertificateName(tpl.certificateName || 'Certificate Template');
    setBackgroundUrl(tpl.templateImageUrl || '');

    if (tpl.logoConfiguration) {
      try {
        const config = JSON.parse(tpl.logoConfiguration);
        setDesignWidth(config.templateWidth || 0);
        setDesignHeight(config.templateHeight || 0);
        const parsedSlots = (config.logoSlots || []).map((s) => ({
          ...s,
          groupId: s.groupId || s.GroupId || null
        }));
        setLogoSlots(parsedSlots);
        if (parsedSlots.length > 0) {
          const first = parsedSlots[0];
          if (first.groupId) {
            setSelectedSlotIds(parsedSlots.filter((m) => m.groupId === first.groupId).map((m) => m.id));
          } else {
            setSelectedSlotIds([first.id]);
          }
          setSelectedSlotId(first.id);
        } else {
          setSelectedSlotId(null);
          setSelectedSlotIds([]);
        }
      } catch (e) {
        console.error('Failed to parse LogoConfiguration JSON:', e);
        setDesignWidth(0);
        setDesignHeight(0);
        setLogoSlots([]);
        setSelectedSlotId(null);
        setSelectedSlotIds([]);
      }
    } else {
      setDesignWidth(0);
      setDesignHeight(0);
      setLogoSlots([]);
      setSelectedSlotId(null);
      setSelectedSlotIds([]);
    }

    setZoomLevel(100);
    setViewMode('BUILDER');
  };

  // ── Handle Background Image Upload (Canva-style) ─────────
  const handleBackgroundUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file, 25 * 1024 * 1024);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    const toastId = toast.loading('Reading resolution & uploading template...');
    try {
      // 1. Read the original, native resolution of the uploaded image
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;

      await new Promise((resolve, reject) => {
        img.onload = () => {
          const natW = img.naturalWidth || img.width;
          const natH = img.naturalHeight || img.height;

          // Set canvas dimensions to the exact image dimensions!
          setDesignWidth(natW);
          setDesignHeight(natH);

          // Configure default slot proportions suited to this image's resolution
          const propW = Math.round(natW * 0.12);
          const propH = Math.round(propW * 0.5);
          const propX = Math.round(natW * 0.05);
          const propY = Math.round(natH * 0.05);
          const propGap = Math.round(natW * 0.02);

          const initialRow = {
            count: 3,
            startX: propX,
            startY: propY,
            width: propW,
            height: propH,
            gapX: propGap
          };
          setRowConfig(initialRow);

          // Generate initial 3 slots automatically so user sees them right away!
          const initialSlots = [];
          for (let i = 0; i < 3; i++) {
            initialSlots.push({
              id: `logo-${i + 1}`,
              x: Math.round(propX + i * (propW + propGap)),
              y: Math.round(propY),
              width: propW,
              height: propH,
              required: i === 0,
              aspectRatio: +(propW / propH).toFixed(2),
              imageUrl: null
            });
          }
          setLogoSlots(initialSlots);
          setSelectedSlotId('logo-1');

          // Show local preview immediately without waiting for server response
          setBackgroundUrl(objectUrl);
          resolve();
        };
        img.onerror = () => {
          reject(new Error('Failed to decode image dimensions'));
        };
      });

      const previousBg = backgroundUrl;

      // 2. Upload file to backend root Images folder
      const formData = new FormData();
      formData.append('file', file);
      if (previousBg && !previousBg.includes('CertificateTemplate1') && !previousBg.startsWith('blob:')) {
        formData.append('previousUrl', previousBg);
      }

      const res = await certificateTemplateService.uploadImage(formData);

      if (res.data?.success) {
        setBackgroundUrl(res.data.url);
        toast.success(`Template loaded (${img.naturalWidth} × ${img.naturalHeight}px)!`, { id: toastId });
      } else {
        toast.error(res.data?.message || 'Failed to upload background', { id: toastId });
      }
    } catch (err) {
      console.error('Error uploading background:', err);
      toast.error('Error processing template image', { id: toastId });
    } finally {
      e.target.value = '';
    }
  };

  // ── Live Update Row Config & Sync Directly to Canvas ────
  // ── Live Update Row Config & Sync Directly to Canvas ────
  const updateRowConfigField = (field, val) => {
    const num = val === '' ? '' : parseInt(val, 10);
    const parsed = isNaN(num) || num === '' ? 0 : num;
    const updated = { ...rowConfig, [field]: val === '' ? '' : parsed };
    setRowConfig(updated);

    const count = Math.max(1, Math.min(20, parseInt(updated.count, 10) || 1));
    const width = Math.max(10, parseInt(updated.width, 10) || 50);
    const height = Math.max(10, parseInt(updated.height, 10) || 25);
    const gapX = parseInt(updated.gapX, 10) || 0;
    const startX = parseInt(updated.startX, 10) || 0;
    const startY = parseInt(updated.startY, 10) || 0;

    // Dynamically update canvas slots in real time as user types!
    setLogoSlots((prev) => {
      const newSlots = [];
      for (let i = 0; i < count; i++) {
        const x = Math.round(startX + i * (width + gapX));
        const y = Math.round(startY);
        const prevSlot = prev[i];
        newSlots.push({
          id: prevSlot ? prevSlot.id : `logo-${i + 1}`,
          x,
          y,
          width: Math.round(width),
          height: Math.round(height),
          required: i === 0,
          aspectRatio: +(width / height).toFixed(2),
          imageUrl: prevSlot ? prevSlot.imageUrl : null
        });
      }
      return newSlots;
    });
  };

  const handleGenerateRow = () => {
    updateRowConfigField('count', rowConfig.count || 3);
    toast.success('Slots aligned in row');
  };

  // ── Canva Transform Handler (Move + 8-Direction Resizing) ──
  const handleTransformMouseDown = (e, slotId, handleType) => {
    e.stopPropagation();
    e.preventDefault();

    const slot = logoSlots.find((s) => s.id === slotId);
    if (!slot) return;

    // Determine which slots to move:
    // If slot is grouped, all members of that group move in unison!
    // If slot is part of a multi-selection, all selected slots move together!
    let movingSlotIds = [slotId];
    if (slot.groupId) {
      movingSlotIds = logoSlots.filter((s) => s.groupId === slot.groupId).map((s) => s.id);
      setSelectedSlotIds(movingSlotIds);
      setSelectedSlotId(slotId);
    } else if (selectedSlotIds.includes(slotId) && selectedSlotIds.length > 1) {
      movingSlotIds = [...selectedSlotIds];
      setSelectedSlotId(slotId);
    } else {
      setSelectedSlotIds([slotId]);
      setSelectedSlotId(slotId);
    }

    const startClientX = e.clientX;
    const startClientY = e.clientY;

    const initialPositions = logoSlots
      .filter((s) => movingSlotIds.includes(s.id))
      .map((s) => ({
        id: s.id,
        startX: s.x,
        startY: s.y,
        startW: s.width,
        startH: s.height
      }));

    const slotInitial = initialPositions.find((item) => item.id === slotId) || {
      startX: slot.x,
      startY: slot.y,
      startW: slot.width,
      startH: slot.height
    };
    const baseAspect = slotInitial.startW / (slotInitial.startH || 1);

    const onMouseMove = (moveEvent) => {
      const dx = (moveEvent.clientX - startClientX) / canvasScale;
      const dy = (moveEvent.clientY - startClientY) / canvasScale;

      if (handleType === 'move') {
        // Move all slots in the group / selection together!
        setLogoSlots((prev) =>
          prev.map((s) => {
            const init = initialPositions.find((item) => item.id === s.id);
            if (init) {
              return {
                ...s,
                x: Math.round(Math.max(0, init.startX + dx)),
                y: Math.round(Math.max(0, init.startY + dy))
              };
            }
            return s;
          })
        );

        // LIVE UPDATE rowConfig if logo-1 is among the moving slots
        const logo1Init = initialPositions.find((item) => item.id === 'logo-1');
        if (logo1Init) {
          setRowConfig((prev) => ({
            ...prev,
            startX: Math.round(Math.max(0, logo1Init.startX + dx)),
            startY: Math.round(Math.max(0, logo1Init.startY + dy))
          }));
        }
      } else {
        // Handle 8-point resize on the specific active slot
        let newX = slotInitial.startX;
        let newY = slotInitial.startY;
        let newW = slotInitial.startW;
        let newH = slotInitial.startH;

        if (handleType === 'n') {
          const maxShift = slotInitial.startH - 20;
          const clampedDy = Math.min(dy, maxShift);
          newY = Math.round(Math.max(0, slotInitial.startY + clampedDy));
          newH = Math.round(slotInitial.startH - (newY - slotInitial.startY));
        } else if (handleType === 's') {
          newH = Math.round(Math.max(20, slotInitial.startH + dy));
        } else if (handleType === 'w') {
          const maxShift = slotInitial.startW - 20;
          const clampedDx = Math.min(dx, maxShift);
          newX = Math.round(Math.max(0, slotInitial.startX + clampedDx));
          newW = Math.round(slotInitial.startW - (newX - slotInitial.startX));
        } else if (handleType === 'e') {
          newW = Math.round(Math.max(20, slotInitial.startW + dx));
        } else if (handleType === 'se') {
          const scaleX = (slotInitial.startW + dx) / slotInitial.startW;
          const scaleY = (slotInitial.startH + dy) / slotInitial.startH;
          const scale = Math.max(0.1, (scaleX + scaleY) / 2);
          newW = Math.round(Math.max(30, slotInitial.startW * scale));
          newH = Math.round(newW / baseAspect);
        } else if (handleType === 'sw') {
          const scaleX = (slotInitial.startW - dx) / slotInitial.startW;
          const scaleY = (slotInitial.startH + dy) / slotInitial.startH;
          const scale = Math.max(0.1, (scaleX + scaleY) / 2);
          newW = Math.round(Math.max(30, slotInitial.startW * scale));
          newH = Math.round(newW / baseAspect);
          newX = Math.round(slotInitial.startX + (slotInitial.startW - newW));
        } else if (handleType === 'ne') {
          const scaleX = (slotInitial.startW + dx) / slotInitial.startW;
          const scaleY = (slotInitial.startH - dy) / slotInitial.startH;
          const scale = Math.max(0.1, (scaleX + scaleY) / 2);
          newW = Math.round(Math.max(30, slotInitial.startW * scale));
          newH = Math.round(newW / baseAspect);
          newY = Math.round(slotInitial.startY + (slotInitial.startH - newH));
        } else if (handleType === 'nw') {
          const scaleX = (slotInitial.startW - dx) / slotInitial.startW;
          const scaleY = (slotInitial.startH - dy) / slotInitial.startH;
          const scale = Math.max(0.1, (scaleX + scaleY) / 2);
          newW = Math.round(Math.max(30, slotInitial.startW * scale));
          newH = Math.round(newW / baseAspect);
          newX = Math.round(slotInitial.startX + (slotInitial.startW - newW));
          newY = Math.round(slotInitial.startY + (slotInitial.startH - newH));
        }

        setLogoSlots((prev) =>
          prev.map((s) =>
            s.id === slotId
              ? {
                  ...s,
                  x: newX,
                  y: newY,
                  width: newW,
                  height: newH,
                  aspectRatio: +(newW / newH).toFixed(2)
                }
              : s
          )
        );

        setRowConfig((prev) => {
          if (slotId === 'logo-1') {
            return { ...prev, startX: newX, startY: newY, width: newW, height: newH };
          } else {
            return { ...prev, width: newW, height: newH };
          }
        });
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // ── Canva Rubber-Band / Marquee Drag Multi-Selection ─────
  const handlePlaneMouseDown = (e) => {
    if (copiedDimensions) return;
    // Allow left-click (0) or right-click (2) to initiate marquee selection drag
    if (e.button !== 0 && e.button !== 2) return;

    const rect = coordinatePlaneRef.current?.getBoundingClientRect();
    if (!rect) return;

    const startX = (e.clientX - rect.left) / canvasScale;
    const startY = (e.clientY - rect.top) / canvasScale;

    let hasMoved = false;

    const onMouseMove = (moveEvent) => {
      const curX = (moveEvent.clientX - rect.left) / canvasScale;
      const curY = (moveEvent.clientY - rect.top) / canvasScale;

      const x = Math.round(Math.min(startX, curX));
      const y = Math.round(Math.min(startY, curY));
      const w = Math.round(Math.abs(curX - startX));
      const h = Math.round(Math.abs(curY - startY));

      if (w > 4 || h > 4) {
        hasMoved = true;
        isMarqueeRef.current = true;
        setMarqueeBox({ x, y, width: w, height: h });

        // Find intersecting / covered slots
        const covered = logoSlots.filter((slot) => {
          const slotRight = slot.x + slot.width;
          const slotBottom = slot.y + slot.height;
          const boxRight = x + w;
          const boxBottom = y + h;

          return !(
            slotRight < x ||
            slot.x > boxRight ||
            slotBottom < y ||
            slot.y > boxBottom
          );
        });

        const coveredIds = covered.map((s) => s.id);
        setSelectedSlotIds(coveredIds);
        if (coveredIds.length > 0) {
          setSelectedSlotId(coveredIds[0]);
        }
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      setMarqueeBox(null);
      setTimeout(() => {
        isMarqueeRef.current = false;
      }, 50);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // ── Generate 6-Character Unique Group ID ─────────────────
  const generateGroupId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let res = '';
    for (let i = 0; i < 6; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };

  // ── Group Selected Slots ─────────────────────────────────
  const handleGroupSelectedSlots = () => {
    const targets = selectedSlotIds.length >= 2 ? selectedSlotIds : [selectedSlotId].filter(Boolean);
    if (targets.length < 2) {
      toast.error('Select at least 2 slots to create a group');
      return;
    }

    const newGroupId = generateGroupId();
    setLogoSlots((prev) =>
      prev.map((s) => {
        if (targets.includes(s.id)) {
          return { ...s, groupId: newGroupId };
        }
        return s;
      })
    );

    setSelectedSlotIds(targets);
    toast.success(`Grouped ${targets.length} slots into Group #${newGroupId}!`, {
      icon: '🔗'
    });
  };

  // ── Ungroup Slots ─────────────────────────────────────────
  const handleUngroupSlots = (targetGroupId) => {
    const gid = targetGroupId || selectedSlot?.groupId;
    if (!gid) return;

    setLogoSlots((prev) =>
      prev.map((s) => {
        if (s.groupId === gid) {
          const updated = { ...s };
          delete updated.groupId;
          return { ...updated, groupId: null };
        }
        return s;
      })
    );

    toast.success(`Ungrouped slots from Group #${gid}`, {
      icon: '🔓'
    });
  };

  // ── Manual Add Single Slot ───────────────────────────────
  const handleAddSingleSlot = () => {
    const existingLogoNums = logoSlots
      .filter((s) => s.id && s.id.startsWith('logo-'))
      .map((s) => {
        const match = s.id.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      });
    const nextNum = (existingLogoNums.length > 0 ? Math.max(...existingLogoNums) : 0) + 1;
    const newId = `logo-${nextNum}`;
    const defW = rowConfig.width || 140;
    const defH = rowConfig.height || 70;
    const newSlot = {
      id: newId,
      type: 'slot',
      x: Math.round(rowConfig.startX + logoSlots.length * 30),
      y: Math.round(rowConfig.startY + logoSlots.length * 20),
      width: defW,
      height: defH,
      required: false,
      aspectRatio: +(defW / defH).toFixed(2),
      imageUrl: null,
      fitMode: 'cover',
      groupId: null
    };
    setLogoSlots((prev) => [...prev, newSlot]);
    setSelectedSlotId(newId);
    setSelectedSlotIds([newId]);
    toast.success(`Added new Slot: ${newId}!`, { icon: '🔲' });
  };

  // ── Add Text Element (Canva Style) ────────────────────────
  const handleAddTextElement = () => {
    const existingTextNums = logoSlots
      .filter((s) => s.id && s.id.startsWith('text-'))
      .map((s) => {
        const match = s.id.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      });
    const nextTextNum = (existingTextNums.length > 0 ? Math.max(...existingTextNums) : 0) + 1;
    const newId = `text-${nextTextNum}`;

    // Place text element nicely centered / offset
    const posX = Math.round((designWidth || 800) * 0.35);
    const posY = Math.round((designHeight || 600) * 0.35 + (logoSlots.length % 5) * 25);
    const defW = 320;
    const defH = 60;

    const newText = {
      id: newId,
      type: 'text',
      x: posX,
      y: posY,
      width: defW,
      height: defH,
      text: 'Heading Text',
      color: '#1E293B',
      bold: true,
      fontSize: 26,
      align: 'center',
      groupId: null
    };

    setLogoSlots((prev) => [...prev, newText]);
    setSelectedSlotId(newId);
    setSelectedSlotIds([newId]);
    toast.success(`Added Text Element: ${newId}!`, { icon: '🔤' });
  };

  // ── Update Selected Slot Coordinates / Dimensions / Properties ──
  const updateSelectedSlot = (field, value) => {
    if (!selectedSlotId) return;

    setLogoSlots((prev) =>
      prev.map((slot) => {
        if (slot.id === selectedSlotId) {
          if (field === 'fitMode' || field === 'text' || field === 'color' || field === 'align') {
            return { ...slot, [field]: value };
          }
          if (field === 'bold') {
            return { ...slot, bold: !!value };
          }
          const num = value === '' ? '' : parseInt(value, 10);
          const parsed = isNaN(num) || num === '' ? 0 : num;
          const updated = { ...slot, [field]: value === '' ? '' : parsed };
          if (field === 'width' || field === 'height') {
            const w = field === 'width' ? Math.max(10, parsed) : slot.width;
            const h = field === 'height' ? Math.max(10, parsed) : slot.height;
            updated.aspectRatio = h > 0 ? +(w / h).toFixed(2) : 1;
          }
          return updated;
        }
        return slot;
      })
    );

    // Keep rowConfig in sync
    setRowConfig((prev) => {
      const keyMap = { x: 'startX', y: 'startY', width: 'width', height: 'height' };
      const num = value === '' ? '' : parseInt(value, 10);
      const parsed = isNaN(num) || num === '' ? 0 : num;
      if (selectedSlotId === 'logo-1' && keyMap[field]) {
        return { ...prev, [keyMap[field]]: value === '' ? '' : parsed };
      }
      if (field === 'width' || field === 'height') {
        return { ...prev, [field]: value === '' ? '' : parsed };
      }
      return prev;
    });
  };

  // ── Canva Copy Slot Dimensions (Format Painter) ───────────
  const handleCopySlotDimensions = (slot, e) => {
    e?.stopPropagation();
    if (!slot) return;
    const dims = {
      width: slot.width,
      height: slot.height,
      sourceId: slot.id
    };
    setCopiedDimensions(dims);

    // Copy to system clipboard as requested: H:{value}, W:{value}
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(`H:${slot.height}, W:${slot.width}`).catch(() => {});
    }

    toast.success(
      `Copied size from ${slot.id}: W:${slot.width}px, H:${slot.height}px. Click any slot to paste, or click Cancel.`,
      {
        icon: '🎨',
        duration: 4000
      }
    );
  };

  // ── Cancel Copy Mode ───────────────────────────────────────
  const handleCancelCopy = (e) => {
    e?.stopPropagation();
    setCopiedDimensions(null);
    setHoveredSlotId(null);
    toast('Format painter cancelled', { icon: '✖️' });
  };

  // ── Paste Slot Dimensions (Format Painter Target) ─────────
  const handlePasteSlotDimensions = (targetSlotId, e) => {
    e?.stopPropagation();
    if (!copiedDimensions) return;

    const { width, height } = copiedDimensions;
    const newAspect = height > 0 ? +(width / height).toFixed(2) : 1;

    setLogoSlots((prev) =>
      prev.map((s) => {
        if (s.id === targetSlotId) {
          return {
            ...s,
            width,
            height,
            aspectRatio: newAspect
          };
        }
        return s;
      })
    );

    // If pasting into logo-1, keep rowConfig in sync
    if (targetSlotId === 'logo-1') {
      setRowConfig((prev) => ({
        ...prev,
        width,
        height
      }));
    }

    setSelectedSlotId(targetSlotId);
    setCopiedDimensions(null);
    setHoveredSlotId(null);

    toast.success(`Pasted size (W:${width}px, H:${height}px) to ${targetSlotId}!`, {
      icon: '✨'
    });
  };

  // ── Canva Element Copy & Paste (Ctrl+C, Ctrl+V, Ctrl+D) ───
  const handleCopySelectedElements = () => {
    const targets = logoSlots.filter(
      (s) => selectedSlotIds.includes(s.id) || selectedSlotId === s.id
    );
    if (targets.length === 0) return;

    setCopiedSlotElements(targets.map((s) => ({ ...s })));
    pasteOffsetRef.current = 1;

    toast.success(
      `Copied ${targets.length === 1 ? targets[0].id : `${targets.length} slots`}! Press Ctrl+V to paste.`,
      {
        icon: '📋',
        duration: 2500
      }
    );
  };

  const handlePasteCopiedElements = () => {
    if (!copiedSlotElements || copiedSlotElements.length === 0) {
      if (selectedSlot) {
        handleDuplicateSelectedSlots();
      }
      return;
    }

    const offset = 24 * pasteOffsetRef.current;
    pasteOffsetRef.current += 1;

    let currentSlots = [...logoSlots];
    const existingLogoNums = currentSlots
      .filter((s) => !s.id || s.id.startsWith('logo-'))
      .map((s) => {
        const match = s.id?.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      });
    let nextLogoNum = (existingLogoNums.length > 0 ? Math.max(...existingLogoNums) : 0) + 1;

    const existingTextNums = currentSlots
      .filter((s) => s.id && s.id.startsWith('text-'))
      .map((s) => {
        const match = s.id?.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      });
    let nextTextNum = (existingTextNums.length > 0 ? Math.max(...existingTextNums) : 0) + 1;

    const hasGroup = copiedSlotElements.length > 1 && copiedSlotElements.some((s) => s.groupId);
    const newGroupForClone = hasGroup ? generateGroupId() : null;

    const newSlots = copiedSlotElements.map((srcSlot) => {
      const isText = srcSlot.type === 'text' || (srcSlot.id && srcSlot.id.startsWith('text-'));
      const newId = isText ? `text-${nextTextNum++}` : `logo-${nextLogoNum++}`;
      return {
        ...srcSlot,
        id: newId,
        type: isText ? 'text' : 'slot',
        x: Math.round(srcSlot.x + offset),
        y: Math.round(srcSlot.y + offset),
        groupId: srcSlot.groupId ? (newGroupForClone || generateGroupId()) : null
      };
    });

    setLogoSlots([...currentSlots, ...newSlots]);

    const newIds = newSlots.map((s) => s.id);
    setSelectedSlotIds(newIds);
    setSelectedSlotId(newIds[0]);

    toast.success(
      `Pasted ${newSlots.length === 1 ? newSlots[0].id : `${newSlots.length} elements`}!`,
      {
        icon: '✨'
      }
    );
  };

  const handleDuplicateSelectedSlots = () => {
    const targets = logoSlots.filter(
      (s) => selectedSlotIds.includes(s.id) || selectedSlotId === s.id
    );
    if (targets.length === 0) return;

    let currentSlots = [...logoSlots];
    const existingLogoNums = currentSlots
      .filter((s) => !s.id || s.id.startsWith('logo-'))
      .map((s) => {
        const match = s.id?.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      });
    let nextLogoNum = (existingLogoNums.length > 0 ? Math.max(...existingLogoNums) : 0) + 1;

    const existingTextNums = currentSlots
      .filter((s) => s.id && s.id.startsWith('text-'))
      .map((s) => {
        const match = s.id?.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      });
    let nextTextNum = (existingTextNums.length > 0 ? Math.max(...existingTextNums) : 0) + 1;

    const hasGroup = targets.length > 1 && targets.some((s) => s.groupId);
    const newGroupForClone = hasGroup ? generateGroupId() : null;

    const newSlots = targets.map((srcSlot) => {
      const isText = srcSlot.type === 'text' || (srcSlot.id && srcSlot.id.startsWith('text-'));
      const newId = isText ? `text-${nextTextNum++}` : `logo-${nextLogoNum++}`;
      return {
        ...srcSlot,
        id: newId,
        type: isText ? 'text' : 'slot',
        x: Math.round(srcSlot.x + 24),
        y: Math.round(srcSlot.y + 24),
        groupId: srcSlot.groupId ? (newGroupForClone || generateGroupId()) : null
      };
    });

    setLogoSlots([...currentSlots, ...newSlots]);

    const newIds = newSlots.map((s) => s.id);
    setSelectedSlotIds(newIds);
    setSelectedSlotId(newIds[0]);

    toast.success(
      `Duplicated ${newSlots.length === 1 ? newSlots[0].id : `${newSlots.length} slots`}!`,
      {
        icon: '📋'
      }
    );
  };

  // Keyboard Shortcuts (Escape, Ctrl+C, Ctrl+V, Ctrl+D)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Escape key cancels format painter mode
      if (e.key === 'Escape' && copiedDimensions) {
        setCopiedDimensions(null);
        setHoveredSlotId(null);
        toast('Format painter cancelled', { icon: '✖️' });
        return;
      }

      // Ignore shortcuts if user is typing in an input field
      const targetTag = e.target?.tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || e.target?.isContentEditable) {
        return;
      }

      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl) return;

      const key = e.key.toLowerCase();

      // Ctrl + C: Copy selected element(s)
      if (key === 'c') {
        const hasSelection = selectedSlotIds.length > 0 || selectedSlotId;
        if (hasSelection && viewMode === 'BUILDER') {
          e.preventDefault();
          handleCopySelectedElements();
        }
      }
      // Ctrl + V: Paste copied element(s) as new slot(s)
      else if (key === 'v') {
        if (viewMode === 'BUILDER') {
          e.preventDefault();
          handlePasteCopiedElements();
        }
      }
      // Ctrl + D: Duplicate selected element(s) directly
      else if (key === 'd') {
        const hasSelection = selectedSlotIds.length > 0 || selectedSlotId;
        if (hasSelection && viewMode === 'BUILDER') {
          e.preventDefault();
          handleDuplicateSelectedSlots();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [copiedDimensions, selectedSlotIds, selectedSlotId, logoSlots, copiedSlotElements, viewMode]);

  // ── Delete Slot ──────────────────────────────────────────
  const handleDeleteSlot = (slotId) => {
    const slot = logoSlots.find((s) => s.id === slotId);
    if (slot?.imageUrl && !slot.imageUrl.includes('CertificateTemplate1') && !slot.imageUrl.startsWith('blob:')) {
      certificateTemplateService.deleteImage(slot.imageUrl).catch(() => {});
    }
    setLogoSlots((prev) => prev.filter((s) => s.id !== slotId));
    if (selectedSlotId === slotId) setSelectedSlotId(null);
  };

  // ── Open Logo Upload Modal for a Slot ────────────────────
  const handleOpenSlotUpload = (slot, e) => {
    e?.stopPropagation();
    setTargetSlot(slot);
    setSelectedLogoFile(null);
    setLogoPreviewUrl(slot.imageUrl ? resolveImageUrl(slot.imageUrl) : null);
    setOriginalFileName('');
    setUploadModalOpen(true);
  };

  // ── Handle Logo File Selected (Original Preserved, Canva Frame Mask) ──
  const handleLogoFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file || !targetSlot) return;

    const validation = validateImageFile(file, 10 * 1024 * 1024);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setSelectedLogoFile(file);
    setOriginalFileName(file.name);
    const objectUrl = URL.createObjectURL(file);
    setLogoPreviewUrl(objectUrl);

    toast.success('Original image loaded! Will be saved as-is without cropping.', {
      icon: '🖼️'
    });
  };

  // ── Save Original Logo to Slot & Server Images Folder ────
  const handleConfirmLogoUpload = async () => {
    if (!targetSlot) return;

    if (!selectedLogoFile && !logoPreviewUrl) {
      toast.error('Please select an image file first.');
      return;
    }

    if (!selectedLogoFile && logoPreviewUrl) {
      setUploadModalOpen(false);
      return;
    }

    setUploadingLogo(true);
    const toastId = toast.loading('Uploading original image to Images folder...');
    try {
      const formData = new FormData();
      // Send the ORIGINAL untouched file as-is!
      formData.append('file', selectedLogoFile);
      if (targetSlot?.imageUrl && !targetSlot.imageUrl.includes('CertificateTemplate1') && !targetSlot.imageUrl.startsWith('blob:')) {
        formData.append('previousUrl', targetSlot.imageUrl);
      }

      const res = await certificateTemplateService.uploadImage(formData);
      if (res.data?.success) {
        const uploadedUrl = res.data.url;
        setLogoSlots((prev) =>
          prev.map((s) => (s.id === targetSlot.id ? { ...s, imageUrl: uploadedUrl, fitMode: s.fitMode || 'cover' } : s))
        );
        toast.success('Original image saved to Images folder as-is!', { id: toastId });
        setUploadModalOpen(false);
      } else {
        toast.error(res.data?.message || 'Failed to upload logo', { id: toastId });
      }
    } catch (err) {
      console.error('Error uploading logo:', err);
      toast.error('Failed to upload logo image', { id: toastId });
    } finally {
      setUploadingLogo(false);
    }
  };

  // ── Save Entire Certificate Template to Database ─────────
  const handleSaveTemplate = async () => {
    if (!certificateName.trim()) {
      toast.error('Please enter a certificate template name');
      return;
    }

    if (!backgroundUrl || designWidth <= 0 || designHeight <= 0) {
      toast.error('Please upload a template background image first');
      return;
    }

    setSaving(true);
    const toastId = toast.loading('Saving certificate template to database...');

    try {
      // Store templateWidth & templateHeight strictly in JSON
      const logoConfigurationObj = {
        templateWidth: designWidth,
        templateHeight: designHeight,
        backgroundUrl,
        logoSlots: logoSlots.map((s) => ({
          id: s.id,
          type: s.type || (s.id && s.id.startsWith('text-') ? 'text' : 'slot'),
          x: s.x,
          y: s.y,
          width: s.width,
          height: s.height,
          required: !!s.required,
          aspectRatio: s.aspectRatio,
          imageUrl: s.imageUrl || null,
          groupId: s.groupId || null,
          fitMode: s.fitMode || 'cover',
          text: s.text || null,
          color: s.color || null,
          bold: !!s.bold,
          fontSize: s.fontSize || null,
          align: s.align || null
        }))
      };

      const payload = {
        id: activeTemplateId || 0,
        certificateName: certificateName.trim(),
        templateImageUrl: backgroundUrl,
        logoCount: logoSlots.length,
        logoConfiguration: JSON.stringify(logoConfigurationObj)
      };

      let res;
      if (activeTemplateId) {
        res = await certificateTemplateService.update(activeTemplateId, payload);
      } else {
        res = await certificateTemplateService.create(payload);
      }

      if (res.data?.success) {
        toast.success('Certificate Template saved successfully! 🎓', { id: toastId });
        loadTemplates();
        setViewMode('LIST');
      } else {
        toast.error(res.data?.message || 'Failed to save template', { id: toastId });
      }
    } catch (err) {
      console.error('Error saving certificate template:', err);
      toast.error('An error occurred while saving the template', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  // ── Delete Template from DB ──────────────────────────────
  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this certificate template?')) return;
    try {
      const tpl = templates.find((t) => t.id === templateId);
      if (tpl?.templateImageUrl && !tpl.templateImageUrl.includes('CertificateTemplate1') && !tpl.templateImageUrl.startsWith('blob:')) {
        certificateTemplateService.deleteImage(tpl.templateImageUrl).catch(() => {});
      }
      const res = await certificateTemplateService.delete(templateId);
      if (res.data?.success) {
        toast.success('Certificate template deleted');
        loadTemplates();
      }
    } catch (err) {
      console.error('Error deleting template:', err);
      toast.error('Failed to delete template');
    }
  };

  const selectedSlot = logoSlots.find((s) => s.id === (selectedSlotId || selectedSlotIds[0]));
  const selectedSlotsList = logoSlots.filter((s) => selectedSlotIds.includes(s.id) || selectedSlotId === s.id);
  const isMultiSelected = selectedSlotsList.length > 1;
  const commonGroupId =
    selectedSlotsList.length > 0 &&
    selectedSlotsList.every((s) => s.groupId && s.groupId === selectedSlotsList[0].groupId)
      ? selectedSlotsList[0].groupId
      : null;

  const multiBoundingBox = isMultiSelected
    ? {
        minX: Math.min(...selectedSlotsList.map((s) => s.x)),
        minY: Math.min(...selectedSlotsList.map((s) => s.y)),
        maxX: Math.max(...selectedSlotsList.map((s) => s.x + s.width)),
        maxY: Math.max(...selectedSlotsList.map((s) => s.y + s.height))
      }
    : null;

  // ─────────────────────────────────────────────────────────
  // VIEW MODE A: EXISTING TEMPLATES GALLERY
  // ─────────────────────────────────────────────────────────
  if (viewMode === 'LIST') {
    return (
      <Box sx={{ maxWidth: 1400, mx: 'auto', pb: 6 }}>
        {/* Gallery Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3.5, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: '12px',
                  bgcolor: 'rgba(242,183,5,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#D97706'
                }}
              >
                <DesignServicesIcon sx={{ fontSize: 24 }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 800, color: colors.textPrimary, letterSpacing: '-0.3px' }}>
                Certificate Template Builder
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: colors.textSecondary }}>
              Upload custom certificate artwork, configure automated logo rows, and generate pixel-perfect QuestPDFs.
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadTemplates}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px' }}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateNew}
              sx={{
                bgcolor: '#F2B705',
                color: '#172338',
                fontWeight: 800,
                textTransform: 'none',
                borderRadius: '10px',
                px: 2.5,
                boxShadow: '0 4px 14px rgba(242,183,5,0.35)',
                '&:hover': { bgcolor: '#D9A404' }
              }}
            >
              Create New Template
            </Button>
          </Box>
        </Box>

        {/* Templates Grid */}
        {loadingTemplates ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 12, gap: 2 }}>
            <CircularProgress size={40} thickness={4} sx={{ color: '#F2B705' }} />
            <Typography variant="body2" sx={{ color: colors.textSecondary, fontWeight: 600 }}>
              Loading certificate templates...
            </Typography>
          </Box>
        ) : templates.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              p: 6,
              textAlign: 'center',
              borderRadius: '20px',
              bgcolor: colors.surface,
              border: `1.5px dashed ${colors.border}`,
              maxWidth: 620,
              mx: 'auto',
              mt: 4
            }}
          >
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                bgcolor: 'rgba(242,183,5,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2.5
              }}
            >
              <DesignServicesIcon sx={{ fontSize: 36, color: '#D97706' }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 800, color: colors.textPrimary, mb: 1 }}>
              No Certificate Templates Found
            </Typography>
            <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 3.5, lineHeight: 1.6 }}>
              You haven't created any certificate templates yet. Upload an image to start designing!
            </Typography>
            <Button
              variant="contained"
              size="large"
              startIcon={<AddIcon />}
              onClick={handleCreateNew}
              sx={{
                bgcolor: '#F2B705',
                color: '#172338',
                fontWeight: 800,
                textTransform: 'none',
                borderRadius: '12px',
                px: 3.5,
                py: 1.2,
                boxShadow: '0 6px 18px rgba(242,183,5,0.35)',
                '&:hover': { bgcolor: '#D9A404' }
              }}
            >
              Create First Template
            </Button>
          </Paper>
        ) : (
          <Grid container spacing={3}>
            {templates.map((tpl) => {
              let parsedConfig = null;
              try {
                parsedConfig = tpl.logoConfiguration ? JSON.parse(tpl.logoConfiguration) : null;
              } catch {
                parsedConfig = null;
              }

              const width = parsedConfig?.templateWidth || 'Dynamic';
              const height = parsedConfig?.templateHeight || 'Dynamic';

              return (
                <Grid item xs={12} sm={6} lg={4} key={tpl.id}>
                  <Card
                    elevation={0}
                    sx={{
                      borderRadius: '18px',
                      border: `1px solid ${colors.border}`,
                      bgcolor: colors.surface,
                      overflow: 'hidden',
                      transition: 'all 0.25s ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 12px 28px rgba(0,0,0,0.08)',
                        borderColor: '#F2B705'
                      }
                    }}
                  >
                    {/* Thumbnail */}
                    <Box sx={{ position: 'relative', height: 180, bgcolor: '#1E293B', overflow: 'hidden' }}>
                      <CardMedia
                        component="img"
                        height="180"
                        image={resolveImageUrl(tpl.templateImageUrl)}
                        alt={tpl.certificateName}
                        sx={{ objectFit: 'contain', bgcolor: '#0F172A' }}
                      />
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 10,
                          right: 10,
                          bgcolor: 'rgba(15, 23, 42, 0.75)',
                          backdropFilter: 'blur(6px)',
                          px: 1.2,
                          py: 0.35,
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.6
                        }}
                      >
                        <LayersIcon sx={{ fontSize: 14, color: '#FDE047' }} />
                        <Typography variant="caption" sx={{ color: '#FFFFFF', fontWeight: 800, fontSize: '0.72rem' }}>
                          {tpl.logoCount || 0} Logos
                        </Typography>
                      </Box>
                    </Box>

                    <CardContent sx={{ p: 2.2 }}>
                      <Typography variant="subtitle1" noWrap sx={{ fontWeight: 800, color: colors.textPrimary, mb: 0.5 }}>
                        {tpl.certificateName}
                      </Typography>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
                        <Chip
                          icon={<AspectRatioIcon sx={{ fontSize: '13px !important' }} />}
                          label={typeof width === 'number' ? `${width} × ${height} px` : 'Original Size'}
                          size="small"
                          sx={{ fontWeight: 700, fontSize: '0.72rem', height: 22 }}
                        />
                        <Chip
                          label="ACTIVE"
                          size="small"
                          sx={{
                            fontWeight: 800,
                            fontSize: '0.68rem',
                            height: 22,
                            bgcolor: '#DCFCE7',
                            color: '#166534'
                          }}
                        />
                      </Box>

                      <Typography variant="caption" sx={{ color: colors.textSecondary, display: 'block' }}>
                        Created by {tpl.createdByName || 'Admin'}
                      </Typography>
                    </CardContent>

                    <Divider sx={{ borderColor: colors.border }} />

                    <CardActions sx={{ p: 1.5, justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() => handleEditTemplate(tpl)}
                          sx={{ textTransform: 'none', fontWeight: 700, color: colors.primary }}
                        >
                          Open Editor
                        </Button>
                        <Button
                          size="small"
                          startIcon={<PictureAsPdfIcon sx={{ fontSize: '16px !important', color: '#DC2626' }} />}
                          onClick={() => handleDownloadSamplePdf(tpl.id, tpl.certificateName)}
                          sx={{ textTransform: 'none', fontWeight: 700, color: '#DC2626' }}
                        >
                          Sample PDF
                        </Button>
                      </Box>
                      <IconButton size="small" onClick={() => handleDeleteTemplate(tpl.id)} sx={{ color: colors.error }}>
                        <DeleteIcon sx={{ fontSize: 19 }} />
                      </IconButton>
                    </CardActions>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Box>
    );
  }

  // ─────────────────────────────────────────────────────────
  // VIEW MODE B: CANVA-STYLE DOTTED EDITABLE WORKSPACE
  // ─────────────────────────────────────────────────────────
  return (
    <Box sx={{ maxWidth: 1700, mx: 'auto', pb: 6 }}>
      {/* ── Hidden File Inputs ───────────────────────────── */}
      <input
        type="file"
        ref={bgFileInputRef}
        accept="image/png,image/jpeg,image/jpg,image/webp"
        style={{ display: 'none' }}
        onChange={handleBackgroundUpload}
      />
      <input
        type="file"
        ref={logoFileInputRef}
        accept="image/png,image/jpeg,image/jpg,image/webp"
        style={{ display: 'none' }}
        onChange={handleLogoFileSelect}
      />

      {/* ── Top Action Toolbar ────────────────────────────── */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: '16px',
          bgcolor: colors.surface,
          border: `1px solid ${colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ArrowBackIcon />}
            onClick={() => setViewMode('LIST')}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px' }}
          >
            Back to Templates
          </Button>

          <TextField
            size="small"
            value={certificateName}
            onChange={(e) => setCertificateName(e.target.value)}
            placeholder="Template Name"
            sx={{
              minWidth: 260,
              '& .MuiOutlinedInput-root': {
                fontWeight: 750,
                borderRadius: '10px',
                fontSize: '0.95rem'
              }
            }}
          />

          {designWidth > 0 && designHeight > 0 && (
            <Chip
              icon={<AspectRatioIcon sx={{ fontSize: '15px !important' }} />}
              label={`${designWidth} × ${designHeight} px (Original Image)`}
              size="small"
              sx={{ fontWeight: 800, bgcolor: colors.surfaceAlt, color: colors.textPrimary, height: 32 }}
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {/* Zoom Controller */}
          {designWidth > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: colors.surfaceAlt, p: 0.5, borderRadius: '10px' }}>
              <IconButton size="small" onClick={() => setZoomLevel((z) => Math.max(30, z - 10))}>
                <ZoomOutIcon sx={{ fontSize: 18 }} />
              </IconButton>
              <Typography variant="caption" sx={{ fontWeight: 800, minWidth: 44, textAlign: 'center' }}>
                {zoomLevel}%
              </Typography>
              <IconButton size="small" onClick={() => setZoomLevel((z) => Math.min(200, z + 10))}>
                <ZoomInIcon sx={{ fontSize: 18 }} />
              </IconButton>
              <IconButton size="small" onClick={() => setZoomLevel(100)} title="Reset Zoom">
                <CenterFocusStrongIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          )}

          {backgroundUrl && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<TextFieldsIcon sx={{ color: '#2563EB' }} />}
                onClick={handleAddTextElement}
                sx={{
                  textTransform: 'none',
                  fontWeight: 800,
                  borderRadius: '10px',
                  borderColor: 'rgba(37,99,235,0.4)',
                  color: '#2563EB',
                  bgcolor: 'rgba(37,99,235,0.06)',
                  '&:hover': { bgcolor: 'rgba(37,99,235,0.14)', borderColor: '#2563EB' }
                }}
              >
                Add Text
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon sx={{ color: '#2563EB' }} />}
                onClick={handleAddSingleSlot}
                sx={{
                  textTransform: 'none',
                  fontWeight: 800,
                  borderRadius: '10px',
                  borderColor: 'rgba(37,99,235,0.4)',
                  color: '#2563EB',
                  bgcolor: 'rgba(37,99,235,0.06)',
                  '&:hover': { bgcolor: 'rgba(37,99,235,0.14)', borderColor: '#2563EB' }
                }}
              >
                Add Slot
              </Button>
            </Box>
          )}

          {activeTemplateId && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<PictureAsPdfIcon sx={{ color: '#DC2626' }} />}
              onClick={() => handleDownloadSamplePdf(activeTemplateId, certificateName)}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px', borderColor: '#CBD5E1' }}
            >
              Test PDF
            </Button>
          )}

          <Button
            variant="contained"
            disabled={saving || !backgroundUrl}
            startIcon={saving ? <CircularProgress size={16} sx={{ color: '#172338' }} /> : <SaveIcon />}
            onClick={handleSaveTemplate}
            sx={{
              bgcolor: '#F2B705',
              color: '#f1f1f1ff',
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: '10px',
              px: 3,
              boxShadow: '0 4px 14px rgba(242,183,5,0.3)',
              '&:hover': { bgcolor: '#D9A404' }
            }}
          >
            {saving ? 'Saving...' : 'Save Template'}
          </Button>
        </Box>
      </Paper>

      {/* ── Canva Studio Flex Layout (Canvas on Left, Floating Inspector on Right) ── */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: 2.5,
          height: 'calc(100vh - 175px)',
          minHeight: 650,
          width: '100%',
          position: 'relative'
        }}
      >
        {/* Left Column: Canva-style Dotted Workspace */}
        <Paper
          elevation={0}
          ref={containerRef}
          sx={{
            flex: 1,
            height: '100%',
            minWidth: 0,
            borderRadius: '20px',
            bgcolor: colors.surface,
            border: `1px solid ${colors.border}`,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(#94A3B8 1.5px, transparent 1.5px)',
            backgroundSize: '22px 22px',
            position: 'relative',
            cursor: copiedDimensions ? paintRollerCursor : 'default',
            p: 3
          }}
        >
          {/* Floating Canva Banner: Format Painter Active with Cancel Button */}
          {copiedDimensions && (
            <Box
              sx={{
                position: 'absolute',
                top: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 100,
                bgcolor: '#0F172A',
                color: '#FFFFFF',
                px: 2.2,
                py: 1,
                borderRadius: '30px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                border: '1px solid rgba(255, 255, 255, 0.15)',
                pointerEvents: 'auto'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FormatPaintIcon sx={{ color: '#38BDF8', fontSize: 20 }} />
                <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '12px' }}>
                  Copied: W:{copiedDimensions.width}px, H:{copiedDimensions.height}px
                </Typography>
                <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '11px', ml: 0.5 }}>
                  (Hover any slot & click to paste)
                </Typography>
              </Box>
              <Button
                size="small"
                variant="contained"
                onClick={handleCancelCopy}
                startIcon={<CloseIcon sx={{ fontSize: 15 }} />}
                sx={{
                  bgcolor: '#EF4444',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  textTransform: 'none',
                  borderRadius: '16px',
                  px: 1.5,
                  py: 0.3,
                  fontSize: '11px',
                  '&:hover': { bgcolor: '#DC2626' }
                }}
              >
                Cancel
              </Button>
            </Box>
          )}

          {/* If NO background uploaded yet: Show Canva Create / Upload Card */}
          {!backgroundUrl ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 480,
                width: '100%',
                p: 3
              }}
            >
              <Paper
                elevation={0}
                onClick={() => bgFileInputRef.current?.click()}
                sx={{
                  p: 6,
                  textAlign: 'center',
                  borderRadius: '24px',
                  bgcolor: colors.surface,
                  border: `2px dashed ${colors.border}`,
                  maxWidth: 580,
                  width: '100%',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
                  '&:hover': {
                    borderColor: '#F2B705',
                    transform: 'translateY(-3px)',
                    boxShadow: '0 16px 40px rgba(242,183,5,0.15)'
                  }
                }}
              >
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    bgcolor: 'rgba(242,183,5,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2.5
                  }}
                >
                  <CloudUploadIcon sx={{ fontSize: 42, color: '#D97706' }} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: colors.textPrimary, mb: 1 }}>
                  Upload Certificate Template
                </Typography>
                <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 3.5, maxWidth: 440, mx: 'auto', lineHeight: 1.6 }}>
                  Upload your white-label certificate design (PNG, JPG, or WEBP).
                  The workspace will automatically adopt the <strong>exact original height and width</strong> of your image.
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<CloudUploadIcon />}
                  sx={{
                    bgcolor: '#F2B705',
                    color: '#172338',
                    fontWeight: 800,
                    textTransform: 'none',
                    borderRadius: '12px',
                    px: 4,
                    py: 1.2,
                    boxShadow: '0 6px 18px rgba(242,183,5,0.3)',
                    '&:hover': { bgcolor: '#D9A404' }
                  }}
                >
                  Select Template Image
                </Button>
              </Paper>
            </Box>
          ) : (
            /* When Background Image IS uploaded: Render image at native resolution scaled to fit */
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%'
              }}
            >
              <Box
                sx={{
                  width: designWidth * canvasScale,
                  height: designHeight * canvasScale,
                  position: 'relative',
                  overflow: 'visible',
                  bgcolor: 'transparent',
                  border: 'none',
                  boxShadow: 'none',
                  transition: 'width 0.15s ease, height 0.15s ease'
                }}
              >
                {/* Fixed Coordinate Plane (Exact design units = image native resolution) */}
                <Box
                  ref={coordinatePlaneRef}
                  onMouseDown={handlePlaneMouseDown}
                  onContextMenu={(e) => {
                    if (isMarqueeRef.current) e.preventDefault();
                  }}
                  sx={{
                    width: designWidth,
                    height: designHeight,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    transform: `scale(${canvasScale})`,
                    transformOrigin: 'top left',
                    userSelect: 'none',
                    cursor: copiedDimensions ? paintRollerCursor : 'default'
                  }}
                >
                  {/* 1. The Uploaded Template Background Image */}
                  <Box
                    component="img"
                    src={resolveImageUrl(backgroundUrl)}
                    alt="Certificate Template"
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      display: 'block',
                      pointerEvents: 'none'
                    }}
                  />

                  {/* Canva Marquee Drag Selection Box */}
                  {marqueeBox && (
                    <Box
                      sx={{
                        position: 'absolute',
                        left: marqueeBox.x,
                        top: marqueeBox.y,
                        width: marqueeBox.width,
                        height: marqueeBox.height,
                        bgcolor: 'rgba(37, 99, 235, 0.14)',
                        border: '1.5px solid #2563EB',
                        borderRadius: '2px',
                        pointerEvents: 'none',
                        zIndex: 80
                      }}
                    />
                  )}

                  {/* Multi-Selection Bounding Box & Floating Canva Group Toolbar */}
                  {isMultiSelected && multiBoundingBox && !copiedDimensions && (
                    <>
                      <Box
                        sx={{
                          position: 'absolute',
                          left: multiBoundingBox.minX - 4,
                          top: multiBoundingBox.minY - 4,
                          width: (multiBoundingBox.maxX - multiBoundingBox.minX) + 8,
                          height: (multiBoundingBox.maxY - multiBoundingBox.minY) + 8,
                          border: '1.5px dashed #2563EB',
                          borderRadius: '6px',
                          bgcolor: 'rgba(37, 99, 235, 0.04)',
                          pointerEvents: 'none',
                          zIndex: 35
                        }}
                      />

                      <Box
                        sx={{
                          position: 'absolute',
                          top: Math.max(8, multiBoundingBox.minY - 44),
                          left: (multiBoundingBox.minX + multiBoundingBox.maxX) / 2,
                          transform: 'translateX(-50%)',
                          bgcolor: '#0F172A',
                          color: '#FFFFFF',
                          px: 1.5,
                          py: 0.6,
                          borderRadius: '8px',
                          boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.2,
                          zIndex: 70,
                          whiteSpace: 'nowrap',
                          border: '1px solid rgba(255,255,255,0.12)'
                        }}
                      >
                        {commonGroupId ? (
                          <>
                            <Chip
                              icon={<GroupWorkIcon sx={{ fontSize: '14px !important', color: '#60A5FA' }} />}
                              label={`Group: #${commonGroupId}`}
                              size="small"
                              sx={{
                                bgcolor: 'rgba(37, 99, 235, 0.25)',
                                color: '#93C5FD',
                                fontWeight: 800,
                                fontSize: '11px',
                                height: 22
                              }}
                            />
                            <Button
                              size="small"
                              variant="contained"
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUngroupSlots(commonGroupId);
                              }}
                              startIcon={<LinkOffIcon sx={{ fontSize: 15 }} />}
                              sx={{
                                fontWeight: 800,
                                fontSize: '11px',
                                textTransform: 'none',
                                py: 0.3,
                                px: 1.2,
                                borderRadius: '6px'
                              }}
                            >
                              Ungroup
                            </Button>
                          </>
                        ) : (
                          <>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: '#94A3B8', fontSize: '11px' }}>
                              {selectedSlotsList.length} slots covered
                            </Typography>
                            <Button
                              size="small"
                              variant="contained"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGroupSelectedSlots();
                              }}
                              startIcon={<GroupWorkIcon sx={{ fontSize: 16 }} />}
                              sx={{
                                bgcolor: '#2563EB',
                                color: '#FFFFFF',
                                fontWeight: 800,
                                fontSize: '11px',
                                textTransform: 'none',
                                py: 0.3,
                                px: 1.4,
                                borderRadius: '6px',
                                boxShadow: '0 2px 8px rgba(37,99,235,0.4)',
                                '&:hover': { bgcolor: '#1D4ED8' }
                              }}
                            >
                              Group
                            </Button>
                          </>
                        )}

                        <Button
                          size="small"
                          variant="outlined"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateSelectedSlots();
                          }}
                          startIcon={<ContentCopyIcon sx={{ fontSize: 13 }} />}
                          sx={{
                            color: '#FFFFFF',
                            borderColor: 'rgba(255,255,255,0.25)',
                            fontWeight: 800,
                            fontSize: '11px',
                            textTransform: 'none',
                            py: 0.3,
                            px: 1.2,
                            borderRadius: '6px',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
                          }}
                        >
                          Duplicate
                        </Button>
                      </Box>
                    </>
                  )}

                  {/* 2. Interactive Logo Slots with Canva Handles */}
                  {logoSlots.map((slot) => {
                    const isSelected = selectedSlotIds.includes(slot.id) || selectedSlotId === slot.id;
                    const isHoveredForPaste = copiedDimensions && hoveredSlotId === slot.id;

                    return (
                      <Box
                        key={slot.id}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          if (copiedDimensions) return;
                          if (slot.groupId) {
                            const groupSlotIds = logoSlots.filter((s) => s.groupId === slot.groupId).map((s) => s.id);
                            setSelectedSlotIds(groupSlotIds);
                            setSelectedSlotId(slot.id);
                          } else if (e.shiftKey) {
                            setSelectedSlotIds((prev) =>
                              prev.includes(slot.id) ? prev.filter((id) => id !== slot.id) : [...prev, slot.id]
                            );
                            setSelectedSlotId(slot.id);
                          } else {
                            setSelectedSlotIds([slot.id]);
                            setSelectedSlotId(slot.id);
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (copiedDimensions) {
                            handlePasteSlotDimensions(slot.id, e);
                          } else {
                            if (slot.groupId) {
                              const groupSlotIds = logoSlots.filter((s) => s.groupId === slot.groupId).map((s) => s.id);
                              setSelectedSlotIds(groupSlotIds);
                              setSelectedSlotId(slot.id);
                            } else if (e.shiftKey) {
                              setSelectedSlotIds((prev) =>
                                prev.includes(slot.id) ? prev.filter((id) => id !== slot.id) : [...prev, slot.id]
                              );
                              setSelectedSlotId(slot.id);
                            } else {
                              setSelectedSlotIds([slot.id]);
                              setSelectedSlotId(slot.id);
                            }
                          }
                        }}
                        onMouseEnter={() => {
                          if (copiedDimensions) setHoveredSlotId(slot.id);
                        }}
                        onMouseLeave={() => {
                          if (copiedDimensions) setHoveredSlotId(null);
                        }}
                        sx={{
                          position: 'absolute',
                          left: slot.x,
                          top: slot.y,
                          width: slot.width,
                          height: slot.height,
                          boxSizing: 'border-box',
                          cursor: copiedDimensions ? paintRollerCursor : 'default',
                          border: isHoveredForPaste
                            ? '3px solid #2563EB'
                            : copiedDimensions
                            ? isSelected
                              ? '2px solid #2563EB'
                              : '2px dashed #3B82F6'
                            : isSelected
                            ? '2px solid #2563EB'
                            : slot.groupId
                            ? '2px solid #93C5FD'
                            : (slot.type === 'text' || (slot.id && slot.id.startsWith('text-')))
                            ? '1.5px dashed rgba(37, 99, 235, 0.45)'
                            : '2px dashed #D97706',
                          boxShadow: isHoveredForPaste
                            ? '0 0 0 4px rgba(37, 99, 235, 0.4), 0 6px 16px rgba(37, 99, 235, 0.25)'
                            : isSelected
                            ? '0 0 0 2px rgba(37, 99, 235, 0.25)'
                            : 'none',
                          bgcolor: isHoveredForPaste
                            ? 'rgba(37, 99, 235, 0.22)'
                            : slot.imageUrl
                            ? 'transparent'
                            : copiedDimensions
                            ? 'rgba(37, 99, 235, 0.08)'
                            : isSelected
                            ? (slot.type === 'text' || (slot.id && slot.id.startsWith('text-'))) ? 'rgba(37, 99, 235, 0.08)' : 'rgba(37, 99, 235, 0.14)'
                            : slot.groupId
                            ? (slot.type === 'text' || (slot.id && slot.id.startsWith('text-'))) ? 'rgba(37, 99, 235, 0.04)' : 'rgba(37, 99, 235, 0.06)'
                            : (slot.type === 'text' || (slot.id && slot.id.startsWith('text-')))
                            ? 'transparent'
                            : 'rgba(242, 183, 5, 0.16)',
                          borderRadius: '4px',
                          overflow: 'visible',
                          zIndex: isHoveredForPaste ? 40 : isSelected ? 30 : 10,
                          transition: 'border 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease'
                        }}
                      >
                        {/* Group Badge Indicator */}
                        {slot.groupId && (
                          <Box
                            title={`Linked in Group #${slot.groupId}`}
                            sx={{
                              position: 'absolute',
                              top: 3,
                              right: 3,
                              bgcolor: '#2563EB',
                              color: '#FFFFFF',
                              px: 0.6,
                              py: 0.15,
                              borderRadius: '3px',
                              fontSize: '8px',
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.4,
                              zIndex: 25,
                              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                              pointerEvents: 'none'
                            }}
                          >
                            <GroupWorkIcon sx={{ fontSize: 9 }} />
                            <span>#{slot.groupId}</span>
                          </Box>
                        )}

                        {/* Hover Badge for Paste Mode */}
                        {isHoveredForPaste && (
                          <Box
                            sx={{
                              position: 'absolute',
                              top: -32,
                              left: '50%',
                              transform: 'translateX(-50%)',
                              bgcolor: '#2563EB',
                              color: '#FFFFFF',
                              px: 1.2,
                              py: 0.35,
                              borderRadius: '5px',
                              fontSize: '11px',
                              fontWeight: 800,
                              whiteSpace: 'nowrap',
                              zIndex: 70,
                              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.6,
                              pointerEvents: 'none'
                            }}
                          >
                            <FormatPaintIcon sx={{ fontSize: 13 }} />
                            <span>Click to Paste: W:{copiedDimensions.width} × H:{copiedDimensions.height} px</span>
                          </Box>
                        )}

                        {/* Inner Body: Click or drag to move */}
                        <Box
                          onMouseDown={(e) => {
                            if (copiedDimensions) return;
                            handleTransformMouseDown(e, slot.id, 'move');
                          }}
                          sx={{
                            width: '100%',
                            height: '100%',
                            cursor: copiedDimensions ? paintRollerCursor : 'move',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            overflow: 'hidden',
                            borderRadius: '3px'
                          }}
                        >
                          {(slot.type === 'text' || (slot.id && slot.id.startsWith('text-'))) ? (
                            <Box
                              sx={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: slot.align === 'left' ? 'flex-start' : slot.align === 'right' ? 'flex-end' : 'center',
                                px: 1.5,
                                userSelect: 'none',
                                pointerEvents: 'none',
                                overflow: 'hidden'
                              }}
                            >
                              <Typography
                                sx={{
                                  color: slot.color || '#1E293B',
                                  fontWeight: slot.bold ? 800 : 400,
                                  fontSize: slot.fontSize ? `${slot.fontSize}px` : `${Math.max(12, Math.min(48, Math.round(slot.height * 0.52)))}px`,
                                  lineHeight: 1.25,
                                  wordBreak: 'break-word',
                                  textAlign: slot.align || 'center',
                                  width: '100%'
                                }}
                              >
                                {slot.text || 'Heading Text'}
                              </Typography>
                            </Box>
                          ) : slot.imageUrl ? (
                            <Box
                              component="img"
                              src={resolveImageUrl(slot.imageUrl)}
                              alt={slot.id}
                              sx={{
                                width: '100%',
                                height: '100%',
                                objectFit: slot.fitMode === 'contain' ? 'contain' : 'cover',
                                objectPosition: 'center',
                                display: 'block',
                                pointerEvents: 'none',
                                userSelect: 'none'
                              }}
                            />
                          ) : (
                            <Box sx={{ textAlign: 'center', p: 0.5, pointerEvents: 'none' }}>
                              <Typography
                                variant="caption"
                                sx={{
                                  display: 'block',
                                  fontWeight: 800,
                                  fontSize: '11px',
                                  color: isSelected ? '#1E40AF' : '#92400E'
                                }}
                              >
                                {slot.id}
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{
                                  fontSize: '9px',
                                  fontWeight: 700,
                                  color: isSelected ? '#3B82F6' : '#B45309'
                                }}
                              >
                                {slot.width}×{slot.height}
                              </Typography>
                            </Box>
                          )}
                        </Box>

                        {/* ── Canva Interactive Resize Handles (Only on single slot selection and when not in format painter mode) ── */}
                        {isSelected && !isMultiSelected && !copiedDimensions && (
                          <>
                            {/* Live Dimensions Floating Badge */}
                            <Box
                              sx={{
                                position: 'absolute',
                                top: -28,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                bgcolor: '#0F172A',
                                color: '#FFFFFF',
                                px: 1.2,
                                py: 0.3,
                                borderRadius: '5px',
                                fontSize: '11px',
                                fontWeight: 800,
                                whiteSpace: 'nowrap',
                                pointerEvents: 'none',
                                zIndex: 60,
                                boxShadow: '0 3px 8px rgba(0,0,0,0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.6
                              }}
                            >
                              <span>{slot.width} × {slot.height} px</span>
                              <span style={{ opacity: 0.65, fontSize: '9px' }}>({slot.x}, {slot.y})</span>
                            </Box>

                            {/* Corner NW (top-left) - Resize Entire Slot */}
                            <Box
                              onMouseDown={(e) => handleTransformMouseDown(e, slot.id, 'nw')}
                              title="Pull corner to resize entire slot"
                              sx={{
                                position: 'absolute',
                                top: -7,
                                left: -7,
                                width: 14,
                                height: 14,
                                bgcolor: '#FFFFFF',
                                border: '2.5px solid #2563EB',
                                borderRadius: '50%',
                                cursor: 'nwse-resize',
                                zIndex: 55,
                                boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                                '&:hover': { bgcolor: '#2563EB', transform: 'scale(1.2)' }
                              }}
                            />
                            {/* Corner NE (top-right) - Resize Entire Slot */}
                            <Box
                              onMouseDown={(e) => handleTransformMouseDown(e, slot.id, 'ne')}
                              title="Pull corner to resize entire slot"
                              sx={{
                                position: 'absolute',
                                top: -7,
                                right: -7,
                                width: 14,
                                height: 14,
                                bgcolor: '#FFFFFF',
                                border: '2.5px solid #2563EB',
                                borderRadius: '50%',
                                cursor: 'nesw-resize',
                                zIndex: 55,
                                boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                                '&:hover': { bgcolor: '#2563EB', transform: 'scale(1.2)' }
                              }}
                            />
                            {/* Corner SW (bottom-left) - Resize Entire Slot */}
                            <Box
                              onMouseDown={(e) => handleTransformMouseDown(e, slot.id, 'sw')}
                              title="Pull corner to resize entire slot"
                              sx={{
                                position: 'absolute',
                                bottom: -7,
                                left: -7,
                                width: 14,
                                height: 14,
                                bgcolor: '#FFFFFF',
                                border: '2.5px solid #2563EB',
                                borderRadius: '50%',
                                cursor: 'nesw-resize',
                                zIndex: 55,
                                boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                                '&:hover': { bgcolor: '#2563EB', transform: 'scale(1.2)' }
                              }}
                            />
                            {/* Corner SE (bottom-right) - Resize Entire Slot */}
                            <Box
                              onMouseDown={(e) => handleTransformMouseDown(e, slot.id, 'se')}
                              title="Pull corner to resize entire slot"
                              sx={{
                                position: 'absolute',
                                bottom: -7,
                                right: -7,
                                width: 14,
                                height: 14,
                                bgcolor: '#FFFFFF',
                                border: '2.5px solid #2563EB',
                                borderRadius: '50%',
                                cursor: 'nwse-resize',
                                zIndex: 55,
                                boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                                '&:hover': { bgcolor: '#2563EB', transform: 'scale(1.2)' }
                              }}
                            />

                            {/* Edge N (top border height pull) */}
                            <Box
                              onMouseDown={(e) => handleTransformMouseDown(e, slot.id, 'n')}
                              title="Pull to resize height from top"
                              sx={{
                                position: 'absolute',
                                top: -6,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: 32,
                                height: 9,
                                bgcolor: '#FFFFFF',
                                border: '2px solid #2563EB',
                                borderRadius: '5px',
                                cursor: 'ns-resize',
                                zIndex: 55,
                                boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                                '&:hover': { bgcolor: '#2563EB' }
                              }}
                            />
                            {/* Edge S (bottom border height pull) */}
                            <Box
                              onMouseDown={(e) => handleTransformMouseDown(e, slot.id, 's')}
                              title="Pull to resize height from bottom"
                              sx={{
                                position: 'absolute',
                                bottom: -6,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: 32,
                                height: 9,
                                bgcolor: '#FFFFFF',
                                border: '2px solid #2563EB',
                                borderRadius: '5px',
                                cursor: 'ns-resize',
                                zIndex: 55,
                                boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                                '&:hover': { bgcolor: '#2563EB' }
                              }}
                            />
                            {/* Edge W (left border width pull) */}
                            <Box
                              onMouseDown={(e) => handleTransformMouseDown(e, slot.id, 'w')}
                              title="Pull to resize width from left"
                              sx={{
                                position: 'absolute',
                                left: -6,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: 9,
                                height: 32,
                                bgcolor: '#FFFFFF',
                                border: '2px solid #2563EB',
                                borderRadius: '5px',
                                cursor: 'ew-resize',
                                zIndex: 55,
                                boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                                '&:hover': { bgcolor: '#2563EB' }
                              }}
                            />
                            {/* Edge E (right border width pull) */}
                            <Box
                              onMouseDown={(e) => handleTransformMouseDown(e, slot.id, 'e')}
                              title="Pull to resize width from right"
                              sx={{
                                position: 'absolute',
                                right: -6,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: 9,
                                height: 32,
                                bgcolor: '#FFFFFF',
                                border: '2px solid #2563EB',
                                borderRadius: '5px',
                                cursor: 'ew-resize',
                                zIndex: 55,
                                boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                                '&:hover': { bgcolor: '#2563EB' }
                              }}
                            />
                          </>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              </Box>

              <Typography variant="caption" sx={{ mt: 2.5, color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <OpenWithIcon sx={{ fontSize: 14 }} />
                <strong>Tip:</strong> Click any slot to select and adjust it. Use the tabs on the right to view Row & Template settings.
              </Typography>
            </Box>
          )}
        </Paper>

        {/* Right Column: Canva Floating / Docked Inspector Panel */}
        <Paper
          elevation={0}
          sx={{
            width: 370,
            minWidth: 370,
            maxWidth: 370,
            height: '100%',
            overflowY: 'auto',
            borderRadius: '20px',
            bgcolor: colors.surface,
            border: `1px solid ${colors.border}`,
            boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
            p: 2.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            zIndex: 20
          }}
        >
          {/* Canva Navigation Tabs */}
          <Box sx={{ display: 'flex', bgcolor: colors.surfaceAlt, p: 0.5, borderRadius: '12px' }}>
            <Button
              fullWidth
              size="small"
              onClick={() => {
                if (!selectedSlotId && logoSlots.length > 0) {
                  setSelectedSlotId(logoSlots[0].id);
                }
              }}
              sx={{
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: selectedSlot ? 800 : 600,
                bgcolor: selectedSlot ? '#FFFFFF' : 'transparent',
                color: selectedSlot ? '#2563EB' : colors.textSecondary,
                boxShadow: selectedSlot ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                '&:hover': { bgcolor: selectedSlot ? '#FFFFFF' : 'rgba(0,0,0,0.04)' }
              }}
            >
              Element Properties
            </Button>
            <Button
              fullWidth
              size="small"
              onClick={() => setSelectedSlotId(null)}
              sx={{
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: !selectedSlot ? 800 : 600,
                bgcolor: !selectedSlot ? '#FFFFFF' : 'transparent',
                color: !selectedSlot ? '#2563EB' : colors.textSecondary,
                boxShadow: !selectedSlot ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                '&:hover': { bgcolor: !selectedSlot ? '#FFFFFF' : 'rgba(0,0,0,0.04)' }
              }}
            >
              Row & Template
            </Button>
          </Box>

          {/* VIEW A: ACTIVE ELEMENT PROPERTIES (When an element is clicked or active) */}
          {selectedSlot ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {(selectedSlot.type === 'text' || (selectedSlot.id && selectedSlot.id.startsWith('text-'))) ? (
                    <TextFieldsIcon sx={{ color: '#2563EB', fontSize: 20 }} />
                  ) : (
                    <CropIcon sx={{ color: '#D97706', fontSize: 18 }} />
                  )}
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: colors.textPrimary }}>
                    {(selectedSlot.type === 'text' || (selectedSlot.id && selectedSlot.id.startsWith('text-'))) ? 'Text' : 'Slot'}: {selectedSlot.id}
                  </Typography>
                  <Chip
                    label={(selectedSlot.type === 'text' || (selectedSlot.id && selectedSlot.id.startsWith('text-'))) ? 'Text' : 'Slot'}
                    size="small"
                    sx={{
                      fontWeight: 800,
                      bgcolor: (selectedSlot.type === 'text' || (selectedSlot.id && selectedSlot.id.startsWith('text-'))) ? 'rgba(37,99,235,0.12)' : 'rgba(217,119,6,0.12)',
                      color: (selectedSlot.type === 'text' || (selectedSlot.id && selectedSlot.id.startsWith('text-'))) ? '#2563EB' : '#D97706',
                      height: 20
                    }}
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 0.8 }}>
                  <Button
                    size="small"
                    startIcon={<TextFieldsIcon sx={{ fontSize: 14 }} />}
                    disabled={!backgroundUrl}
                    onClick={handleAddTextElement}
                    sx={{ textTransform: 'none', fontWeight: 700, fontSize: '11px', px: 1, py: 0.3 }}
                  >
                    + Text
                  </Button>
                  <Button
                    size="small"
                    startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                    disabled={!backgroundUrl}
                    onClick={handleAddSingleSlot}
                    sx={{ textTransform: 'none', fontWeight: 700, fontSize: '11px', px: 1, py: 0.3 }}
                  >
                    + Slot
                  </Button>
                </Box>
              </Box>

              {/* Element Quick Selector Chips with Group Indicators */}
              <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                {logoSlots.map((s) => {
                  const isItemSel = selectedSlotIds.includes(s.id) || selectedSlotId === s.id;
                  const isTextItem = s.type === 'text' || (s.id && s.id.startsWith('text-'));
                  return (
                    <Chip
                      key={s.id}
                      icon={isTextItem ? <TextFieldsIcon sx={{ fontSize: '13px !important', color: isItemSel ? '#FFFFFF' : '#2563EB' }} /> : undefined}
                      label={s.groupId ? `${s.id} (#${s.groupId})` : s.id}
                      size="small"
                      onClick={(e) => {
                        if (s.groupId) {
                          const grpIds = logoSlots.filter((m) => m.groupId === s.groupId).map((m) => m.id);
                          setSelectedSlotIds(grpIds);
                          setSelectedSlotId(s.id);
                        } else if (e.shiftKey) {
                          setSelectedSlotIds((prev) =>
                            prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                          );
                          setSelectedSlotId(s.id);
                        } else {
                          setSelectedSlotIds([s.id]);
                          setSelectedSlotId(s.id);
                        }
                      }}
                      variant={isItemSel ? 'filled' : 'outlined'}
                      sx={{
                        fontWeight: 750,
                        cursor: 'pointer',
                        bgcolor: isItemSel ? '#2563EB' : s.groupId ? 'rgba(37,99,235,0.08)' : 'transparent',
                        color: isItemSel ? '#FFFFFF' : s.groupId ? '#1E40AF' : colors.textPrimary,
                        borderColor: isItemSel ? '#2563EB' : s.groupId ? '#93C5FD' : colors.border
                      }}
                    />
                  );
                })}
              </Box>

              {/* ── Canva Group & Multi-Selection Controls in Right Inspector ── */}
              {(isMultiSelected || selectedSlot?.groupId) && (
                <Box
                  sx={{
                    p: 2,
                    borderRadius: '14px',
                    bgcolor: commonGroupId || selectedSlot?.groupId ? 'rgba(37, 99, 235, 0.08)' : colors.surfaceAlt,
                    border: `1.5px solid ${commonGroupId || selectedSlot?.groupId ? '#2563EB' : colors.border}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <GroupWorkIcon sx={{ color: '#2563EB', fontSize: 20 }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: colors.textPrimary }}>
                        {commonGroupId || selectedSlot?.groupId ? 'Grouped Elements' : 'Multi-Selection'}
                      </Typography>
                    </Box>
                    <Chip
                      label={commonGroupId || selectedSlot?.groupId ? `#${commonGroupId || selectedSlot?.groupId}` : `${selectedSlotIds.length} Slots`}
                      size="small"
                      sx={{
                        fontWeight: 800,
                        bgcolor: commonGroupId || selectedSlot?.groupId ? '#2563EB' : 'rgba(37,99,235,0.1)',
                        color: commonGroupId || selectedSlot?.groupId ? '#FFFFFF' : '#2563EB',
                        fontSize: '11px',
                        height: 22
                      }}
                    />
                  </Box>

                  <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '11px' }}>
                    {commonGroupId || selectedSlot?.groupId
                      ? `These slots are linked in Group #${commonGroupId || selectedSlot?.groupId}. Dragging one moves all linked slots together.`
                      : 'Cover multiple slots with marquee drag or Shift-click to group them.'}
                  </Typography>

                  {/* Grouped Slot Member Chips */}
                  <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                    {selectedSlotsList.map((s) => (
                      <Chip
                        key={s.id}
                        label={s.id}
                        size="small"
                        sx={{
                          fontWeight: 750,
                          bgcolor: '#FFFFFF',
                          border: '1px solid #93C5FD',
                          color: '#1E40AF',
                          fontSize: '10px'
                        }}
                      />
                    ))}
                  </Box>

                  {commonGroupId || selectedSlot?.groupId ? (
                    <Button
                      variant="outlined"
                      color="error"
                      fullWidth
                      size="medium"
                      onClick={() => handleUngroupSlots(commonGroupId || selectedSlot?.groupId)}
                      startIcon={<LinkOffIcon />}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 800,
                        borderRadius: '10px',
                        borderColor: 'rgba(239, 68, 68, 0.5)',
                        '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.08)', borderColor: '#EF4444' }
                      }}
                    >
                      Ungroup Elements
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      fullWidth
                      size="medium"
                      onClick={handleGroupSelectedSlots}
                      startIcon={<GroupWorkIcon />}
                      sx={{
                        bgcolor: '#2563EB',
                        color: '#FFFFFF',
                        textTransform: 'none',
                        fontWeight: 800,
                        borderRadius: '10px',
                        boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
                        '&:hover': { bgcolor: '#1D4ED8' }
                      }}
                    >
                      Group Selected Slots
                    </Button>
                  )}
                </Box>
              )}

              {(selectedSlot.type === 'text' || (selectedSlot.id && selectedSlot.id.startsWith('text-'))) ? (
                /* TEXT ELEMENT CONTROLS */
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Card 1: Text Content */}
                  <Box sx={{ p: 2, borderRadius: '14px', bgcolor: colors.surfaceAlt, border: `1px solid ${colors.border}` }}>
                    <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 700, display: 'block', mb: 1 }}>
                      Text Content (Live Sync)
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      size="small"
                      value={selectedSlot.text || ''}
                      onChange={(e) => updateSelectedSlot('text', e.target.value)}
                      placeholder="Enter certificate text..."
                      sx={{
                        bgcolor: '#FFFFFF',
                        borderRadius: '8px',
                        '& .MuiOutlinedInput-root': {
                          fontWeight: selectedSlot.bold ? 800 : 400,
                          color: selectedSlot.color || '#1E293B',
                          fontSize: '0.92rem'
                        }
                      }}
                    />
                  </Box>

                  {/* Card 2: Typography Styling (Bold, Align, Font Size) */}
                  <Box sx={{ p: 2, borderRadius: '14px', bgcolor: colors.surfaceAlt, border: `1px solid ${colors.border}` }}>
                    <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 700, display: 'block', mb: 1.2 }}>
                      Typography & Style
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1.5, flexWrap: 'wrap' }}>
                      {/* Bold Toggle */}
                      <Button
                        size="small"
                        variant={selectedSlot.bold ? 'contained' : 'outlined'}
                        onClick={() => updateSelectedSlot('bold', !selectedSlot.bold)}
                        startIcon={<FormatBoldIcon />}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 800,
                          borderRadius: '8px',
                          bgcolor: selectedSlot.bold ? '#2563EB' : 'transparent',
                          color: selectedSlot.bold ? '#FFFFFF' : colors.textPrimary,
                          borderColor: selectedSlot.bold ? '#2563EB' : colors.border,
                          '&:hover': { bgcolor: selectedSlot.bold ? '#1D4ED8' : 'rgba(0,0,0,0.04)' }
                        }}
                      >
                        Bold {selectedSlot.bold ? 'ON' : 'OFF'}
                      </Button>

                      {/* Text Alignment */}
                      <Box sx={{ display: 'flex', border: `1px solid ${colors.border}`, borderRadius: '8px', overflow: 'hidden' }}>
                        <IconButton
                          size="small"
                          onClick={() => updateSelectedSlot('align', 'left')}
                          sx={{
                            borderRadius: 0,
                            bgcolor: selectedSlot.align === 'left' ? '#2563EB' : 'transparent',
                            color: selectedSlot.align === 'left' ? '#FFFFFF' : colors.textSecondary,
                            '&:hover': { bgcolor: selectedSlot.align === 'left' ? '#1D4ED8' : 'rgba(0,0,0,0.05)' }
                          }}
                          title="Align Left"
                        >
                          <FormatAlignLeftIcon sx={{ fontSize: 17 }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => updateSelectedSlot('align', 'center')}
                          sx={{
                            borderRadius: 0,
                            bgcolor: (!selectedSlot.align || selectedSlot.align === 'center') ? '#2563EB' : 'transparent',
                            color: (!selectedSlot.align || selectedSlot.align === 'center') ? '#FFFFFF' : colors.textSecondary,
                            '&:hover': { bgcolor: (!selectedSlot.align || selectedSlot.align === 'center') ? '#1D4ED8' : 'rgba(0,0,0,0.05)' }
                          }}
                          title="Align Center"
                        >
                          <FormatAlignCenterIcon sx={{ fontSize: 17 }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => updateSelectedSlot('align', 'right')}
                          sx={{
                            borderRadius: 0,
                            bgcolor: selectedSlot.align === 'right' ? '#2563EB' : 'transparent',
                            color: selectedSlot.align === 'right' ? '#FFFFFF' : colors.textSecondary,
                            '&:hover': { bgcolor: selectedSlot.align === 'right' ? '#1D4ED8' : 'rgba(0,0,0,0.05)' }
                          }}
                          title="Align Right"
                        >
                          <FormatAlignRightIcon sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Box>
                    </Box>

                    {/* Font Size Input */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <TextField
                        label="Font Size (px)"
                        type="number"
                        size="small"
                        value={selectedSlot.fontSize || 24}
                        onChange={(e) => updateSelectedSlot('fontSize', e.target.value)}
                        sx={{ width: 140, bgcolor: '#FFFFFF' }}
                      />
                      <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '11px' }}>
                        Scales on canvas & PDF
                      </Typography>
                    </Box>
                  </Box>

                  {/* Card 3: Color Property (Picker + Hex + Swatches) */}
                  <Box sx={{ p: 2, borderRadius: '14px', bgcolor: colors.surfaceAlt, border: `1px solid ${colors.border}` }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                        <PaletteIcon sx={{ fontSize: 18, color: '#2563EB' }} />
                        <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 700 }}>
                          Color Property
                        </Typography>
                      </Box>
                      <Chip
                        label={selectedSlot.color || '#1E293B'}
                        size="small"
                        sx={{
                          fontWeight: 800,
                          fontSize: '11px',
                          bgcolor: selectedSlot.color || '#1E293B',
                          color: '#FFFFFF',
                          textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                        }}
                      />
                    </Box>

                    {/* Color Input and Hex */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1.5 }}>
                      <input
                        type="color"
                        value={selectedSlot.color || '#1E293B'}
                        onChange={(e) => updateSelectedSlot('color', e.target.value)}
                        style={{
                          width: 44,
                          height: 40,
                          border: 'none',
                          borderRadius: 8,
                          cursor: 'pointer',
                          background: 'none'
                        }}
                      />
                      <TextField
                        size="small"
                        value={selectedSlot.color || '#1E293B'}
                        onChange={(e) => updateSelectedSlot('color', e.target.value)}
                        placeholder="#1E293B"
                        sx={{ flex: 1, bgcolor: '#FFFFFF' }}
                      />
                    </Box>

                    {/* Quick Swatches */}
                    <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 700, display: 'block', mb: 0.8, fontSize: '11px' }}>
                      Palette Presets:
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                      {[
                        '#000000',
                        '#1E293B',
                        '#475569',
                        '#2563EB',
                        '#1D4ED8',
                        '#DC2626',
                        '#16A34A',
                        '#D97706',
                        '#7C3AED',
                        '#DB2777',
                        '#FFFFFF'
                      ].map((c) => (
                        <Box
                          key={c}
                          onClick={() => updateSelectedSlot('color', c)}
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '6px',
                            bgcolor: c,
                            cursor: 'pointer',
                            border: selectedSlot.color === c ? '2.5px solid #2563EB' : '1px solid rgba(0,0,0,0.15)',
                            boxShadow: selectedSlot.color === c ? '0 0 0 2px rgba(37,99,235,0.4)' : 'none',
                            transition: 'transform 0.1s',
                            '&:hover': { transform: 'scale(1.15)' }
                          }}
                          title={c}
                        />
                      ))}
                    </Box>
                  </Box>

                  {/* Card 4: Position & Dimensions */}
                  <Box sx={{ p: 2, borderRadius: '14px', bgcolor: colors.surfaceAlt, border: `1px solid ${colors.border}` }}>
                    <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 700, display: 'block', mb: 1.5 }}>
                      Position & Dimensions (Live Sync)
                    </Typography>
                    <Grid container spacing={1.5}>
                      <Grid item xs={6}>
                        <TextField
                          label="Position X (px)"
                          type="number"
                          size="small"
                          value={selectedSlot.x}
                          onChange={(e) => updateSelectedSlot('x', e.target.value)}
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          label="Position Y (px)"
                          type="number"
                          size="small"
                          value={selectedSlot.y}
                          onChange={(e) => updateSelectedSlot('y', e.target.value)}
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          label="Width (W px)"
                          type="number"
                          size="small"
                          value={selectedSlot.width}
                          onChange={(e) => updateSelectedSlot('width', e.target.value)}
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          label="Height (H px)"
                          type="number"
                          size="small"
                          value={selectedSlot.height}
                          onChange={(e) => updateSelectedSlot('height', e.target.value)}
                          fullWidth
                        />
                      </Grid>
                    </Grid>
                  </Box>

                  {/* Card 5: Duplicate and Delete */}
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="contained"
                      fullWidth
                      startIcon={<ContentCopyIcon />}
                      onClick={handleDuplicateSelectedSlots}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 800,
                        borderRadius: '10px',
                        bgcolor: '#2563EB',
                        color: '#FFFFFF',
                        '&:hover': { bgcolor: '#1D4ED8' }
                      }}
                    >
                      Duplicate Text
                    </Button>
                    <Tooltip title="Delete Text Element">
                      <IconButton onClick={() => handleDeleteSlot(selectedSlot.id)} sx={{ color: colors.error }}>
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              ) : (
                /* EXISTING SLOT PROPERTIES (LOGO, IMAGE FIT, FORMAT PAINTER, ETC.) */
                <>
                  <Box sx={{ p: 2, borderRadius: '14px', bgcolor: colors.surfaceAlt, border: `1px solid ${colors.border}` }}>
                    <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 700, display: 'block', mb: 1.5 }}>
                      Position & Dimensions (Live Sync)
                    </Typography>
                    <Grid container spacing={1.5}>
                      <Grid item xs={6}>
                        <TextField
                          label="Position X (px)"
                          type="number"
                          size="small"
                          value={selectedSlot.x}
                          onChange={(e) => updateSelectedSlot('x', e.target.value)}
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          label="Position Y (px)"
                          type="number"
                          size="small"
                          value={selectedSlot.y}
                          onChange={(e) => updateSelectedSlot('y', e.target.value)}
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          label="Width (W px)"
                          type="number"
                          size="small"
                          value={selectedSlot.width}
                          onChange={(e) => updateSelectedSlot('width', e.target.value)}
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          label="Height (H px)"
                          type="number"
                          size="small"
                          value={selectedSlot.height}
                          onChange={(e) => updateSelectedSlot('height', e.target.value)}
                          fullWidth
                        />
                      </Grid>
                    </Grid>

                    {/* ── Canva Format Painter / Copy Size Controls ── */}
                    <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${colors.border}` }}>
                      {copiedDimensions ? (
                        <Box
                          sx={{
                            p: 1.8,
                            borderRadius: '12px',
                            bgcolor: 'rgba(37, 99, 235, 0.08)',
                            border: '1.5px solid #2563EB',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1.2
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box
                                sx={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: '8px',
                                  bgcolor: '#2563EB',
                                  color: '#FFFFFF',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)'
                                }}
                              >
                                <FormatPaintIcon sx={{ fontSize: 18 }} />
                              </Box>
                              <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1E40AF', fontSize: '13px', lineHeight: 1.2 }}>
                                  Size Copied!
                                </Typography>
                                <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '11px' }}>
                                  From {copiedDimensions.sourceId}
                                </Typography>
                              </Box>
                            </Box>

                            <Chip
                              label={`W: ${copiedDimensions.width} × H: ${copiedDimensions.height}`}
                              size="small"
                              sx={{
                                fontWeight: 800,
                                bgcolor: '#2563EB',
                                color: '#FFFFFF',
                                fontSize: '11px'
                              }}
                            />
                          </Box>

                          {/* Paste Button for Currently Selected Slot */}
                          {selectedSlot && selectedSlot.id !== copiedDimensions.sourceId && (
                            <Button
                              variant="contained"
                              fullWidth
                              size="medium"
                              onClick={() => handlePasteSlotDimensions(selectedSlot.id)}
                              startIcon={<FormatPaintIcon sx={{ fontSize: 18 }} />}
                              sx={{
                                bgcolor: '#2563EB',
                                color: '#FFFFFF',
                                fontWeight: 800,
                                textTransform: 'none',
                                fontSize: '13px',
                                py: 0.9,
                                borderRadius: '10px',
                                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                                '&:hover': { bgcolor: '#1D4ED8' }
                              }}
                            >
                              Paste Size into {selectedSlot.id}
                            </Button>
                          )}

                          {/* Quick Paste into other slots */}
                          {logoSlots.filter((s) => s.id !== copiedDimensions.sourceId).length > 0 && (
                            <Box>
                              <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 700, display: 'block', mb: 0.8, fontSize: '11px' }}>
                                Or click any slot on canvas / quick paste below:
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                                {logoSlots
                                  .filter((s) => s.id !== copiedDimensions.sourceId)
                                  .map((s) => (
                                    <Chip
                                      key={s.id}
                                      label={`Paste to ${s.id}`}
                                      size="small"
                                      onClick={() => handlePasteSlotDimensions(s.id)}
                                      icon={<FormatPaintIcon sx={{ fontSize: '14px !important', color: '#2563EB' }} />}
                                      sx={{
                                        fontWeight: 750,
                                        cursor: 'pointer',
                                        bgcolor: selectedSlotId === s.id ? '#DBEAFE' : '#FFFFFF',
                                        border: '1px solid #93C5FD',
                                        color: '#1E40AF',
                                        '&:hover': { bgcolor: '#2563EB', color: '#FFFFFF', '& .MuiChip-icon': { color: '#FFFFFF' } }
                                      }}
                                    />
                                  ))}
                              </Box>
                            </Box>
                          )}

                          {/* Cancel Button */}
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={handleCancelCopy}
                            startIcon={<CloseIcon sx={{ fontSize: 16 }} />}
                            sx={{
                              borderRadius: '8px',
                              textTransform: 'none',
                              fontWeight: 750,
                              fontSize: '12px',
                              py: 0.6,
                              borderColor: 'rgba(239, 68, 68, 0.5)',
                              '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.08)', borderColor: '#EF4444' }
                            }}
                          >
                            Cancel Copy Mode
                          </Button>
                        </Box>
                      ) : (
                        <Button
                          variant="contained"
                          fullWidth
                          size="medium"
                          startIcon={<FormatPaintIcon sx={{ fontSize: 18 }} />}
                          onClick={(e) => handleCopySlotDimensions(selectedSlot, e)}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 800,
                            fontSize: '13px',
                            py: 1,
                            borderRadius: '10px',
                            bgcolor: '#2563EB',
                            color: '#FFFFFF',
                            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.22)',
                            '&:hover': {
                              bgcolor: '#1D4ED8',
                              boxShadow: '0 6px 18px rgba(37, 99, 235, 0.35)'
                            }
                          }}
                        >
                          Copy Size (W: {selectedSlot.width}, H: {selectedSlot.height})
                        </Button>
                      )}
                    </Box>
                  </Box>

                  {/* Canva Frame Fit Mode (Cover vs Contain) */}
                  {selectedSlot.imageUrl && (
                    <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: colors.surfaceAlt, border: `1px solid ${colors.border}` }}>
                      <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 700, display: 'block', mb: 1 }}>
                        Image Fit (Canva Frame Mode)
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          variant={(!selectedSlot.fitMode || selectedSlot.fitMode === 'cover') ? 'contained' : 'outlined'}
                          onClick={() => updateSelectedSlot('fitMode', 'cover')}
                          sx={{
                            flex: 1,
                            textTransform: 'none',
                            fontWeight: 750,
                            fontSize: '11px',
                            borderRadius: '8px',
                            bgcolor: (!selectedSlot.fitMode || selectedSlot.fitMode === 'cover') ? '#2563EB' : 'transparent',
                            color: (!selectedSlot.fitMode || selectedSlot.fitMode === 'cover') ? '#FFFFFF' : colors.textPrimary,
                            '&:hover': { bgcolor: (!selectedSlot.fitMode || selectedSlot.fitMode === 'cover') ? '#1D4ED8' : 'rgba(0,0,0,0.04)' }
                          }}
                        >
                          Cover (Mask & Reveal)
                        </Button>
                        <Button
                          size="small"
                          variant={selectedSlot.fitMode === 'contain' ? 'contained' : 'outlined'}
                          onClick={() => updateSelectedSlot('fitMode', 'contain')}
                          sx={{
                            flex: 1,
                            textTransform: 'none',
                            fontWeight: 750,
                            fontSize: '11px',
                            borderRadius: '8px',
                            bgcolor: selectedSlot.fitMode === 'contain' ? '#2563EB' : 'transparent',
                            color: selectedSlot.fitMode === 'contain' ? '#FFFFFF' : colors.textPrimary,
                            '&:hover': { bgcolor: selectedSlot.fitMode === 'contain' ? '#1D4ED8' : 'rgba(0,0,0,0.04)' }
                          }}
                        >
                          Contain (Full Image)
                        </Button>
                      </Box>
                      <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '10px', display: 'block', mt: 0.8 }}>
                        {(!selectedSlot.fitMode || selectedSlot.fitMode === 'cover')
                          ? 'Original image preserved. Resizing the slot dynamically reveals more of the image.'
                          : 'Entire image scales down to fit completely inside the slot.'}
                      </Typography>
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="outlined"
                      fullWidth
                      startIcon={<CropIcon />}
                      onClick={() => handleOpenSlotUpload(selectedSlot)}
                      sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px' }}
                    >
                      {selectedSlot.imageUrl ? 'Change Logo' : 'Upload Logo'}
                    </Button>
                    <Tooltip title="Duplicate Slot (Ctrl+C / Ctrl+V or Ctrl+D)">
                      <IconButton
                        onClick={handleDuplicateSelectedSlots}
                        sx={{
                          color: '#2563EB',
                          border: `1px solid ${colors.border}`,
                          borderRadius: '10px',
                          '&:hover': { bgcolor: 'rgba(37,99,235,0.08)', borderColor: '#2563EB' }
                        }}
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Slot">
                      <IconButton onClick={() => handleDeleteSlot(selectedSlot.id)} sx={{ color: colors.error }}>
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </>
              )}
            </Box>
          ) : (
            /* VIEW B: TEMPLATE & ROW LAYOUT (When primary background image is clicked) */
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Card 1: Template Background */}
              <Box sx={{ p: 2, borderRadius: '14px', bgcolor: colors.surfaceAlt, border: `1px solid ${colors.border}` }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: colors.textPrimary, mb: 1 }}>
                  Certificate Background
                </Typography>

                {backgroundUrl ? (
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                      <Box>
                        <Typography variant="caption" sx={{ color: colors.textSecondary, display: 'block', fontWeight: 600 }}>
                          Original Resolution
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 800, color: colors.primary }}>
                          {designWidth} × {designHeight} px
                        </Typography>
                      </Box>
                      <Chip label="DETECTED" size="small" sx={{ fontWeight: 800, bgcolor: '#DCFCE7', color: '#166534', height: 22 }} />
                    </Box>

                    <Button
                      variant="outlined"
                      fullWidth
                      size="small"
                      startIcon={<CloudUploadIcon />}
                      onClick={() => bgFileInputRef.current?.click()}
                      sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px' }}
                    >
                      Replace Template Image
                    </Button>
                  </Box>
                ) : (
                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={<CloudUploadIcon />}
                    onClick={() => bgFileInputRef.current?.click()}
                    sx={{
                      bgcolor: '#172338',
                      color: '#FFFFFF',
                      fontWeight: 750,
                      textTransform: 'none',
                      py: 1.2,
                      borderRadius: '10px',
                      '&:hover': { bgcolor: '#24344D' }
                    }}
                  >
                    Upload Template Image
                  </Button>
                )}
              </Box>

              {/* Card 2: Row Layout & Spacing */}
              <Box sx={{ p: 2, borderRadius: '14px', bgcolor: colors.surfaceAlt, border: `1px solid ${colors.border}` }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CalculateIcon sx={{ color: '#F2B705', fontSize: 20 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: colors.textPrimary }}>
                      Row Layout & Spacing
                    </Typography>
                  </Box>
                  <Chip
                    label="Auto-Sync"
                    size="small"
                    sx={{
                      fontWeight: 800,
                      bgcolor: '#FEF3C7',
                      color: '#92400E',
                      fontSize: '10px',
                      height: 20
                    }}
                  />
                </Box>

                <Typography variant="caption" sx={{ color: colors.textSecondary, display: 'block', mb: 2 }}>
                  Updates dynamically on canvas: <code>X_i = X_0 + i(W + G)</code>.
                </Typography>

                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                  <Grid item xs={6}>
                    <TextField
                      label="Start X (X_0)"
                      type="number"
                      size="small"
                      value={rowConfig.startX}
                      onChange={(e) => updateRowConfigField('startX', e.target.value)}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Start Y (Y_0)"
                      type="number"
                      size="small"
                      value={rowConfig.startY}
                      onChange={(e) => updateRowConfigField('startY', e.target.value)}
                      fullWidth
                    />
                  </Grid>

                  <Grid item xs={6}>
                    <TextField
                      label="No. of Logos (N)"
                      type="number"
                      size="small"
                      value={rowConfig.count}
                      onChange={(e) => updateRowConfigField('count', e.target.value)}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Spacing / Gap (G)"
                      type="number"
                      size="small"
                      value={rowConfig.gapX}
                      onChange={(e) => updateRowConfigField('gapX', e.target.value)}
                      fullWidth
                    />
                  </Grid>

                  <Grid item xs={6}>
                    <TextField
                      label="Slot Width (W)"
                      type="number"
                      size="small"
                      value={rowConfig.width}
                      onChange={(e) => updateRowConfigField('width', e.target.value)}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Slot Height (H)"
                      type="number"
                      size="small"
                      value={rowConfig.height}
                      onChange={(e) => updateRowConfigField('height', e.target.value)}
                      fullWidth
                    />
                  </Grid>
                </Grid>

                <Button
                  variant="contained"
                  fullWidth
                  disabled={!backgroundUrl}
                  onClick={handleGenerateRow}
                  sx={{
                    bgcolor: '#172338',
                    color: '#FFFFFF',
                    fontWeight: 750,
                    textTransform: 'none',
                    py: 1,
                    borderRadius: '10px',
                    '&:hover': { bgcolor: '#24344D' }
                  }}
                >
                  Align All Slots in Row
                </Button>
              </Box>

              {/* Slot Quick Selector when in Background mode */}
              {logoSlots.length > 0 && (
                <Box>
                  <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 700, display: 'block', mb: 1 }}>
                    Quick Select Slot:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                    {logoSlots.map((s) => (
                      <Chip
                        key={s.id}
                        label={s.id}
                        size="small"
                        onClick={() => setSelectedSlotId(s.id)}
                        variant="outlined"
                        sx={{
                          fontWeight: 750,
                          cursor: 'pointer',
                          borderColor: colors.border,
                          '&:hover': { bgcolor: 'rgba(37,99,235,0.08)', borderColor: '#2563EB' }
                        }}
                      />
                    ))}
                    <Chip
                      icon={<AddIcon sx={{ fontSize: '14px !important' }} />}
                      label="Add"
                      size="small"
                      onClick={handleAddSingleSlot}
                      sx={{ fontWeight: 750, cursor: 'pointer', bgcolor: '#F2B705', color: '#172338' }}
                    />
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </Paper>
      </Box>

      {/* ── Dialog: Logo Upload & Auto-Crop Engine ─────────── */}
      <Dialog open={uploadModalOpen} onClose={() => setUploadModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.2rem', pb: 1 }}>
          Upload Logo for Slot: {targetSlot?.id}
        </DialogTitle>

        <DialogContent dividers sx={{ py: 3 }}>
          {targetSlot && (
            <Box>
              <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2 }}>
                Target Slot Dimensions: <strong>{targetSlot.width} × {targetSlot.height} px</strong> (Ratio: {targetSlot.aspectRatio})
              </Typography>

              {/* Upload trigger button */}
              <Box
                onClick={() => logoFileInputRef.current?.click()}
                sx={{
                  border: '2px dashed #CBD5E1',
                  borderRadius: '14px',
                  p: 3,
                  textAlign: 'center',
                  bgcolor: '#F8FAFC',
                  cursor: 'pointer',
                  mb: 3,
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: '#F1F5F9', borderColor: '#94A3B8' }
                }}
              >
                <CloudUploadIcon sx={{ fontSize: 36, color: '#64748B', mb: 1 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155' }}>
                  Click to select logo image (PNG / JPG / WEBP)
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mt: 0.5 }}>
                  The original image is stored as-is without destructive cropping.
                </Typography>
                <Typography variant="caption" sx={{ color: '#2563EB', fontWeight: 700 }}>
                  Canva Mask Mode: Only the portion fitting the slot is visible. Enlarging the slot reveals the rest of the image.
                </Typography>
              </Box>

              {/* Live Slot Mask Preview Area */}
              {logoPreviewUrl && (
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#475569', display: 'block', mb: 1 }}>
                    CANVA FRAME PREVIEW (Original Saved As-Is • Visual Masking)
                  </Typography>

                  <Box
                    sx={{
                      width: Math.min(280, targetSlot.width * 1.5),
                      height: Math.min(140, targetSlot.height * 1.5),
                      mx: 'auto',
                      bgcolor: '#FFFFFF',
                      border: '2px solid #2563EB',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      position: 'relative'
                    }}
                  >
                    <Box
                      component="img"
                      src={logoPreviewUrl}
                      alt="Logo Preview"
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'center',
                        display: 'block'
                      }}
                    />
                  </Box>

                  <Chip
                    icon={<AspectRatioIcon sx={{ fontSize: '13px !important' }} />}
                    label="Original resolution preserved • Resize slot on canvas to reveal more"
                    size="small"
                    sx={{ mt: 1.5, bgcolor: 'rgba(37, 99, 235, 0.1)', color: '#1E40AF', fontWeight: 750, fontSize: '0.72rem' }}
                  />
                </Box>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setUploadModalOpen(false)} sx={{ fontWeight: 700, textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={uploadingLogo || !logoPreviewUrl}
            onClick={handleConfirmLogoUpload}
            sx={{
              bgcolor: '#2563EB',
              color: '#FFFFFF',
              fontWeight: 800,
              textTransform: 'none',
              px: 3,
              borderRadius: '10px',
              '&:hover': { bgcolor: '#1D4ED8' }
            }}
          >
            {uploadingLogo ? 'Saving Original...' : 'Assign Original Image to Slot'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
