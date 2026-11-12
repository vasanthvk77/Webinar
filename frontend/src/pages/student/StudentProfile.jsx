import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Avatar,
  IconButton,
  Chip,
  Grid,
  MenuItem,
  CircularProgress,
  Tooltip,
  Paper,
  Divider,
  Autocomplete,
  InputAdornment,
} from '@mui/material';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SchoolIcon from '@mui/icons-material/School';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AccessTimeFilledIcon from '@mui/icons-material/AccessTimeFilled';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import MaleIcon from '@mui/icons-material/Male';
import FemaleIcon from '@mui/icons-material/Female';
import TransgenderIcon from '@mui/icons-material/Transgender';
import toast from 'react-hot-toast';

import { useAuth } from '../../context/AuthContext';
import { useThemeColors, useAppTheme } from '../../context/ThemeContext';
import { studentProfileService, dashboardService } from '../../services/api';
import {
  WORLD_COUNTRIES,
  getCountryNameFromCode,
  getCountryFromCode,
  getFlagEmoji,
} from '../../utils/countryUtils';

export default function StudentProfile() {
  const { user, updateUser } = useAuth();
  const colors = useThemeColors();
  const { isDark } = useAppTheme();

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [activeTab, setActiveTab] = useState('personal'); // 'personal' | 'learning' | 'security'

  // Student telemetry stats for top badges
  const [stats, setStats] = useState({
    totalRegistrations: 0,
    completedWebinars: 0,
    certificatesEarned: 0,
    totalAttendedMinutes: 0,
  });

  // Profile Form State
  const [formData, setFormData] = useState({
    id: 0,
    firstName: '',
    lastName: '',
    email: '',
    mobileNumber: '',
    countryCode: '+91',
    countryName: 'India',
    gender: 1, // 1: Male, 2: Female, 3: Others
    profileUrl: '',
    roleName: 'Student',
  });

  // Image preview state
  const [previewImage, setPreviewImage] = useState(null);
  const fileInputRef = useRef(null);

  // Load profile data on mount
  useEffect(() => {
    fetchProfileData();
    fetchStatsData();
  }, []);

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      const res = await studentProfileService.getProfile();
      if (res.data?.success && res.data?.data) {
        const p = res.data.data;
        // Normalize country code
        let normalizedCode = p.countryCode || '+91';
        if (!normalizedCode.startsWith('+') && normalizedCode.length > 0) {
          normalizedCode = `+${normalizedCode}`;
        }
        const resolvedCountryName = getCountryNameFromCode(normalizedCode);

        setFormData({
          id: p.id || 0,
          firstName: p.firstName || '',
          lastName: p.lastName || '',
          email: p.email || '',
          mobileNumber: p.mobileNumber || '',
          countryCode: normalizedCode,
          countryName: resolvedCountryName,
          gender: p.gender === 2 ? 2 : p.gender === 3 ? 3 : 1, // Default to Male (1) if unset
          profileUrl: p.profileUrl || '',
          roleName: p.roleName || 'Student',
        });
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      toast.error('Unable to load student profile details.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatsData = async () => {
    try {
      const res = await dashboardService.getStudentStats();
      if (res.data?.success && res.data?.data?.stats) {
        const s = res.data.data.stats;
        setStats({
          totalRegistrations: s.totalRegistrations || 0,
          completedWebinars: s.completedWebinars || 0,
          certificatesEarned: s.certificatesEarned || 0,
          totalAttendedMinutes: s.totalAttendedMinutes || 0,
        });
      }
    } catch (err) {
      console.warn('Dashboard stats fallback:', err);
    }
  };

  // Resolve absolute avatar URL
  const getFullAvatarUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const apiBase = (import.meta.env.VITE_API_BASE_URL || 'https://localhost:7001').replace(/\/$/, '');
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    return `${apiBase}${cleanPath}`;
  };

  // Handle image upload
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file (JPG, PNG, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5 MB.');
      return;
    }

    // Set immediate client preview
    const reader = new FileReader();
    reader.onload = () => setPreviewImage(reader.result);
    reader.readAsDataURL(file);

    // Upload to backend
    setUploadingPhoto(true);
    const form = new FormData();
    form.append('file', file);

    try {
      const res = await studentProfileService.uploadPhoto(form);
      if (res.data?.success && res.data?.profileUrl) {
        setFormData((prev) => ({ ...prev, profileUrl: res.data.profileUrl }));
        toast.success('Profile photo updated successfully!');

        // Update local user context if present
        if (updateUser) {
          updateUser({ profileUrl: res.data.profileUrl });
        }
      } else {
        toast.error(res.data?.message || 'Failed to save avatar image.');
      }
    } catch (err) {
      console.error('Avatar upload error:', err);
      toast.error(err.response?.data?.message || 'Failed to upload photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Active selected country object from library dataset
  const selectedCountry =
    WORLD_COUNTRIES.find(
      (c) => c.name.toLowerCase() === (formData.countryName || '').toLowerCase()
    ) ||
    WORLD_COUNTRIES.find(
      (c) => c.dialCode === formData.countryCode || c.numericDial === formData.countryCode?.replace(/[^\d]/g, '')
    ) ||
    WORLD_COUNTRIES[0];

  // Country selection using instant searchable Autocomplete (no UI lag, no accidental selection)
  const handleCountrySelect = (event, newCountry) => {
    if (newCountry) {
      setFormData((prev) => ({
        ...prev,
        countryName: newCountry.name,
        countryCode: newCountry.dialCode,
      }));
    }
  };

  // Handle form submission
  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();

    if (!formData.firstName.trim()) {
      toast.error('First name is required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        mobileNumber: formData.mobileNumber.trim(),
        countryCode: formData.countryCode.trim(),
        gender: Number(formData.gender),
        profileUrl: formData.profileUrl,
      };

      const res = await studentProfileService.updateProfile(payload);
      if (res.data?.success) {
        toast.success('Profile changes saved successfully!');
        if (res.data?.data) {
          const updated = res.data.data;
          const updatedCode = updated.countryCode || formData.countryCode;
          const updatedName = getCountryNameFromCode(updatedCode);
          setFormData((prev) => ({
            ...prev,
            firstName: updated.firstName || prev.firstName,
            lastName: updated.lastName || '',
            mobileNumber: updated.mobileNumber || '',
            countryCode: updatedCode,
            countryName: updatedName,
            gender: updated.gender || prev.gender,
            profileUrl: updated.profileUrl || prev.profileUrl,
          }));

          // Sync with local user state
          if (updateUser) {
            updateUser({
              firstName: updated.firstName,
              lastName: updated.lastName,
              profileUrl: updated.profileUrl,
            });
          }
        }
      } else {
        toast.error(res.data?.message || 'Failed to update profile.');
      }
    } catch (err) {
      console.error('Save profile error:', err);
      toast.error(err.response?.data?.message || 'Error occurred while saving profile.');
    } finally {
      setSaving(false);
    }
  };

  const attendedHours = Math.round((stats.totalAttendedMinutes / 60) * 10) / 10;
  const initials = `${formData.firstName?.[0] || 'S'}${formData.lastName?.[0] || 'T'}`.toUpperCase();
  const currentAvatarSrc = previewImage || getFullAvatarUrl(formData.profileUrl);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 2 }}>
        <CircularProgress sx={{ color: '#6869ff' }} />
        <Typography sx={{ color: colors.textSecondary, fontSize: 14, fontWeight: 550 }}>
          Loading student profile...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1140, mx: 'auto', pb: 8 }}>
      {/* ─────────────────────────────────────────────────────────────
          1. TOP AURA BANNER & SILICONE-MORPHIC IDENTITY HEADER
          Matches reference design with linear aurora + squircle profile
      ────────────────────────────────────────────────────────────── */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: '28px',
          overflow: 'hidden',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(230, 235, 245, 0.9)'}`,
          bgcolor: colors.surface,
          boxShadow: isDark
            ? '0 20px 40px -15px rgba(0, 0, 0, 0.5)'
            : '0 20px 48px -12px rgba(99, 102, 241, 0.08), 0 1px 3px rgba(0,0,0,0.02)',
          mb: 4,
          position: 'relative',
        }}
      >
        {/* Aura Top Gradient Banner (Sourced from global theme.js) */}
        <Box
          sx={{
            height: { xs: 150, sm: 190, md: 220 },
            width: '100%',
            position: 'relative',
            background: colors.bannerBg,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            p: { xs: 2.5, md: 3.5 },
          }}
        >
          {/* Subtle star / sparkle accent in banner */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesomeIcon
              sx={{
                fontSize: 22,
                color: colors.bannerSparkle,
                opacity: 0.95,
              }}
            />
            <Typography
              sx={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.4px',
                color: colors.bannerBadgeText,
                textTransform: 'uppercase',
              }}
            >
              WebLearn Student Identity
            </Typography>
          </Box>

          <Button
            size="small"
            startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
            onClick={() => { fetchProfileData(); fetchStatsData(); }}
            sx={{
              bgcolor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(10px)',
              color: colors.textPrimary,
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.95)'}`,
              borderRadius: '12px',
              px: 1.75,
              py: 0.6,
              fontSize: '12px',
              fontWeight: 650,
              textTransform: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              '&:hover': {
                bgcolor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#ffffff',
                transform: 'translateY(-1px)',
              },
            }}
          >
            Refresh
          </Button>
        </Box>

        {/* Silicone Squircle Profile Section */}
        <Box
          sx={{
            px: { xs: 2.5, sm: 4, md: 5 },
            pb: { xs: 3, md: 4 },
            pt: 0,
            mt: { xs: -9, sm: -11, md: -13 },
            position: 'relative',
            zIndex: 2,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: { xs: 'flex-start', md: 'flex-end' },
              justifyContent: 'space-between',
              gap: 3,
            }}
          >
            {/* Left: Squircle Avatar + Name & Details */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'flex-start', sm: 'flex-end' },
                gap: { xs: 2.5, sm: 3.5 },
              }}
            >
              {/* Silicone Morphism Squircle Avatar Container */}
              <Box sx={{ position: 'relative', flexShrink: 0 }}>
                <Box
                  sx={{
                    width: { xs: 128, sm: 154, md: 172 },
                    height: { xs: 128, sm: 154, md: 172 },
                    borderRadius: { xs: '32px', sm: '40px' },
                    overflow: 'hidden',
                    position: 'relative',
                    // Silicone morphism: translucent outer borders with soft layered glows
                    bgcolor: isDark ? '#1e293b' : '#ffffff',
                    border: isDark
                      ? '6px solid rgba(30, 41, 59, 0.9)'
                      : '8px solid rgba(255, 255, 255, 0.95)',
                    boxShadow: isDark
                      ? '0 20px 45px -10px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.15)'
                      : '0 22px 50px -12px rgba(104, 105, 255, 0.28), 0 8px 24px -6px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(220, 226, 245, 0.8)',
                    transition: 'all 0.3s ease',
                    '&:hover .avatar-overlay': {
                      opacity: 1,
                    },
                  }}
                >
                  {currentAvatarSrc ? (
                    <Box
                      component="img"
                      src={currentAvatarSrc}
                      alt="Student Avatar"
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, #6869ff 0%, #4338ca 100%)',
                        color: '#ffffff',
                        fontSize: { xs: 40, sm: 50, md: 56 },
                        fontWeight: 750,
                        letterSpacing: '-0.5px',
                      }}
                    >
                      {initials}
                    </Box>
                  )}

                  {/* Silicone Morphic Hover Overlay for Photo Upload */}
                  <Box
                    className="avatar-overlay"
                    onClick={() => fileInputRef.current?.click()}
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      bgcolor: 'rgba(15, 23, 42, 0.65)',
                      backdropFilter: 'blur(5px)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      opacity: uploadingPhoto ? 1 : 0,
                      transition: 'opacity 0.25s ease',
                      gap: 0.8,
                    }}
                  >
                    {uploadingPhoto ? (
                      <CircularProgress size={28} sx={{ color: '#ffffff' }} />
                    ) : (
                      <>
                        <CameraAltIcon sx={{ color: '#ffffff', fontSize: 28 }} />
                        <Typography sx={{ color: '#ffffff', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                          Change Photo
                        </Typography>
                      </>
                    )}
                  </Box>
                </Box>

                {/* Silicone quick-action badge button on bottom right of avatar */}
                <Tooltip title="Upload new photo" arrow>
                  <IconButton
                    size="small"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    sx={{
                      position: 'absolute',
                      bottom: 4,
                      right: 4,
                      width: 38,
                      height: 38,
                      borderRadius: '14px',
                      bgcolor: '#6869ff',
                      color: '#ffffff',
                      boxShadow: '0 6px 18px rgba(104, 105, 255, 0.45)',
                      border: '3px solid #ffffff',
                      '&:hover': {
                        bgcolor: '#5254eb',
                        transform: 'scale(1.06)',
                      },
                    }}
                  >
                    <CameraAltIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </Tooltip>

                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  style={{ display: 'none' }}
                />
              </Box>

              {/* Identity & Badges (Matches Portfolia Reference Header) */}
              <Box sx={{ pb: { xs: 0, sm: 0.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 0.75 }}>
                  <Typography
                    sx={{
                      fontSize: { xs: 24, sm: 28, md: 32 },
                      fontWeight: 750,
                      color: colors.textPrimary,
                      lineHeight: 1.2,
                      letterSpacing: '-0.4px',
                    }}
                  >
                    {formData.firstName || 'Student'} {formData.lastName || ''}
                  </Typography>

                  {/* PRO/STUDENT Capsule Pill (Reference style) */}
                  <Chip
                    icon={<AutoAwesomeIcon sx={{ fontSize: '13px !important', color: '#ffffff !important' }} />}
                    label="STUDENT"
                    size="small"
                    sx={{
                      bgcolor: '#6869ff',
                      color: '#ffffff',
                      fontWeight: 750,
                      fontSize: '11px',
                      letterSpacing: '0.5px',
                      height: 25,
                      borderRadius: '8px',
                      px: 0.5,
                      boxShadow: '0 4px 12px rgba(104, 105, 255, 0.35)',
                    }}
                  />

                  <Chip
                    icon={<CheckCircleIcon sx={{ fontSize: '13px !important', color: '#10b981 !important' }} />}
                    label="Verified Profile"
                    size="small"
                    sx={{
                      bgcolor: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
                      color: '#10b981',
                      fontWeight: 650,
                      fontSize: '11px',
                      height: 25,
                      borderRadius: '8px',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                    }}
                  />
                </Box>

                <Typography
                  sx={{
                    fontSize: { xs: 13, sm: 14 },
                    color: colors.textSecondary,
                    fontWeight: 500,
                    mb: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                  }}
                >
                  <span>Student ID #{formData.id.toString().padStart(5, '0')}</span>
                  <span>•</span>
                  <span>{formData.countryName || 'Global'}</span>
                  <span>•</span>
                  <span style={{ color: colors.textMuted }}>{formData.email}</span>
                </Typography>

                {/* Action Buttons (Follow / Get In Touch style from reference) */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    onClick={handleSaveProfile}
                    disabled={saving}
                    startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon sx={{ fontSize: 17 }} />}
                    sx={{
                      bgcolor: '#111827',
                      color: '#ffffff',
                      borderRadius: '12px',
                      px: 3,
                      py: 1,
                      fontSize: '13px',
                      fontWeight: 650,
                      textTransform: 'none',
                      boxShadow: '0 6px 18px rgba(17, 24, 39, 0.2)',
                      '&:hover': {
                        bgcolor: '#1f2937',
                        transform: 'translateY(-1px)',
                      },
                    }}
                  >
                    {saving ? 'Saving...' : 'Save Profile'}
                  </Button>

                  <Button
                    variant="outlined"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    startIcon={<CameraAltIcon sx={{ fontSize: 17 }} />}
                    sx={{
                      color: colors.textPrimary,
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(209, 213, 219, 0.9)',
                      borderRadius: '12px',
                      px: 2.5,
                      py: 0.95,
                      fontSize: '13px',
                      fontWeight: 600,
                      textTransform: 'none',
                      bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#ffffff',
                      '&:hover': {
                        borderColor: '#6869ff',
                        color: '#6869ff',
                        bgcolor: isDark ? 'rgba(104, 105, 255, 0.08)' : 'rgba(104, 105, 255, 0.04)',
                      },
                    }}
                  >
                    Change Avatar
                  </Button>
                </Box>
              </Box>
            </Box>

            {/* Right: Counter Stats Badges (Followers / Following / Likes style from reference image) */}
            {/* <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: { xs: 2.5, sm: 3.5 },
                mt: { xs: 2, md: 0 },
                pb: { xs: 0, sm: 1 },
                alignSelf: { xs: 'stretch', md: 'flex-end' },
                justifyContent: { xs: 'space-between', sm: 'flex-start', md: 'flex-end' },
                borderTop: { xs: `1px solid ${colors.border}`, md: 'none' },
                pt: { xs: 2, md: 0 },
              }}
            >
              
              <Box sx={{ textAlign: 'center' }}>
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    mx: 'auto',
                    mb: 0.75,
                    borderRadius: '12px',
                    bgcolor: 'rgba(249, 115, 22, 0.12)',
                    color: '#f97316',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 750,
                    fontSize: 14,
                  }}
                >
                  <SchoolIcon sx={{ fontSize: 20 }} />
                </Box>
                <Typography sx={{ fontSize: 11, color: colors.textMuted, fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                  Enrolled
                </Typography>
                <Typography sx={{ fontSize: 22, fontWeight: 750, color: colors.textPrimary, lineHeight: 1.2 }}>
                  {stats.totalRegistrations}
                </Typography>
              </Box>

              
              <Box sx={{ textAlign: 'center' }}>
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    mx: 'auto',
                    mb: 0.75,
                    borderRadius: '12px',
                    bgcolor: 'rgba(104, 105, 255, 0.12)',
                    color: '#6869ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 750,
                    fontSize: 14,
                  }}
                >
                  <HowToRegIcon sx={{ fontSize: 20 }} />
                </Box>
                <Typography sx={{ fontSize: 11, color: colors.textMuted, fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                  Completed
                </Typography>
                <Typography sx={{ fontSize: 22, fontWeight: 750, color: colors.textPrimary, lineHeight: 1.2 }}>
                  {stats.completedWebinars}
                </Typography>
              </Box>

              <Box sx={{ textAlign: 'center' }}>
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    mx: 'auto',
                    mb: 0.75,
                    borderRadius: '12px',
                    bgcolor: 'rgba(16, 185, 129, 0.12)',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 750,
                    fontSize: 14,
                  }}
                >
                  <EmojiEventsIcon sx={{ fontSize: 20 }} />
                </Box>
                <Typography sx={{ fontSize: 11, color: colors.textMuted, fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                  Certificates
                </Typography>
                <Typography sx={{ fontSize: 22, fontWeight: 750, color: colors.textPrimary, lineHeight: 1.2 }}>
                  {stats.certificatesEarned}
                </Typography>
              </Box>

             
              <Box sx={{ textAlign: 'center' }}>
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    mx: 'auto',
                    mb: 0.75,
                    borderRadius: '12px',
                    bgcolor: 'rgba(245, 158, 11, 0.12)',
                    color: '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 750,
                    fontSize: 14,
                  }}
                >
                  <AccessTimeFilledIcon sx={{ fontSize: 20 }} />
                </Box>
                <Typography sx={{ fontSize: 11, color: colors.textMuted, fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                  Attended
                </Typography>
                <Typography sx={{ fontSize: 22, fontWeight: 750, color: colors.textPrimary, lineHeight: 1.2 }}>
                  {attendedHours}h
                </Typography>
              </Box>
            </Box> */}
          </Box>

          {/* Reference Image Style Navigation Tabs (Work, Moodboards, Likes, About) */}
          <Divider sx={{ my: 3, borderColor: colors.border }} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, overflowX: 'auto', pb: 0.5 }}>
            <Box
              onClick={() => setActiveTab('personal')}
              sx={{
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: activeTab === 'personal' ? 750 : 550,
                color: activeTab === 'personal' ? colors.textPrimary : colors.textMuted,
                pb: 1.2,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                transition: 'all 0.2s ease',
                '&:hover': { color: colors.textPrimary },
              }}
            >
              Personal Details
              {activeTab === 'personal' && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    bgcolor: '#6869ff',
                    borderRadius: '4px',
                  }}
                />
              )}
            </Box>

            <Box
              onClick={() => setActiveTab('learning')}
              sx={{
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: activeTab === 'learning' ? 750 : 550,
                color: activeTab === 'learning' ? colors.textPrimary : colors.textMuted,
                pb: 1.2,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                transition: 'all 0.2s ease',
                '&:hover': { color: colors.textPrimary },
              }}
            >
              Learning Profile
              <Box
                component="span"
                sx={{
                  fontSize: 11,
                  px: 0.75,
                  py: 0.1,
                  borderRadius: '10px',
                  bgcolor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                  color: colors.textSecondary,
                  fontWeight: 650,
                }}
              >
                {stats.totalRegistrations}
              </Box>
              {activeTab === 'learning' && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    bgcolor: '#6869ff',
                    borderRadius: '4px',
                  }}
                />
              )}
            </Box>

            <Box
              onClick={() => setActiveTab('security')}
              sx={{
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: activeTab === 'security' ? 750 : 550,
                color: activeTab === 'security' ? colors.textPrimary : colors.textMuted,
                pb: 1.2,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                transition: 'all 0.2s ease',
                '&:hover': { color: colors.textPrimary },
              }}
            >
              Account & Credentials
              {activeTab === 'security' && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    bgcolor: '#6869ff',
                    borderRadius: '4px',
                  }}
                />
              )}
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* ─────────────────────────────────────────────────────────────
          2. TAB CONTENTS: PERSONAL DETAILS FORM
      ────────────────────────────────────────────────────────────── */}
      {activeTab === 'personal' && (
        <Paper
          elevation={0}
          component="form"
          onSubmit={handleSaveProfile}
          sx={{
            p: { xs: 3, sm: 4, md: 4.5 },
            borderRadius: '24px',
            bgcolor: colors.surface,
            border: `1px solid ${colors.border}`,
            boxShadow: isDark
              ? '0 10px 30px rgba(0,0,0,0.3)'
              : '0 12px 36px -10px rgba(23, 35, 56, 0.05)',
          }}
        >
          <Box sx={{ mb: 3.5 }}>
            <Typography sx={{ fontSize: 18, fontWeight: 750, color: colors.textPrimary, mb: 0.5 }}>
              Learner Information
            </Typography>
            <Typography sx={{ fontSize: 13, color: colors.textSecondary }}>
              Keep your contact details up to date for webinar notifications and verified certification records.
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
            {/* Row 1: First Name, Last Name, and Email Address all in the SAME ROW */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1.15fr' },
                gap: 2.5,
                width: '100%',
                alignItems: 'flex-start',
              }}
            >
              {/* 1. First Name */}
              <Box sx={{ width: '100%', minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 650, color: colors.textPrimary, mb: 1 }}>
                  First Name <span style={{ color: '#ef4444' }}>*</span>
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="Enter your first name"
                  required
                  InputProps={{
                    sx: {
                      borderRadius: '12px',
                      bgcolor: isDark ? colors.surfaceAlt : '#ffffff',
                      fontSize: 14,
                      fontWeight: 550,
                      height: '42px',
                    },
                  }}
                />
              </Box>

              {/* 2. Last Name */}
              <Box sx={{ width: '100%', minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 650, color: colors.textPrimary, mb: 1 }}>
                  Last Name
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="Enter your last name"
                  InputProps={{
                    sx: {
                      borderRadius: '12px',
                      bgcolor: isDark ? colors.surfaceAlt : '#ffffff',
                      fontSize: 14,
                      fontWeight: 550,
                      height: '42px',
                    },
                  }}
                />
              </Box>

              {/* 3. Email Address */}
              <Box sx={{ width: '100%', minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 650, color: colors.textPrimary }}>
                    Email Address
                  </Typography>
                  <Chip
                    icon={<LockOutlinedIcon sx={{ fontSize: '11px !important', color: colors.textMuted }} />}
                    label="Read-only"
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '10px',
                      fontWeight: 600,
                      bgcolor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                      color: colors.textMuted,
                    }}
                  />
                </Box>
                <TextField
                  fullWidth
                  size="small"
                  value={formData.email}
                  disabled
                  InputProps={{
                    startAdornment: (
                      <LockOutlinedIcon sx={{ fontSize: 16, color: colors.textMuted, mr: 1 }} />
                    ),
                    sx: {
                      borderRadius: '12px',
                      bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(243, 244, 246, 0.75)',
                      fontSize: 13.5,
                      fontWeight: 550,
                      color: colors.textSecondary,
                      height: '42px',
                    },
                  }}
                />
              </Box>
            </Box>

            {/* Row 2: Country, Phone Number, and Gender in the SAME ROW */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' },
                gap: 2.5,
                width: '100%',
                alignItems: 'flex-start',
              }}
            >
              {/* 1. Country */}
              <Box sx={{ width: '100%', minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 650, color: colors.textPrimary, mb: 1 }}>
                  Country
                </Typography>
                <Autocomplete
                  fullWidth
                  size="small"
                  autoHighlight
                  options={WORLD_COUNTRIES}
                  getOptionLabel={(option) => `${option.name} (${option.dialCode})`}
                  value={selectedCountry}
                  onChange={handleCountrySelect}
                  isOptionEqualToValue={(option, val) => option.name === val?.name || option.dialCode === val?.dialCode}
                  disableClearable
                  sx={{
                    width: '100%',
                    '& .MuiOutlinedInput-root': {
                      width: '100%',
                      height: '42px',
                      borderRadius: '12px',
                      bgcolor: isDark ? colors.surfaceAlt : '#ffffff',
                      fontSize: 13.5,
                      fontWeight: 550,
                    },
                  }}
                  slotProps={{
                    popper: {
                      sx: {
                        width: '380px !important',
                        minWidth: '320px',
                        maxWidth: '90vw',
                        '& .MuiPaper-root': {
                          borderRadius: '14px',
                          boxShadow: isDark
                            ? '0 16px 48px rgba(0,0,0,0.5)'
                            : '0 16px 48px rgba(23, 35, 56, 0.12)',
                          border: `1px solid ${colors.border}`,
                          mt: 0.5,
                        },
                      },
                    },
                  }}
                  renderOption={(props, option) => {
                    const { key, ...restProps } = props;
                    return (
                      <Box
                        key={`${option.iso2}-${option.name}`}
                        component="li"
                        {...restProps}
                        sx={{
                          fontSize: 13.5,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.25,
                          py: 1,
                          px: 1.5,
                        }}
                      >
                        <span style={{ fontSize: 20 }}>{option.flag}</span>
                        <span style={{ fontWeight: 550, color: colors.textPrimary, flex: 1 }}>{option.name}</span>
                        <span style={{ color: colors.textMuted, fontSize: 12.5, fontWeight: 600 }}>
                          {option.dialCode}
                        </span>
                      </Box>
                    );
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      fullWidth
                      placeholder="Search country..."
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <InputAdornment position="start" sx={{ ml: 0.5 }}>
                            <span style={{ fontSize: 18 }}>{selectedCountry?.flag || '🌐'}</span>
                          </InputAdornment>
                        ),
                        sx: {
                          borderRadius: '12px',
                          bgcolor: isDark ? colors.surfaceAlt : '#ffffff',
                          fontSize: 13.5,
                          fontWeight: 550,
                          width: '100%',
                          height: '42px',
                        },
                      }}
                    />
                  )}
                />
              </Box>

              {/* 2. Phone Number */}
              <Box sx={{ width: '100%', minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 650, color: colors.textPrimary, mb: 1 }}>
                  Phone Number
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={formData.mobileNumber}
                  onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value.replace(/[^0-9]/g, '') })}
                  placeholder="e.g. 514203043"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Box
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.5,
                            px: 1,
                            py: 0.25,
                            borderRadius: '8px',
                            bgcolor: isDark ? 'rgba(104, 105, 255, 0.18)' : 'rgba(104, 105, 255, 0.08)',
                            color: '#6869ff',
                            fontWeight: 700,
                            fontSize: 12.5,
                            border: `1px solid ${isDark ? 'rgba(104, 105, 255, 0.3)' : 'rgba(104, 105, 255, 0.2)'}`,
                            userSelect: 'none',
                          }}
                        >
                          <span>{selectedCountry?.flag || '🌐'}</span>
                          <span>{formData.countryCode || '+91'}</span>
                        </Box>
                      </InputAdornment>
                    ),
                    sx: {
                      borderRadius: '12px',
                      bgcolor: isDark ? colors.surfaceAlt : '#ffffff',
                      fontSize: 13.5,
                      fontWeight: 550,
                      height: '42px',
                    },
                  }}
                />
              </Box>

              {/* 3. Gender */}
              <Box sx={{ width: '100%', minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 650, color: colors.textPrimary, mb: 1 }}>
                  Gender
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, height: '42px' }}>
                  {/* Male Option */}
                  <Box
                    onClick={() => setFormData({ ...formData, gender: 1 })}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 0.5,
                      height: '100%',
                      px: 0.5,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontSize: 12.5,
                      fontWeight: 650,
                      transition: 'all 0.2s ease',
                      border: `1.5px solid ${formData.gender === 1 ? '#6869ff' : colors.border}`,
                      bgcolor: formData.gender === 1
                        ? isDark ? 'rgba(104, 105, 255, 0.18)' : 'rgba(104, 105, 255, 0.08)'
                        : isDark ? colors.surfaceAlt : '#ffffff',
                      color: formData.gender === 1 ? '#6869ff' : colors.textSecondary,
                      boxShadow: formData.gender === 1 ? '0 4px 14px rgba(104, 105, 255, 0.2)' : 'none',
                      '&:hover': {
                        borderColor: '#6869ff',
                      },
                    }}
                  >
                    <MaleIcon sx={{ fontSize: 16 }} />
                    Male
                  </Box>

                  {/* Female Option */}
                  <Box
                    onClick={() => setFormData({ ...formData, gender: 2 })}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 0.5,
                      height: '100%',
                      px: 0.5,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontSize: 12.5,
                      fontWeight: 650,
                      transition: 'all 0.2s ease',
                      border: `1.5px solid ${formData.gender === 2 ? '#ec4899' : colors.border}`,
                      bgcolor: formData.gender === 2
                        ? isDark ? 'rgba(236, 72, 153, 0.18)' : 'rgba(236, 72, 153, 0.08)'
                        : isDark ? colors.surfaceAlt : '#ffffff',
                      color: formData.gender === 2 ? '#ec4899' : colors.textSecondary,
                      boxShadow: formData.gender === 2 ? '0 4px 14px rgba(236, 72, 153, 0.2)' : 'none',
                      '&:hover': {
                        borderColor: '#ec4899',
                      },
                    }}
                  >
                    <FemaleIcon sx={{ fontSize: 16 }} />
                    Female
                  </Box>

                  {/* Others Option */}
                  <Box
                    onClick={() => setFormData({ ...formData, gender: 3 })}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 0.5,
                      height: '100%',
                      px: 0.5,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontSize: 12.5,
                      fontWeight: 650,
                      transition: 'all 0.2s ease',
                      border: `1.5px solid ${formData.gender === 3 ? '#10b981' : colors.border}`,
                      bgcolor: formData.gender === 3
                        ? isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.08)'
                        : isDark ? colors.surfaceAlt : '#ffffff',
                      color: formData.gender === 3 ? '#10b981' : colors.textSecondary,
                      boxShadow: formData.gender === 3 ? '0 4px 14px rgba(16, 185, 129, 0.2)' : 'none',
                      '&:hover': {
                        borderColor: '#10b981',
                      },
                    }}
                  >
                    <TransgenderIcon sx={{ fontSize: 16 }} />
                    Others
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Form Actions Footer */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 2,
              mt: 4,
              pt: 3,
              borderTop: `1px solid ${colors.border}`,
            }}
          >
            <Button
              type="button"
              onClick={fetchProfileData}
              disabled={saving}
              sx={{
                color: colors.textSecondary,
                fontSize: 13,
                fontWeight: 600,
                textTransform: 'none',
                borderRadius: '10px',
                px: 2.5,
              }}
            >
              Reset Changes
            </Button>

            <Button
              type="submit"
              variant="contained"
              disabled={saving}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon sx={{ fontSize: 17 }} />}
              sx={{
                bgcolor: '#6869ff',
                color: '#ffffff',
                borderRadius: '12px',
                px: 4,
                py: 1.1,
                fontSize: 13.5,
                fontWeight: 700,
                textTransform: 'none',
                boxShadow: '0 8px 24px -4px rgba(104, 105, 255, 0.45)',
                '&:hover': {
                  bgcolor: '#5254eb',
                  transform: 'translateY(-1px)',
                },
              }}
            >
              {saving ? 'Updating...' : 'Save Profile Changes'}
            </Button>
          </Box>
        </Paper>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. TAB 2: LEARNING JOURNEY QUICK VIEW
      ────────────────────────────────────────────────────────────── */}
      {activeTab === 'learning' && (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4 },
            borderRadius: '24px',
            bgcolor: colors.surface,
            border: `1px solid ${colors.border}`,
          }}
        >
          <Box sx={{ mb: 3 }}>
            <Typography sx={{ fontSize: 18, fontWeight: 750, color: colors.textPrimary, mb: 0.5 }}>
              Academic & Cohort Participation
            </Typography>
            <Typography sx={{ fontSize: 13, color: colors.textSecondary }}>
              Telemetry overview of your enrolled sessions, completed certificates, and total learning duration.
            </Typography>
          </Box>

          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={3}>
              <Box
                sx={{
                  p: 2.5,
                  borderRadius: '16px',
                  bgcolor: isDark ? colors.surfaceAlt : '#f8faff',
                  border: `1px solid ${colors.border}`,
                }}
              >
                <Typography sx={{ fontSize: 12, fontWeight: 650, color: colors.textMuted }}>
                  Total Registrations
                </Typography>
                <Typography sx={{ fontSize: 26, fontWeight: 750, color: colors.textPrimary, mt: 0.5 }}>
                  {stats.totalRegistrations}
                </Typography>
                <Typography sx={{ fontSize: 11.5, color: colors.textSecondary, mt: 0.25 }}>
                  Webinars enrolled
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Box
                sx={{
                  p: 2.5,
                  borderRadius: '16px',
                  bgcolor: isDark ? colors.surfaceAlt : '#f8faff',
                  border: `1px solid ${colors.border}`,
                }}
              >
                <Typography sx={{ fontSize: 12, fontWeight: 650, color: colors.textMuted }}>
                  Completed Webinars
                </Typography>
                <Typography sx={{ fontSize: 26, fontWeight: 750, color: '#10b981', mt: 0.5 }}>
                  {stats.completedWebinars}
                </Typography>
                <Typography sx={{ fontSize: 11.5, color: colors.textSecondary, mt: 0.25 }}>
                  Successfully finished
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Box
                sx={{
                  p: 2.5,
                  borderRadius: '16px',
                  bgcolor: isDark ? colors.surfaceAlt : '#f8faff',
                  border: `1px solid ${colors.border}`,
                }}
              >
                <Typography sx={{ fontSize: 12, fontWeight: 650, color: colors.textMuted }}>
                  Certificates Earned
                </Typography>
                <Typography sx={{ fontSize: 26, fontWeight: 750, color: '#6869ff', mt: 0.5 }}>
                  {stats.certificatesEarned}
                </Typography>
                <Typography sx={{ fontSize: 11.5, color: colors.textSecondary, mt: 0.25 }}>
                  Verified credentials
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Box
                sx={{
                  p: 2.5,
                  borderRadius: '16px',
                  bgcolor: isDark ? colors.surfaceAlt : '#f8faff',
                  border: `1px solid ${colors.border}`,
                }}
              >
                <Typography sx={{ fontSize: 12, fontWeight: 650, color: colors.textMuted }}>
                  Learning Duration
                </Typography>
                <Typography sx={{ fontSize: 26, fontWeight: 750, color: '#f59e0b', mt: 0.5 }}>
                  {attendedHours} hrs
                </Typography>
                <Typography sx={{ fontSize: 11.5, color: colors.textSecondary, mt: 0.25 }}>
                  Total live time
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. TAB 3: ACCOUNT & CREDENTIALS
      ────────────────────────────────────────────────────────────── */}
      {activeTab === 'security' && (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4 },
            borderRadius: '24px',
            bgcolor: colors.surface,
            border: `1px solid ${colors.border}`,
          }}
        >
          <Box sx={{ mb: 3 }}>
            <Typography sx={{ fontSize: 18, fontWeight: 750, color: colors.textPrimary, mb: 0.5 }}>
              Account & Credentials
            </Typography>
            <Typography sx={{ fontSize: 13, color: colors.textSecondary }}>
              Security parameters associated with your student profile.
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box
              sx={{
                p: 2.5,
                borderRadius: '16px',
                border: `1px solid ${colors.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Typography sx={{ fontSize: 14, fontWeight: 650, color: colors.textPrimary }}>
                  Primary Email Anchor
                </Typography>
                <Typography sx={{ fontSize: 12.5, color: colors.textSecondary }}>
                  {formData.email}
                </Typography>
              </Box>
              <Chip label="Verified" size="small" color="success" sx={{ fontWeight: 650, borderRadius: '8px' }} />
            </Box>

            <Box
              sx={{
                p: 2.5,
                borderRadius: '16px',
                border: `1px solid ${colors.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Typography sx={{ fontSize: 14, fontWeight: 650, color: colors.textPrimary }}>
                  Role & Platform Permissions
                </Typography>
                <Typography sx={{ fontSize: 12.5, color: colors.textSecondary }}>
                  Student (Role Level 3) — Access to webinars, certificates, live meeting rooms, and attendance analytics.
                </Typography>
              </Box>
              <Chip label="Student" size="small" sx={{ bgcolor: '#6869ff', color: '#fff', fontWeight: 650, borderRadius: '8px' }} />
            </Box>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
