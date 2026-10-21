import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Paper, Grid, Chip, IconButton,
  Tooltip, CircularProgress, Dialog, DialogContent, DialogActions,
  Divider, TextField
} from '@mui/material';
import CardMembershipIcon  from '@mui/icons-material/CardMembership';
import DownloadIcon        from '@mui/icons-material/Download';
import VisibilityIcon      from '@mui/icons-material/Visibility';
import TuneIcon            from '@mui/icons-material/Tune';
import RefreshIcon         from '@mui/icons-material/Refresh';
import PictureAsPdfIcon    from '@mui/icons-material/PictureAsPdf';
import CheckCircleIcon     from '@mui/icons-material/CheckCircle';
import AspectRatioIcon     from '@mui/icons-material/AspectRatio';
import PrintIcon           from '@mui/icons-material/Print';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import toast               from 'react-hot-toast';

import { certificateService } from '../../services/api';
import { useThemeColors }     from '../../context/ThemeContext';
import CustomSearchBar        from '../../components/CustomSearchBar';

export default function Certifications() {
  const colors = useThemeColors();

  const [templates, setTemplates]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  // Fullscreen preview modal
  const [previewTemplate, setPreviewTemplate] = useState(null);

  // Customize & download modal
  const [customModalTemplate, setCustomModalTemplate] = useState(null);
  const [customForm, setCustomForm] = useState({
    participantName: 'Vasanth Kumar',
    webinarName: 'AI & Neural Networks Masterclass',
    date: new Date().toISOString().split('T')[0],
    certificateId: 'PDX-WB-' + new Date().getFullYear() + '-0001'
  });
  const [generatingCustom, setGeneratingCustom] = useState(false);

  // Load templates from backend Images directory
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await certificateService.getTemplates();
      if (res.data?.success) {
        setTemplates(res.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching certificate templates:', err);
      toast.error('Failed to load certificate templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const filteredTemplates = templates.filter(t =>
    t.name?.toLowerCase().includes(search.toLowerCase()) ||
    t.fileName?.toLowerCase().includes(search.toLowerCase())
  );

  // Trigger browser download from blob
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

  // Download PDF Handler
  const handleDownloadPdf = async (template) => {
    setDownloadingId(template.id);
    try {
      const res = await certificateService.downloadPdf(template.id);
      triggerBlobDownload(res.data, `${template.id}-Certificate.pdf`);
      toast.success('Certificate PDF downloaded successfully! 🎓');
    } catch (err) {
      console.error('Error downloading certificate PDF:', err);
      toast.error('Failed to download certificate PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  // Generate & Download Custom PDF
  const handleGenerateCustomPdf = async () => {
    if (!customModalTemplate) return;
    setGeneratingCustom(true);
    try {
      const res = await certificateService.downloadPdf(customModalTemplate.id, {
        participantName: customForm.participantName,
        webinarName: customForm.webinarName,
        date: customForm.date,
        certificateId: customForm.certificateId
      });
      triggerBlobDownload(res.data, `${customModalTemplate.id}-${customForm.certificateId || 'Custom'}.pdf`);
      toast.success('Customized Certificate PDF generated and downloaded! 🎓');
      setCustomModalTemplate(null);
    } catch (err) {
      console.error('Error generating customized certificate PDF:', err);
      toast.error('Failed to generate customized PDF');
    } finally {
      setGeneratingCustom(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', pb: 5 }}>
      {/* ── Sleek Admin Header ────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: 2,
                bgcolor: 'rgba(234, 179, 8, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.accentDark || '#CA8A04'
              }}
            >
              <WorkspacePremiumIcon />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: colors.primary, letterSpacing: '-0.3px' }}>
              Certificate Templates
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: colors.textSecondary }}>
            Official webinar completion certificate templates rendered into print-ready A4 vector PDFs via <strong>QuestPDF</strong>.
          </Typography>
        </Box>

        {/* Engine and Status Badges */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Chip
            icon={<PictureAsPdfIcon sx={{ fontSize: '15px !important', color: '#DC2626' }} />}
            label="QuestPDF v2026.9"
            size="small"
            sx={{
              fontWeight: 700,
              bgcolor: 'rgba(239, 68, 68, 0.08)',
              color: '#DC2626',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              height: 28
            }}
          />
          <Chip
            icon={<AspectRatioIcon sx={{ fontSize: '14px !important', color: colors.primary }} />}
            label="A4 Landscape"
            size="small"
            sx={{
              fontWeight: 700,
              bgcolor: colors.surfaceAlt,
              color: colors.primary,
              border: `1px solid ${colors.border}`,
              height: 28
            }}
          />
          <Tooltip title="Refresh Templates">
            <IconButton
              onClick={loadTemplates}
              size="small"
              sx={{
                border: `1px solid ${colors.border}`,
                borderRadius: 2,
                p: 0.7,
                color: colors.textSecondary,
                '&:hover': { color: colors.primary, borderColor: colors.primary }
              }}
            >
              <RefreshIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* ── Search Bar Row ────────────────────────────────────────────────── */}
      <Paper
        elevation={0}
        sx={{
          p: 1.2,
          mb: 3,
          borderRadius: 2.5,
          bgcolor: colors.surface,
          border: `1px solid ${colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <CustomSearchBar
          value={search}
          onChange={(val) => setSearch(val)}
          placeholder="Search templates by title or filename..."
          maxWidth={400}
          sx={{ flexGrow: 1 }}
        />

        <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 600, mr: 1 }}>
          {filteredTemplates.length} {filteredTemplates.length === 1 ? 'template' : 'templates'} found in Images folder
        </Typography>
      </Paper>

      {/* ── Main Showcase Area ────────────────────────────────────────────── */}
      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 10, gap: 1.5 }}>
          <CircularProgress size={38} sx={{ color: colors.accent }} />
          <Typography variant="body2" sx={{ color: colors.textSecondary, fontWeight: 600 }}>
            Scanning project Images directory for certificate templates...
          </Typography>
        </Box>
      ) : filteredTemplates.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            py: 8,
            px: 3,
            textAlign: 'center',
            borderRadius: 3,
            bgcolor: colors.surface,
            border: `1px dashed ${colors.border}`,
          }}
        >
          <CardMembershipIcon sx={{ fontSize: 56, color: colors.textMuted, mb: 1, opacity: 0.5 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: colors.textPrimary, mb: 0.5 }}>
            No Certificate Templates Found
          </Typography>
          <Typography variant="body2" sx={{ color: colors.textSecondary, maxWidth: 450, mx: 'auto', mb: 2.5 }}>
            Add your certificate template images (e.g. <code>CertificateTemplate1.png</code>) to the <strong>Images</strong> folder in the root directory.
          </Typography>
          <Button
            variant="contained"
            size="small"
            onClick={loadTemplates}
            sx={{ bgcolor: colors.accent, color: '#0F172A', fontWeight: 800, textTransform: 'none' }}
          >
            Reload Templates
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3.5}>
          {filteredTemplates.map((template) => {
            const isDownloading = downloadingId === template.id;
            const imgSrc = template.previewBase64 || template.previewUrl;

            return (
              <Grid item xs={12} lg={12} key={template.id}>
                <Paper
                  elevation={0}
                  sx={{
                    borderRadius: 3,
                    bgcolor: colors.surface,
                    border: `1px solid ${colors.border}`,
                    boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)',
                    overflow: 'hidden',
                    transition: 'all 0.25s ease',
                    '&:hover': {
                      boxShadow: '0 16px 36px -4px rgba(0,0,0,0.1)',
                      borderColor: colors.accent || '#EAB308',
                    }
                  }}
                >
                  <Grid container>
                    {/* Left/Main Column: Framed Certificate Canvas */}
                    <Grid item xs={12} md={7} sx={{ p: { xs: 2, sm: 3 }, bgcolor: colors.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Box
                        sx={{
                          width: '100%',
                          maxWidth: 680,
                          bgcolor: '#FFFFFF',
                          borderRadius: 2,
                          p: 1.2,
                          boxShadow: '0 15px 35px -8px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.08)',
                          position: 'relative',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          '&:hover .zoom-btn': { opacity: 1 },
                        }}
                        onClick={() => setPreviewTemplate(template)}
                      >
                        {/* Certificate Image Frame */}
                        <Box
                          sx={{
                            width: '100%',
                            aspectRatio: '1.414 / 1', // Standard A4 Landscape ratio
                            borderRadius: 1.2,
                            overflow: 'hidden',
                            bgcolor: '#FAFAFA',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid #E2E8F0'
                          }}
                        >
                          {imgSrc ? (
                            <Box
                              component="img"
                              src={imgSrc}
                              alt={template.name}
                              sx={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                display: 'block',
                                transition: 'transform 0.3s ease',
                                '&:hover': { transform: 'scale(1.015)' }
                              }}
                            />
                          ) : (
                            <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                              Loading certificate preview...
                            </Typography>
                          )}
                        </Box>

                        {/* Floating Zoom Button */}
                        <Button
                          className="zoom-btn"
                          variant="contained"
                          size="small"
                          startIcon={<VisibilityIcon />}
                          sx={{
                            position: 'absolute',
                            bottom: 20,
                            right: 20,
                            bgcolor: 'rgba(15, 23, 42, 0.85)',
                            color: '#FFFFFF',
                            backdropFilter: 'blur(6px)',
                            fontWeight: 700,
                            fontSize: '0.78rem',
                            textTransform: 'none',
                            opacity: 0,
                            transition: 'opacity 0.2s ease',
                            '&:hover': { bgcolor: '#0F172A' }
                          }}
                        >
                          Fullscreen View
                        </Button>
                      </Box>
                    </Grid>

                    {/* Right Column: Template Info & Actions */}
                    <Grid item xs={12} md={5} sx={{ p: { xs: 3, sm: 4 }, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <Box>
                        {/* Status chip */}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                          <Chip
                            icon={<CheckCircleIcon sx={{ fontSize: '14px !important', color: '#16A34A' }} />}
                            label="Active Official Template"
                            size="small"
                            sx={{
                              bgcolor: '#DCFCE7',
                              color: '#15803D',
                              fontWeight: 800,
                              fontSize: '0.74rem',
                              border: '1px solid #86EFAC'
                            }}
                          />
                          <Typography variant="caption" sx={{ color: colors.textMuted, fontFamily: 'monospace' }}>
                            {template.fileSizeFormatted}
                          </Typography>
                        </Box>

                        {/* Template Title */}
                        <Typography variant="h5" sx={{ fontWeight: 800, color: colors.primary, mb: 1, letterSpacing: '-0.3px' }}>
                          {template.name}
                        </Typography>

                        <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 3, lineHeight: 1.6 }}>
                          High-resolution certificate template for webinar participants. QuestPDF generates crisp, vector-standard A4 landscape PDFs with custom participant name, webinar topic, completion date, and cryptographic certificate ID.
                        </Typography>

                        {/* Specifications List */}
                        <Paper
                          elevation={0}
                          sx={{
                            p: 2,
                            borderRadius: 2,
                            bgcolor: colors.surfaceAlt,
                            border: `1px solid ${colors.border}`,
                            mb: 3,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1.2
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 600 }}>
                              Source Graphic
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: colors.textPrimary, fontFamily: 'monospace' }}>
                              {template.fileName}
                            </Typography>
                          </Box>

                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 600 }}>
                              PDF Dimensions
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: colors.textPrimary }}>
                              A4 Landscape (297 × 210 mm)
                            </Typography>
                          </Box>

                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 600 }}>
                              Generation Engine
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#DC2626' }}>
                              QuestPDF (C# Fluent Engine)
                            </Typography>
                          </Box>
                        </Paper>
                      </Box>

                      {/* Action Buttons */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <Button
                          fullWidth
                          variant="contained"
                          size="large"
                          disabled={isDownloading}
                          startIcon={isDownloading ? <CircularProgress size={20} sx={{ color: '#0F172A' }} /> : <DownloadIcon />}
                          onClick={() => handleDownloadPdf(template)}
                          sx={{
                            bgcolor: '#EAB308',
                            color: '#0F172A',
                            fontWeight: 800,
                            textTransform: 'none',
                            py: 1.2,
                            borderRadius: 2,
                            fontSize: '0.95rem',
                            boxShadow: '0 4px 14px rgba(234, 179, 8, 0.35)',
                            '&:hover': {
                              bgcolor: '#CA8A04',
                              boxShadow: '0 6px 18px rgba(234, 179, 8, 0.45)'
                            }
                          }}
                        >
                          {isDownloading ? 'Generating PDF via QuestPDF...' : 'Download Certificate PDF'}
                        </Button>

                        <Box sx={{ display: 'flex', gap: 1.5 }}>
                          <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<TuneIcon />}
                            onClick={() => {
                              setCustomModalTemplate(template);
                              setCustomForm({
                                participantName: 'Vasanth Kumar',
                                webinarName: 'AI & Neural Networks Masterclass',
                                date: new Date().toISOString().split('T')[0],
                                certificateId: 'PDX-WB-' + new Date().getFullYear() + '-0001'
                              });
                            }}
                            sx={{
                              borderColor: colors.border,
                              color: colors.textPrimary,
                              fontWeight: 700,
                              textTransform: 'none',
                              py: 1,
                              borderRadius: 2,
                              '&:hover': { borderColor: colors.primary, bgcolor: colors.surfaceAlt }
                            }}
                          >
                            Customize & Download
                          </Button>

                          <Button
                            variant="outlined"
                            startIcon={<VisibilityIcon />}
                            onClick={() => setPreviewTemplate(template)}
                            sx={{
                              borderColor: colors.border,
                              color: colors.textSecondary,
                              fontWeight: 700,
                              textTransform: 'none',
                              py: 1,
                              px: 2.5,
                              borderRadius: 2,
                              whiteSpace: 'nowrap',
                              '&:hover': { borderColor: colors.primary, color: colors.primary }
                            }}
                          >
                            Preview
                          </Button>
                        </Box>
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* ── Fullscreen Lightbox Preview Dialog ──────────────────────────────── */}
      {previewTemplate && (
        <Dialog
          open={Boolean(previewTemplate)}
          onClose={() => setPreviewTemplate(null)}
          maxWidth="lg"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              bgcolor: '#0F172A',
              color: '#FFFFFF',
              overflow: 'hidden'
            }
          }}
        >
          <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
              <WorkspacePremiumIcon sx={{ color: '#EAB308' }} />
              <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.05rem' }}>
                {previewTemplate.name} — Fullscreen View
              </Typography>
            </Box>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setPreviewTemplate(null)}
              sx={{ color: '#FFFFFF', borderColor: 'rgba(255,255,255,0.3)', textTransform: 'none', borderRadius: 1.5 }}
            >
              Close
            </Button>
          </Box>

          <DialogContent sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', bgcolor: '#020617' }}>
            <Box
              component="img"
              src={previewTemplate.previewBase64 || previewTemplate.previewUrl}
              alt={previewTemplate.name}
              sx={{
                width: '100%',
                maxHeight: '72vh',
                objectFit: 'contain',
                borderRadius: 2,
                boxShadow: '0 20px 50px rgba(0,0,0,0.85)'
              }}
            />
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid rgba(255,255,255,0.1)', justifyContent: 'space-between' }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              A4 Landscape Vector Standard • Powered by QuestPDF
            </Typography>

            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={() => {
                handleDownloadPdf(previewTemplate);
                setPreviewTemplate(null);
              }}
              sx={{
                bgcolor: '#EAB308',
                color: '#0F172A',
                fontWeight: 800,
                textTransform: 'none',
                px: 3.5,
                borderRadius: 2,
                '&:hover': { bgcolor: '#CA8A04' }
              }}
            >
              Download PDF (QuestPDF)
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* ── Customize & Download Dialog ─────────────────────────────────────── */}
      {customModalTemplate && (
        <Dialog
          open={Boolean(customModalTemplate)}
          onClose={() => setCustomModalTemplate(null)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              bgcolor: colors.surface,
              p: 1
            }
          }}
        >
          <DialogContent sx={{ pt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1 }}>
              <TuneIcon sx={{ color: '#EAB308', fontSize: 26 }} />
              <Typography variant="h6" sx={{ fontWeight: 800, color: colors.textPrimary }}>
                Customize Certificate PDF
              </Typography>
            </Box>

            <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2.5 }}>
              Generate a personalized sample PDF for <strong>{customModalTemplate.name}</strong> rendered directly using QuestPDF.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Participant Name"
                fullWidth
                size="small"
                value={customForm.participantName}
                onChange={(e) => setCustomForm(prev => ({ ...prev, participantName: e.target.value }))}
                placeholder="e.g. Vasanth Kumar"
              />

              <TextField
                label="Webinar Title"
                fullWidth
                size="small"
                value={customForm.webinarName}
                onChange={(e) => setCustomForm(prev => ({ ...prev, webinarName: e.target.value }))}
                placeholder="e.g. AI & Neural Networks Masterclass"
              />

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <TextField
                  label="Completion Date"
                  type="date"
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={customForm.date}
                  onChange={(e) => setCustomForm(prev => ({ ...prev, date: e.target.value }))}
                />

                <TextField
                  label="Certificate ID"
                  fullWidth
                  size="small"
                  value={customForm.certificateId}
                  onChange={(e) => setCustomForm(prev => ({ ...prev, certificateId: e.target.value }))}
                  placeholder="e.g. PDX-WB-2026-0001"
                />
              </Box>
            </Box>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button
              variant="outlined"
              onClick={() => setCustomModalTemplate(null)}
              sx={{ textTransform: 'none', fontWeight: 600, borderColor: colors.border, color: colors.textSecondary }}
            >
              Cancel
            </Button>

            <Button
              variant="contained"
              disabled={generatingCustom}
              onClick={handleGenerateCustomPdf}
              startIcon={generatingCustom ? <CircularProgress size={16} sx={{ color: '#0F172A' }} /> : <DownloadIcon />}
              sx={{
                bgcolor: '#EAB308',
                color: '#0F172A',
                fontWeight: 800,
                textTransform: 'none',
                px: 3,
                boxShadow: 'none',
                '&:hover': { bgcolor: '#CA8A04', boxShadow: 'none' }
              }}
            >
              {generatingCustom ? 'Generating PDF...' : 'Download Customized PDF'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
