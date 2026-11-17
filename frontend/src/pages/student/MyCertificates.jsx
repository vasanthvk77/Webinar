// // import React, { useState, useEffect, useCallback, useMemo } from 'react';
// // import { useNavigate } from 'react-router-dom';
// // import {
// //   Box,
// //   Typography,
// //   Button,
// //   Paper,
// //   Chip,
// //   IconButton,
// //   Tooltip,
// //   CircularProgress,
// //   Dialog,
// //   DialogContent,
// //   DialogActions,
// //   DialogTitle
// // } from '@mui/material';
// // import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
// // import DownloadIcon from '@mui/icons-material/Download';
// // import VisibilityIcon from '@mui/icons-material/Visibility';
// // import CheckCircleIcon from '@mui/icons-material/CheckCircle';
// // import ContentCopyIcon from '@mui/icons-material/ContentCopy';
// // import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
// // import CloseIcon from '@mui/icons-material/Close';
// // import SchoolIcon from '@mui/icons-material/School';
// // import AccessTimeIcon from '@mui/icons-material/AccessTime';
// // import toast from 'react-hot-toast';

// // import { webinarService, certificateService } from '../../services/api';
// // import { useAuth } from '../../context/AuthContext';
// // import { useThemeColors } from '../../context/ThemeContext';
// // import CustomSearchBar from '../../components/CustomSearchBar';

// // // Helper: Format Date
// // const formatDate = (dateStr) => {
// //   if (!dateStr) return '—';
// //   try {
// //     const d = new Date(dateStr);
// //     return d.toLocaleDateString('en-US', {
// //       weekday: 'short',
// //       month: 'short',
// //       day: 'numeric',
// //       year: 'numeric'
// //     });
// //   } catch {
// //     return dateStr;
// //   }
// // };

// // export default function MyCertificates() {
// //   const colors = useThemeColors();
// //   const { user } = useAuth();
// //   const navigate = useNavigate();

// //   const [certificates, setCertificates] = useState([]);
// //   const [loading, setLoading] = useState(true);
// //   const [search, setSearch] = useState('');
// //   const [downloadingId, setDownloadingId] = useState(null);

// //   // View / Preview Dialog state
// //   const [viewDialogWebinar, setViewDialogWebinar] = useState(null);
// //   const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
// //   const [previewLoading, setPreviewLoading] = useState(false);

// //   const [templateBannerSrc, setTemplateBannerSrc] = useState(null);

// //   const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5270';
// //   const templateImgUrl = `${apiBase}/api/certificates/templates/CertificateTemplate1/preview`;

// //   // Fetch certificate template preview (authenticated with JWT)
// //   useEffect(() => {
// //     certificateService.getTemplates()
// //       .then((res) => {
// //         if (res.data?.success && res.data.data?.length > 0) {
// //           const t = res.data.data[0];
// //           setTemplateBannerSrc(t.previewBase64 || t.previewUrl);
// //         }
// //       })
// //       .catch((err) => {
// //         console.error('Could not load template preview:', err);
// //       });
// //   }, []);

// //   // Load completed webinars and filter for certificate-eligible
// //   const loadCertificates = useCallback(async () => {
// //     setLoading(true);
// //     try {
// //       const res = await webinarService.getCompleted();
// //       if (res.data?.success) {
// //         const allCompleted = res.data.data || [];
// //         const eligibleOnly = allCompleted.filter(
// //           (w) => w.canDownloadCertificate || w.isCertificateEligible
// //         );
// //         setCertificates(eligibleOnly);
// //       }
// //     } catch (err) {
// //       console.error('Error fetching certificates:', err);
// //       toast.error('Failed to load certificates');
// //     } finally {
// //       setLoading(false);
// //     }
// //   }, []);

// //   useEffect(() => {
// //     loadCertificates();
// //   }, [loadCertificates]);

// //   // Clean up blob URL on unmount or dialog close
// //   useEffect(() => {
// //     return () => {
// //       if (previewBlobUrl) {
// //         window.URL.revokeObjectURL(previewBlobUrl);
// //       }
// //     };
// //   }, [previewBlobUrl]);

// //   // Filtered certificates list
// //   const filteredCertificates = useMemo(() => {
// //     if (!search.trim()) return certificates;
// //     const q = search.toLowerCase();
// //     return certificates.filter((item) => {
// //       const matchesTitle = item.webinarName?.toLowerCase().includes(q);
// //       const matchesCode = (item.certificateCode || item.certificateId)?.toLowerCase().includes(q);
// //       const matchesInstructor = item.conductorName?.toLowerCase().includes(q);
// //       const matchesCat = item.categoryName?.toLowerCase().includes(q);
// //       return matchesTitle || matchesCode || matchesInstructor || matchesCat;
// //     });
// //   }, [certificates, search]);

// //   // Statistics summary
// //   const stats = useMemo(() => {
// //     const total = certificates.length;
// //     const totalSeconds = certificates.reduce((acc, c) => acc + (c.attendedDuration || 0), 0);
// //     const hours = (totalSeconds / 3600).toFixed(1);
// //     return { total, hours };
// //   }, [certificates]);

// //   // Trigger PDF file download
// //   const handleDownload = async (webinar, e) => {
// //     e?.stopPropagation();
// //     setDownloadingId(webinar.webinarId);
// //     try {
// //       const res = await webinarService.downloadStudentCertificate(webinar.webinarId);
// //       const blob = new Blob([res.data], { type: 'application/pdf' });
// //       const url = window.URL.createObjectURL(blob);
// //       const link = document.createElement('a');
// //       link.href = url;
// //       const safeName = (webinar.webinarName || 'Webinar').replace(/[^a-zA-Z0-9]/g, '_');
// //       link.setAttribute('download', `${safeName}-Certificate.pdf`);
// //       document.body.appendChild(link);
// //       link.click();
// //       link.parentNode.removeChild(link);
// //       window.URL.revokeObjectURL(url);
// //       toast.success('Certificate downloaded successfully! 🎓');
// //     } catch (err) {
// //       console.error('Error downloading certificate:', err);
// //       toast.error('Failed to download certificate. Please try again.');
// //     } finally {
// //       setDownloadingId(null);
// //     }
// //   };

// //   // Open Full Certificate View Modal
// //   const handleOpenView = async (webinar) => {
// //     setViewDialogWebinar(webinar);
// //     setPreviewLoading(true);
// //     try {
// //       if (previewBlobUrl) {
// //         window.URL.revokeObjectURL(previewBlobUrl);
// //       }
// //       const res = await (webinarService.previewStudentCertificate
// //         ? webinarService.previewStudentCertificate(webinar.webinarId)
// //         : webinarService.downloadStudentCertificate(webinar.webinarId));
// //       const blob = new Blob([res.data], { type: 'application/pdf' });
// //       const url = window.URL.createObjectURL(blob);
// //       setPreviewBlobUrl(url);
// //     } catch (err) {
// //       console.error('Error loading certificate preview:', err);
// //       toast.error('Could not load certificate preview');
// //     } finally {
// //       setPreviewLoading(false);
// //     }
// //   };

// //   const handleCloseView = () => {
// //     setViewDialogWebinar(null);
// //     if (previewBlobUrl) {
// //       window.URL.revokeObjectURL(previewBlobUrl);
// //       setPreviewBlobUrl(null);
// //     }
// //   };



// //   return (
// //     <Box
// //       sx={{
// //         minHeight: 'calc(100vh - 110px)',
// //         display: 'flex',
// //         flexDirection: 'column',
// //         maxWidth: 1600,
// //         bgcolor: 'transparent',
// //         mx: 'auto',
// //         width: '100%'
// //       }}
// //     >
// //       {/* ── Top Hero Banner (Rich Dark Navy & Gold Palette) ────────────────── */}
// //       <Box
// //         sx={{
// //           mb: 2.5,
// //           px: { xs: 2.5, sm: 3.5 },
// //           py: { xs: 2.5, sm: 3 },
// //           borderRadius: '20px',
// //           background: 'radial-gradient(circle at 90% 15%, rgba(242,183,5,0.22) 0%, transparent 42%), radial-gradient(circle at 15% 90%, rgba(56,189,248,0.12) 0%, transparent 35%), linear-gradient(125deg, #172338 0%, #202D43 60%, #26364D 100%)',
// //           color: '#FFFFFF',
// //           border: '1px solid rgba(255,255,255,0.1)',
// //           boxShadow: '0 16px 36px rgba(23, 35, 56, 0.16)',
// //           position: 'relative',
// //           overflow: 'hidden',
// //           '&:before': {
// //             content: '""',
// //             position: 'absolute',
// //             left: 0,
// //             top: 0,
// //             bottom: 0,
// //             width: 6,
// //             background: 'linear-gradient(180deg, #FDE047 0%, #F2B705 50%, #D97706 100%)',
// //           },
// //           display: 'flex',
// //           alignItems: 'center',
// //           justifyContent: 'space-between',
// //           flexWrap: 'wrap',
// //           gap: 2.5,
// //           flexShrink: 0,
// //         }}
// //       >
// //         <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.25 }}>
// //           <Box
// //             sx={{
// //               width: 56,
// //               height: 56,
// //               borderRadius: '16px',
// //               background: 'linear-gradient(135deg, #FDE047 0%, #F2B705 100%)',
// //               display: 'flex',
// //               alignItems: 'center',
// //               justifyContent: 'center',
// //               boxShadow: '0 8px 22px rgba(242,183,5,0.35)',
// //               flexShrink: 0,
// //             }}
// //           >
// //             <WorkspacePremiumIcon sx={{ color: '#172338', fontSize: 32 }} />
// //           </Box>
// //           <Box>
// //             <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap', mb: 0.5 }}>
// //               <Typography
// //                 variant="h5"
// //                 sx={{
// //                   fontWeight: 700,
// //                   color: '#FFFFFF',
// //                   letterSpacing: '-0.5px',
// //                   lineHeight: 1.2,
// //                   fontSize: { xs: '1.35rem', sm: '1.6rem' }
// //                 }}
// //               >
// //                 My Certificates
// //               </Typography>
             
// //             </Box>
// //             <Typography
// //               variant="body2"
// //               sx={{
// //                 color: 'rgba(255,255,255,0.78)',
// //                 fontWeight: 400,
// //                 fontSize: { xs: '0.85rem', sm: '0.92rem' },
// //                 maxWidth: 560,
// //               }}
// //             >
// //               View, verify, and download your accredited webinar completion certificates.
// //             </Typography>
// //           </Box>
// //         </Box>

// //         {/* Quick Stats Cards inside Banner */}
// //         <Box
// //           sx={{
// //             display: 'grid',
// //             gridTemplateColumns: 'repeat(2, minmax(130px, 1fr))',
// //             gap: 1.5,
// //             width: { xs: '100%', sm: 'auto' },
// //           }}
// //         >
// //           <Paper
// //             elevation={0}
// //             sx={{
// //               px: 2.5,
// //               py: 1.25,
// //               borderRadius: '14px',
// //               bgcolor: 'rgba(34, 197, 94, 0.16)',
// //               backdropFilter: 'blur(12px)',
// //               border: '1px solid rgba(74, 222, 128, 0.35)',
// //               display: 'flex',
// //               flexDirection: 'column',
// //               justifyContent: 'center',
// //               alignItems: { xs: 'center', sm: 'flex-start' },
// //             }}
// //           >
// //             <Typography
// //               variant="caption"
// //               sx={{
// //                 fontWeight: 700,
// //                 color: '#8BE0A7',
// //                 textTransform: 'uppercase',
// //                 letterSpacing: '0.6px',
// //                 fontSize: '0.68rem',
// //                 mb: 0.25
// //               }}
// //             >
// //               Earned Certificates
// //             </Typography>
// //             <Typography variant="h6" sx={{ fontWeight: 700, color: '#8BE0A7', lineHeight: 1.1 }}>
// //               {stats.total}
// //             </Typography>
// //           </Paper>

// //           <Paper
// //             elevation={0}
// //             sx={{
// //               px: 2.5,
// //               py: 1.25,
// //               borderRadius: '14px',
// //               background: 'linear-gradient(135deg, rgba(242,183,5,0.22) 0%, rgba(242,183,5,0.08) 100%)',
// //               backdropFilter: 'blur(12px)',
// //               border: '1px solid rgba(242,183,5,0.35)',
// //               display: 'flex',
// //               flexDirection: 'column',
// //               justifyContent: 'center',
// //               alignItems: { xs: 'center', sm: 'flex-start' },
// //             }}
// //           >
// //             <Typography
// //               variant="caption"
// //               sx={{
// //                 fontWeight: 700,
// //                 color: '#FFD45A',
// //                 textTransform: 'uppercase',
// //                 letterSpacing: '0.6px',
// //                 fontSize: '0.68rem',
// //                 mb: 0.25
// //               }}
// //             >
// //               Certified Hours
// //             </Typography>
// //             <Typography variant="h6" sx={{ fontWeight: 700, color: '#FFFFFF', lineHeight: 1.1 }}>
// //               {stats.hours}h
// //             </Typography>
// //           </Paper>
// //         </Box>
// //       </Box>

// //       {/* ── Search Toolbar ─────────────────────────────────────────────────── */}
// //       <Paper
// //         elevation={0}
// //         sx={{
// //           p: { xs: 1.5, sm: 1.75 },
// //           mb: 2.5,
// //           borderRadius: '16px',
// //           bgcolor: colors.surface,
// //           border: `1px solid ${colors.border}`,
// //           boxShadow: '0 4px 20px rgba(15, 23, 42, 0.04)',
// //           display: 'flex',
// //           alignItems: 'center',
// //           justifyContent: 'space-between',
// //           flexWrap: 'wrap',
// //           gap: 2,
// //           flexShrink: 0,
// //         }}
// //       >
// //         <Box sx={{ flexGrow: 1, minWidth: { xs: '100%', sm: 300 }, maxWidth: { xs: '100%', sm: 460 } }}>
// //           <CustomSearchBar
// //             value={search}
// //             onChange={(val) => setSearch(val)}
// //             placeholder="Search certificates by webinar, code, instructor..."
// //             maxWidth="100%"
// //             sx={{ width: '100%' }}
// //           />
// //         </Box>

// //         <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
// //           <Chip
// //             icon={<WorkspacePremiumIcon sx={{ fontSize: '15px !important', color: '#166534' }} />}
// //             label={`Showing ${filteredCertificates.length} of ${certificates.length} Certificates`}
// //             size="small"
// //             sx={{
// //               fontWeight: 700,
// //               fontSize: '0.78rem',
// //               height: 32,
// //               px: 1,
// //               bgcolor: '#F0FDF4',
// //               color: '#166534',
// //               border: '1px solid #BBF7D0'
// //             }}
// //           />
// //         </Box>
// //       </Paper>

// //       {/* ── Certificate Cards Grid (Increased Width, Reduced Height like Eduprep) ── */}
// //       <Box sx={{ flexGrow: 1, pb: 3 }}>
// //         {loading ? (
// //           <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 10, gap: 2 }}>
// //             <CircularProgress size={42} thickness={4.5} sx={{ color: '#F2B705' }} />
// //             <Typography variant="body2" sx={{ color: colors.textSecondary, fontWeight: 600 }}>
// //               Loading your certificates...
// //             </Typography>
// //           </Box>
// //         ) : filteredCertificates.length === 0 ? (
// //           <Paper
// //             elevation={0}
// //             sx={{
// //               py: 8,
// //               px: 3,
// //               textAlign: 'center',
// //               borderRadius: '20px',
// //               bgcolor: colors.surface,
// //               border: `1px dashed ${colors.border}`,
// //               maxWidth: 580,
// //               mx: 'auto',
// //               mt: 2
// //             }}
// //           >
// //             <Box
// //               sx={{
// //                 width: 76,
// //                 height: 76,
// //                 borderRadius: '50%',
// //                 bgcolor: 'rgba(242,183,5,0.12)',
// //                 display: 'flex',
// //                 alignItems: 'center',
// //                 justifyContent: 'center',
// //                 mx: 'auto',
// //                 mb: 2,
// //               }}
// //             >
// //               <WorkspacePremiumIcon sx={{ fontSize: 40, color: '#D97706' }} />
// //             </Box>
// //             <Typography variant="h6" sx={{ fontWeight: 700, color: colors.textPrimary, mb: 0.75 }}>
// //               {certificates.length === 0 ? 'No certificates earned yet' : 'No certificates match your search'}
// //             </Typography>
// //             <Typography variant="body2" sx={{ color: colors.textSecondary, maxWidth: 440, mx: 'auto', mb: 3, lineHeight: 1.6 }}>
// //               {certificates.length === 0
// //                 ? 'Attend live webinar sessions, complete the attendance criteria, and unlock your official certificates here!'
// //                 : 'Try clearing your search keyword to view all your earned certificates.'}
// //             </Typography>

// //             {certificates.length === 0 ? (
// //               <Button
// //                 variant="contained"
// //                 endIcon={<ArrowForwardIcon />}
// //                 onClick={() => navigate('/dashboard/webinars?tab=available')}
// //                 sx={{
// //                   bgcolor: '#F2B705',
// //                   color: '#172338',
// //                   fontWeight: 800,
// //                   textTransform: 'none',
// //                   px: 3.5,
// //                   py: 1.1,
// //                   borderRadius: '12px',
// //                   boxShadow: '0 6px 16px rgba(242,183,5,0.3)',
// //                   '&:hover': { bgcolor: '#DDA600', boxShadow: '0 8px 22px rgba(242,183,5,0.4)' }
// //                 }}
// //               >
// //                 Browse Upcoming Webinars
// //               </Button>
// //             ) : (
// //               <Button
// //                 variant="outlined"
// //                 onClick={() => setSearch('')}
// //                 sx={{
// //                   color: '#172338',
// //                   borderColor: '#F2B705',
// //                   bgcolor: '#F2B705',
// //                   fontWeight: 700,
// //                   textTransform: 'none',
// //                   borderRadius: '10px',
// //                   px: 3,
// //                   '&:hover': { bgcolor: '#DDA600', borderColor: '#DDA600' }
// //                 }}
// //               >
// //                 Reset Search
// //               </Button>
// //             )}
// //           </Paper>
// //         ) : (
// //           /* Grid container with wider card columns (380px to 440px wide, not skinny) */
// //           <Box
// //             sx={{
// //               display: 'grid',
// //               gridTemplateColumns: {
// //                 xs: '1fr',
// //                 sm: 'repeat(auto-fill, minmax(360px, 420px))',
// //               },
// //               gap: 3,
// //               justifyContent: 'start',
// //             }}
// //           >
// //             {filteredCertificates.map((w) => {
// //               const certCode = w.certificateCode || w.certificateId;
// //               const isDownloading = downloadingId === w.webinarId;
// //               const cardBannerSrc = w.templateImageUrl
// //                 ? (w.templateImageUrl.startsWith('http') ? w.templateImageUrl : `${apiBase}${w.templateImageUrl}`)
// //                 : (templateBannerSrc || templateImgUrl);

// //               return (
// //                 <Paper
// //                   key={w.webinarId}
// //                   elevation={0}
// //                   sx={{
// //                     width: '100%',
// //                     maxWidth: 440,
// //                     display: 'flex',
// //                     flexDirection: 'column',
// //                     borderRadius: '20px',
// //                     bgcolor: '#FFFFFF',
// //                     border: '1.5px solid rgba(22, 163, 74, 0.28)',
// //                     boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
// //                     transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
// //                     overflow: 'hidden',
// //                     position: 'relative',
// //                     '&:hover': {
// //                       transform: 'translateY(-4px)',
// //                       boxShadow: '0 16px 32px rgba(15, 23, 42, 0.12)',
// //                       borderColor: '#16A34A',
// //                       '& .cert-banner-img': {
// //                         transform: 'scale(1.04)',
// //                       }
// //                     }
// //                   }}
// //                 >
// //                   {/* ── TOP HALF: Certificate Top Half Visual Banner (Compact Height ~150px) ── */}
// //                   <Box
// //                     onClick={() => handleOpenView(w)}
// //                     sx={{
// //                       position: 'relative',
// //                       height: 155,
// //                       overflow: 'hidden',
// //                       cursor: 'pointer',
// //                       background: 'radial-gradient(circle at 80% 30%, #F59E0B 0%, #B45309 60%, #78350F 100%)',
// //                       borderBottom: '1px solid #E2E8F0',
// //                     }}
// //                   >
// //                     {/* Real template top-half image from wms.CertificateTemplates */}
// //                     <Box
// //                       component="img"
// //                       className="cert-banner-img"
// //                       src={cardBannerSrc}
// //                       alt={`${w.webinarName} Certificate`}
// //                       onError={(e) => {
// //                         // Fallback: hide broken img, gradient remains
// //                         e.target.style.display = 'none';
// //                       }}
// //                       sx={{
// //                         width: '100%',
// //                         height: '100%',
// //                         objectFit: 'cover',
// //                         objectPosition: 'top center',
// //                         transition: 'transform 0.4s ease',
// //                       }}
// //                     />

// //                     {/* Subtle dark gradient overlay to give trophy/cert banner depth */}
// //                     <Box
// //                       sx={{
// //                         position: 'absolute',
// //                         top: 0,
// //                         left: 0,
// //                         right: 0,
// //                         bottom: 0,
// //                         background: 'linear-gradient(180deg, rgba(15,23,42,0.1) 0%, rgba(15,23,42,0.45) 100%)',
// //                         pointerEvents: 'none',
// //                       }}
// //                     />

// //                     {/* Top Left: Category Tag from database table */}
// //                     {w.categoryName && (
// //                       <Box sx={{ position: 'absolute', top: 12, left: 12, zIndex: 2 }}>
// //                         <Chip
// //                           label={w.categoryName}
// //                           size="small"
// //                           sx={{
// //                             fontWeight: 750,
// //                             fontSize: '0.72rem',
// //                             height: 24,
// //                             bgcolor: 'rgba(255, 255, 255, 0.95)',
// //                             color: '#0F172A',
// //                             boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
// //                           }}
// //                         />
// //                       </Box>
// //                     )}

// //                     {/* Top Right: "Completed" Pill Badge (Matches Eduprep Style) */}
// //                     <Box sx={{ position: 'absolute', top: 12, right: 12, zIndex: 2 }}>
// //                       <Box
// //                         sx={{
// //                           display: 'flex',
// //                           alignItems: 'center',
// //                           gap: 0.6,
// //                           bgcolor: 'rgba(23, 35, 56, 0.72)',
// //                           backdropFilter: 'blur(8px)',
// //                           border: '1px solid rgba(255, 255, 255, 0.22)',
// //                           color: '#FFFFFF',
// //                           px: 1.25,
// //                           py: 0.4,
// //                           borderRadius: '20px',
// //                           boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
// //                         }}
// //                       >
// //                         <AccessTimeIcon sx={{ fontSize: 13, color: '#FDE047' }} />
// //                         <Typography variant="caption" sx={{ fontWeight: 800,color: '#FDE047' , fontSize: '0.70rem', letterSpacing: '0.3px' }}>
// //                           Completed
// //                         </Typography>
// //                       </Box>
// //                     </Box>

// //                     {/* Bottom overlay: Student Certificate Recipient strip */}
// //                     <Box
// //                       sx={{
// //                         position: 'absolute',
// //                         bottom: 10,
// //                         left: 12,
// //                         right: 12,
// //                         zIndex: 2,
// //                         display: 'flex',
// //                         alignItems: 'center',
// //                         justifyContent: 'space-between',
// //                         bgcolor: 'rgba(15, 23, 42, 0.8)',
// //                         backdropFilter: 'blur(10px)',
// //                         border: '1px solid rgba(255, 255, 255, 0.15)',
// //                         borderRadius: '8px',
// //                         px: 1.4,
// //                         py: 0.5,
// //                       }}
// //                     >
// //                       <Box sx={{ minWidth: 0, flex: 1 }}>
                        
// //                         <Typography variant="body2" noWrap sx={{ color: '#FFFFFF', fontWeight: 700, fontSize: '0.80rem' }}>
// //                           {w.participantName || user?.firstName || 'Student'}
// //                         </Typography>
// //                       </Box>
// //                       <VisibilityIcon sx={{ color: '#FDE047', fontSize: 17 }} />
// //                     </Box>
// //                   </Box>

// //                   {/* ── BOTTOM HALF: Content & Details (Matches Eduprep layout) ── */}
// //                   <Box sx={{ p: 2.2, display: 'flex', flexDirection: 'column', flex: 1 }}>
// //                     {/* Title in bold purple/indigo (Eduprep signature color) */}
// //                     <Typography
// //                       variant="h6"
// //                       title={w.webinarName}
// //                       sx={{
// //                         fontWeight: 800,
// //                         color: '#f2b705',
// //                         fontSize: '1.12rem',
// //                         lineHeight: 1.3,
// //                         mb: 0.5,
// //                         display: '-webkit-box',
// //                         WebkitLineClamp: 1,
// //                         WebkitBoxOrient: 'vertical',
// //                         overflow: 'hidden',
// //                       }}
// //                     >
// //                       {w.webinarName}
// //                     </Typography>

// //                     {/* Sub-line: Issued Date */}
// //                     <Typography
// //                       variant="body2"
// //                       sx={{
// //                         fontWeight: 700,
// //                         color: '#1F2937',
// //                         fontSize: '0.82rem',
// //                         mb: 0.4
// //                       }}
// //                     >
// //                       Completed At: {formatDate(w.webinarDate)}
// //                     </Typography>

// //                     {/* Short Description */}
// //                     <Typography
// //                       variant="caption"
// //                       sx={{
// //                         color: '#6B7280',
// //                         fontSize: '0.78rem',
// //                         display: 'block',
// //                         mb: 1.8,
// //                         lineHeight: 1.4
// //                       }}
// //                     >
// //                       Certified training session led by {w.conductorName} • {w.durationMinutes} min
// //                     </Typography>

// //                     {/* Compact Info Box (Matches the Prize Money box in Eduprep) */}
// //                     <Box
// //                       sx={{
// //                         bgcolor: '#F9FAFB',
// //                         borderRadius: '12px',
// //                         border: '1px solid #E5E7EB',
// //                         p: 1.25,
// //                         mb: 2,
// //                         display: 'flex',
// //                         flexDirection: 'column',
// //                         gap: 0.8
// //                       }}
// //                     >
// //                       {/* Row 1: Certificate ID / Code */}
// //                       <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
// //                         <Typography variant="caption" sx={{ fontWeight: 600, color: '#4B5563', fontSize: '0.75rem' }}>
// //                           Certificate ID:
// //                         </Typography>
// //                         <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
// //                           <Chip
// //                             label={certCode || 'VERIFIED'}
// //                             size="small"
// //                             sx={{
// //                               bgcolor: '#D1FAE5',
// //                               color: '#065F46',
// //                               fontWeight: 800,
// //                               fontSize: '0.74rem',
// //                               height: 22,
// //                               borderRadius: '6px',
// //                               fontFamily: 'monospace'
// //                             }}
// //                           />
                       
// //                         </Box>
// //                       </Box>

// //                       {/* Row 2: Instructor */}
// //                       <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
// //                         <Typography variant="caption" sx={{ fontWeight: 600, color: '#4B5563', fontSize: '0.75rem' }}>
// //                           Instructor:
// //                         </Typography>
// //                         <Chip
// //                           icon={<SchoolIcon sx={{ fontSize: '13px !important', color: '#6D28D9' }} />}
// //                           label={w.conductorName || 'Lead Speaker'}
// //                           size="small"
// //                           sx={{
// //                             bgcolor: '#EDE9FE',
// //                             color: '#5B21B6',
// //                             fontWeight: 750,
// //                             fontSize: '0.73rem',
// //                             height: 22,
// //                             borderRadius: '6px'
// //                           }}
// //                         />
// //                       </Box>
// //                     </Box>

// //                     {/* Footer Row: Details (Eye) on Left & Download Button on Right */}
// //                     <Box
// //                       sx={{
// //                         display: 'flex',
// //                         alignItems: 'center',
// //                         justifyContent: 'space-between',
// //                         pt: 1.2,
// //                         borderTop: '1px solid #F3F4F6',
// //                         mt: 'auto'
// //                       }}
// //                     >
// //                       {/* Left: View Details Button */}
// //                       <Button
// //                         variant="text"
// //                         size="small"
// //                         startIcon={<VisibilityIcon sx={{ fontSize: 17 }} />}
// //                         onClick={() => handleOpenView(w)}
// //                         sx={{
// //                           color: '#4B5563',
// //                           fontWeight: 700,
// //                           fontSize: '0.84rem',
// //                           textTransform: 'none',
// //                           p: 0.5,
// //                           '&:hover': { color: '#111827', bgcolor: 'transparent' }
// //                         }}
// //                       >
// //                         View
// //                       </Button>

// //                       {/* Right: Download PDF Button */}
// //                       <Button
// //                         variant="contained"
// //                         size="small"
// //                         disabled={isDownloading}
// //                         startIcon={
// //                           isDownloading ? (
// //                             <CircularProgress size={14} sx={{ color: '#172338' }} />
// //                           ) : (
// //                             <DownloadIcon sx={{ fontSize: 16 }} />
// //                           )
// //                         }
// //                         onClick={(e) => handleDownload(w, e)}
// //                         sx={{
// //                           bgcolor: '#F2B705',
// //                           color: '#172338',
// //                           fontWeight: 700,
// //                           fontSize: '0.80rem',
// //                           textTransform: 'none',
// //                           px: 2.2,
// //                           py: 0.6,
// //                           borderRadius: '8px',
// //                           boxShadow: 'none',
// //                           '&:hover': {
// //                             bgcolor: '#EAB308',
// //                             boxShadow: 'none'
// //                           }
// //                         }}
// //                       >
// //                         {isDownloading ? 'Downloading...' : 'Download'}
// //                       </Button>
// //                     </Box>
// //                   </Box>
// //                 </Paper>
// //               );
// //             })}
// //           </Box>
// //         )}
// //       </Box>

// //       {/* ── Interactive View / Preview Modal ──────────────────────────────── */}
// //       <Dialog
// //         open={Boolean(viewDialogWebinar)}
// //         onClose={handleCloseView}
// //         maxWidth="md"
// //         fullWidth
// //         PaperProps={{
// //           sx: {
// //             borderRadius: '20px',
// //             bgcolor: colors.surface,
// //             overflow: 'hidden',
// //           }
// //         }}
// //       >
// //         <DialogTitle
// //           sx={{
// //             display: 'flex',
// //             alignItems: 'center',
// //             justifyContent: 'space-between',
// //             bgcolor: '#172338',
// //             color: '#FFFFFF',
// //             py: 2,
// //             px: 3,
// //           }}
// //         >
// //           <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
// //             <WorkspacePremiumIcon sx={{ color: '#F2B705', fontSize: 26 }} />
// //             <Box>
// //               <Typography variant="subtitle1" sx={{ color: '#F2B705',fontWeight: 800, lineHeight: 1.2 }}>
// //                 Certificate of Completion
// //               </Typography>
// //               <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>
// //                 {viewDialogWebinar?.webinarName}
// //               </Typography>
// //             </Box>
// //           </Box>
// //           <IconButton onClick={handleCloseView} sx={{ color: '#FFFFFF' }}>
// //             <CloseIcon />
// //           </IconButton>
// //         </DialogTitle>

// //         <DialogContent sx={{ p: 2.5, bgcolor: '#0F172A', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
// //           {previewLoading ? (
// //             <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 14, gap: 2 }}>
// //               <CircularProgress size={44} sx={{ color: '#F2B705' }} />
// //               <Typography variant="body2" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
// //                 Rendering official vector PDF certificate...
// //               </Typography>
// //             </Box>
// //           ) : previewBlobUrl ? (
// //             <Box
// //               sx={{
// //                 width: '100%',
// //                 height: { xs: 360, sm: 520, md: 580 },
// //                 borderRadius: '12px',
// //                 overflow: 'hidden',
// //                 boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
// //                 bgcolor: '#FFFFFF',
// //               }}
// //             >
// //               <iframe
// //                 src={`${previewBlobUrl}#toolbar=0&navpanes=0`}
// //                 title="Certificate PDF Viewer"
// //                 width="100%"
// //                 height="100%"
// //                 style={{ border: 'none' }}
// //               />
// //             </Box>
// //           ) : (
// //             <Typography variant="body2" sx={{ color: '#FFFFFF', py: 8 }}>
// //               Failed to display certificate preview.
// //             </Typography>
// //           )}
// //         </DialogContent>

// //         <DialogActions
// //           sx={{
// //             py: 2,
// //             px: 3,
// //             bgcolor: colors.surface,
// //             borderTop: `1px solid ${colors.border}`,
// //             display: 'flex',
// //             alignItems: 'center',
// //             justifyContent: 'space-between',
// //           }}
// //         >


// //           <Box sx={{ display: 'flex', gap: 1.5 }}>
// //             <Button
// //               variant="outlined"
// //               onClick={handleCloseView}
// //               sx={{
// //                 borderRadius: '10px',
// //                 color: colors.textSecondary,
// //                 borderColor: colors.border,
// //                 textTransform: 'none',
// //                 fontWeight: 600,
// //               }}
// //             >
// //               Close
// //             </Button>
// //             <Button
// //               variant="contained"
// //               startIcon={<DownloadIcon />}
// //               onClick={() => handleDownload(viewDialogWebinar)}
// //               sx={{
// //                 borderRadius: '10px',
// //                 bgcolor: '#F2B705',
// //                 color: '#efefefff',
// //                 fontWeight: 700,
// //                 textTransform: 'none',
// //                 px: 2.5,
// //                 boxShadow: '0 4px 12px rgba(242,183,5,0.3)',
// //                 '&:hover': { bgcolor: '#EAB308' }
// //               }}
// //             >
// //               Download PDF
// //             </Button>
// //           </Box>
// //         </DialogActions>
// //       </Dialog>
// //     </Box>
// //   );
// // }












// import React, { useState, useEffect, useCallback, useMemo } from 'react';
// import { useNavigate } from 'react-router-dom';
// import {
//   Box,
//   Typography,
//   Button,
//   Paper,
//   Chip,
//   IconButton,
//   Tooltip,
//   CircularProgress,
//   Dialog,
//   DialogContent,
//   DialogActions,
//   DialogTitle,
//   useMediaQuery,
//   useTheme
// } from '@mui/material';
// import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
// import DownloadIcon from '@mui/icons-material/Download';
// import VisibilityIcon from '@mui/icons-material/Visibility';
// import CheckCircleIcon from '@mui/icons-material/CheckCircle';
// import ContentCopyIcon from '@mui/icons-material/ContentCopy';
// import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
// import CloseIcon from '@mui/icons-material/Close';
// import SchoolIcon from '@mui/icons-material/School';
// import AccessTimeIcon from '@mui/icons-material/AccessTime';
// import toast from 'react-hot-toast';

// import { webinarService, certificateService } from '../../services/api';
// import { useAuth } from '../../context/AuthContext';
// import { useThemeColors } from '../../context/ThemeContext';
// import CustomSearchBar from '../../components/CustomSearchBar';

// // Helper: Format Date
// const formatDate = (dateStr) => {
//   if (!dateStr) return '—';
//   try {
//     const d = new Date(dateStr);
//     return d.toLocaleDateString('en-US', {
//       weekday: 'short',
//       month: 'short',
//       day: 'numeric',
//       year: 'numeric'
//     });
//   } catch {
//     return dateStr;
//   }
// };

// export default function MyCertificates() {
//   const colors = useThemeColors();
//   const { user } = useAuth();
//   const navigate = useNavigate();

//   const [certificates, setCertificates] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [search, setSearch] = useState('');
//   const [downloadingId, setDownloadingId] = useState(null);

//   // View / Preview Dialog state
//   const [viewDialogWebinar, setViewDialogWebinar] = useState(null);
//   const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
//   const [previewLoading, setPreviewLoading] = useState(false);

//   // Responsive fit: certificate is rendered at a fixed logical size and scaled to the popup
//   const theme = useTheme();
//   const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
//   const PDF_W = 1123; // A4 landscape @ 96dpi
//   const PDF_H = 794;
//   const [previewBox, setPreviewBox] = useState(null);
//   const [previewScale, setPreviewScale] = useState(1);

//   useEffect(() => {
//     if (!previewBox) return undefined;
//     const update = () => {
//       const w = previewBox.clientWidth;
//       const h = previewBox.clientHeight;
//       if (w > 0 && h > 0) {
//         setPreviewScale(Math.min(w / PDF_W, h / PDF_H));
//       }
//     };
//     update();
//     const ro = new ResizeObserver(update);
//     ro.observe(previewBox);
//     return () => ro.disconnect();
//   }, [previewBox]);

//   const [templateBannerSrc, setTemplateBannerSrc] = useState(null);

//   const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5270';
//   const templateImgUrl = `${apiBase}/api/certificates/templates/CertificateTemplate1/preview`;

//   // Fetch certificate template preview (authenticated with JWT)
//   useEffect(() => {
//     certificateService.getTemplates()
//       .then((res) => {
//         if (res.data?.success && res.data.data?.length > 0) {
//           const t = res.data.data[0];
//           setTemplateBannerSrc(t.previewBase64 || t.previewUrl);
//         }
//       })
//       .catch((err) => {
//         console.error('Could not load template preview:', err);
//       });
//   }, []);

//   // Load completed webinars and filter for certificate-eligible
//   const loadCertificates = useCallback(async () => {
//     setLoading(true);
//     try {
//       const res = await webinarService.getCompleted();
//       if (res.data?.success) {
//         const allCompleted = res.data.data || [];
//         const eligibleOnly = allCompleted.filter(
//           (w) => w.canDownloadCertificate || w.isCertificateEligible
//         );
//         setCertificates(eligibleOnly);
//       }
//     } catch (err) {
//       console.error('Error fetching certificates:', err);
//       toast.error('Failed to load certificates');
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     loadCertificates();
//   }, [loadCertificates]);

//   // Clean up blob URL on unmount or dialog close
//   useEffect(() => {
//     return () => {
//       if (previewBlobUrl) {
//         window.URL.revokeObjectURL(previewBlobUrl);
//       }
//     };
//   }, [previewBlobUrl]);

//   // Filtered certificates list
//   const filteredCertificates = useMemo(() => {
//     if (!search.trim()) return certificates;
//     const q = search.toLowerCase();
//     return certificates.filter((item) => {
//       const matchesTitle = item.webinarName?.toLowerCase().includes(q);
//       const matchesCode = (item.certificateCode || item.certificateId)?.toLowerCase().includes(q);
//       const matchesInstructor = item.conductorName?.toLowerCase().includes(q);
//       const matchesCat = item.categoryName?.toLowerCase().includes(q);
//       return matchesTitle || matchesCode || matchesInstructor || matchesCat;
//     });
//   }, [certificates, search]);

//   // Statistics summary
//   const stats = useMemo(() => {
//     const total = certificates.length;
//     const totalSeconds = certificates.reduce((acc, c) => acc + (c.attendedDuration || 0), 0);
//     const hours = (totalSeconds / 3600).toFixed(1);
//     return { total, hours };
//   }, [certificates]);

//   // Trigger PDF file download
//   const handleDownload = async (webinar, e) => {
//     e?.stopPropagation();
//     setDownloadingId(webinar.webinarId);
//     try {
//       const res = await webinarService.downloadStudentCertificate(webinar.webinarId);
//       const blob = new Blob([res.data], { type: 'application/pdf' });
//       const url = window.URL.createObjectURL(blob);
//       const link = document.createElement('a');
//       link.href = url;
//       const safeName = (webinar.webinarName || 'Webinar').replace(/[^a-zA-Z0-9]/g, '_');
//       link.setAttribute('download', `${safeName}-Certificate.pdf`);
//       document.body.appendChild(link);
//       link.click();
//       link.parentNode.removeChild(link);
//       window.URL.revokeObjectURL(url);
//       toast.success('Certificate downloaded successfully! 🎓');
//     } catch (err) {
//       console.error('Error downloading certificate:', err);
//       toast.error('Failed to download certificate. Please try again.');
//     } finally {
//       setDownloadingId(null);
//     }
//   };

//   // Open Full Certificate View Modal
//   const handleOpenView = async (webinar) => {
//     setViewDialogWebinar(webinar);
//     setPreviewLoading(true);
//     try {
//       if (previewBlobUrl) {
//         window.URL.revokeObjectURL(previewBlobUrl);
//       }
//       const res = await (webinarService.previewStudentCertificate
//         ? webinarService.previewStudentCertificate(webinar.webinarId)
//         : webinarService.downloadStudentCertificate(webinar.webinarId));
//       const blob = new Blob([res.data], { type: 'application/pdf' });
//       const url = window.URL.createObjectURL(blob);
//       setPreviewBlobUrl(url);
//     } catch (err) {
//       console.error('Error loading certificate preview:', err);
//       toast.error('Could not load certificate preview');
//     } finally {
//       setPreviewLoading(false);
//     }
//   };

//   const handleCloseView = () => {
//     setViewDialogWebinar(null);
//     if (previewBlobUrl) {
//       window.URL.revokeObjectURL(previewBlobUrl);
//       setPreviewBlobUrl(null);
//     }
//   };



//   return (
//     <Box
//       sx={{
//         minHeight: 'calc(100vh - 110px)',
//         display: 'flex',
//         flexDirection: 'column',
//         maxWidth: 1600,
//         bgcolor: 'transparent',
//         mx: 'auto',
//         width: '100%'
//       }}
//     >
//       {/* ── Top Hero Banner (Rich Dark Navy & Gold Palette) ────────────────── */}
//       <Box
//         sx={{
//           mb: 2.5,
//           px: { xs: 2.5, sm: 3.5 },
//           py: { xs: 2.5, sm: 3 },
//           borderRadius: '20px',
//           background: 'radial-gradient(circle at 90% 15%, rgba(242,183,5,0.22) 0%, transparent 42%), radial-gradient(circle at 15% 90%, rgba(56,189,248,0.12) 0%, transparent 35%), linear-gradient(125deg, #172338 0%, #202D43 60%, #26364D 100%)',
//           color: '#FFFFFF',
//           border: '1px solid rgba(255,255,255,0.1)',
//           boxShadow: '0 16px 36px rgba(23, 35, 56, 0.16)',
//           position: 'relative',
//           overflow: 'hidden',
//           '&:before': {
//             content: '""',
//             position: 'absolute',
//             left: 0,
//             top: 0,
//             bottom: 0,
//             width: 6,
//             background: 'linear-gradient(180deg, #FDE047 0%, #F2B705 50%, #D97706 100%)',
//           },
//           display: 'flex',
//           alignItems: 'center',
//           justifyContent: 'space-between',
//           flexWrap: 'wrap',
//           gap: 2.5,
//           flexShrink: 0,
//         }}
//       >
//         <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.25 }}>
//           <Box
//             sx={{
//               width: 56,
//               height: 56,
//               borderRadius: '16px',
//               background: 'linear-gradient(135deg, #FDE047 0%, #F2B705 100%)',
//               display: 'flex',
//               alignItems: 'center',
//               justifyContent: 'center',
//               boxShadow: '0 8px 22px rgba(242,183,5,0.35)',
//               flexShrink: 0,
//             }}
//           >
//             <WorkspacePremiumIcon sx={{ color: '#172338', fontSize: 32 }} />
//           </Box>
//           <Box>
//             <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap', mb: 0.5 }}>
//               <Typography
//                 variant="h5"
//                 sx={{
//                   fontWeight: 700,
//                   color: '#FFFFFF',
//                   letterSpacing: '-0.5px',
//                   lineHeight: 1.2,
//                   fontSize: { xs: '1.35rem', sm: '1.6rem' }
//                 }}
//               >
//                 My Certificates
//               </Typography>
             
//             </Box>
//             <Typography
//               variant="body2"
//               sx={{
//                 color: 'rgba(255,255,255,0.78)',
//                 fontWeight: 400,
//                 fontSize: { xs: '0.85rem', sm: '0.92rem' },
//                 maxWidth: 560,
//               }}
//             >
//               View, verify, and download your accredited webinar completion certificates.
//             </Typography>
//           </Box>
//         </Box>

//         {/* Quick Stats Cards inside Banner */}
//         <Box
//           sx={{
//             display: 'grid',
//             gridTemplateColumns: 'repeat(2, minmax(130px, 1fr))',
//             gap: 1.5,
//             width: { xs: '100%', sm: 'auto' },
//           }}
//         >
//           <Paper
//             elevation={0}
//             sx={{
//               px: 2.5,
//               py: 1.25,
//               borderRadius: '14px',
//               bgcolor: 'rgba(34, 197, 94, 0.16)',
//               backdropFilter: 'blur(12px)',
//               border: '1px solid rgba(74, 222, 128, 0.35)',
//               display: 'flex',
//               flexDirection: 'column',
//               justifyContent: 'center',
//               alignItems: { xs: 'center', sm: 'flex-start' },
//             }}
//           >
//             <Typography
//               variant="caption"
//               sx={{
//                 fontWeight: 700,
//                 color: '#8BE0A7',
//                 textTransform: 'uppercase',
//                 letterSpacing: '0.6px',
//                 fontSize: '0.68rem',
//                 mb: 0.25
//               }}
//             >
//               Earned Certificates
//             </Typography>
//             <Typography variant="h6" sx={{ fontWeight: 700, color: '#8BE0A7', lineHeight: 1.1 }}>
//               {stats.total}
//             </Typography>
//           </Paper>

//           <Paper
//             elevation={0}
//             sx={{
//               px: 2.5,
//               py: 1.25,
//               borderRadius: '14px',
//               background: 'linear-gradient(135deg, rgba(242,183,5,0.22) 0%, rgba(242,183,5,0.08) 100%)',
//               backdropFilter: 'blur(12px)',
//               border: '1px solid rgba(242,183,5,0.35)',
//               display: 'flex',
//               flexDirection: 'column',
//               justifyContent: 'center',
//               alignItems: { xs: 'center', sm: 'flex-start' },
//             }}
//           >
//             <Typography
//               variant="caption"
//               sx={{
//                 fontWeight: 700,
//                 color: '#FFD45A',
//                 textTransform: 'uppercase',
//                 letterSpacing: '0.6px',
//                 fontSize: '0.68rem',
//                 mb: 0.25
//               }}
//             >
//               Certified Hours
//             </Typography>
//             <Typography variant="h6" sx={{ fontWeight: 700, color: '#FFFFFF', lineHeight: 1.1 }}>
//               {stats.hours}h
//             </Typography>
//           </Paper>
//         </Box>
//       </Box>

//       {/* ── Search Toolbar ─────────────────────────────────────────────────── */}
//       <Paper
//         elevation={0}
//         sx={{
//           p: { xs: 1.5, sm: 1.75 },
//           mb: 2.5,
//           borderRadius: '16px',
//           bgcolor: colors.surface,
//           border: `1px solid ${colors.border}`,
//           boxShadow: '0 4px 20px rgba(15, 23, 42, 0.04)',
//           display: 'flex',
//           alignItems: 'center',
//           justifyContent: 'space-between',
//           flexWrap: 'wrap',
//           gap: 2,
//           flexShrink: 0,
//         }}
//       >
//         <Box sx={{ flexGrow: 1, minWidth: { xs: '100%', sm: 300 }, maxWidth: { xs: '100%', sm: 460 } }}>
//           <CustomSearchBar
//             value={search}
//             onChange={(val) => setSearch(val)}
//             placeholder="Search certificates by webinar, code, instructor..."
//             maxWidth="100%"
//             sx={{ width: '100%' }}
//           />
//         </Box>

//         <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
//           <Chip
//             icon={<WorkspacePremiumIcon sx={{ fontSize: '15px !important', color: '#166534' }} />}
//             label={`Showing ${filteredCertificates.length} of ${certificates.length} Certificates`}
//             size="small"
//             sx={{
//               fontWeight: 700,
//               fontSize: '0.78rem',
//               height: 32,
//               px: 1,
//               bgcolor: '#F0FDF4',
//               color: '#166534',
//               border: '1px solid #BBF7D0'
//             }}
//           />
//         </Box>
//       </Paper>

//       {/* ── Certificate Cards Grid (Increased Width, Reduced Height like Eduprep) ── */}
//       <Box sx={{ flexGrow: 1, pb: 3 }}>
//         {loading ? (
//           <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 10, gap: 2 }}>
//             <CircularProgress size={42} thickness={4.5} sx={{ color: '#F2B705' }} />
//             <Typography variant="body2" sx={{ color: colors.textSecondary, fontWeight: 600 }}>
//               Loading your certificates...
//             </Typography>
//           </Box>
//         ) : filteredCertificates.length === 0 ? (
//           <Paper
//             elevation={0}
//             sx={{
//               py: 8,
//               px: 3,
//               textAlign: 'center',
//               borderRadius: '20px',
//               bgcolor: colors.surface,
//               border: `1px dashed ${colors.border}`,
//               maxWidth: 580,
//               mx: 'auto',
//               mt: 2
//             }}
//           >
//             <Box
//               sx={{
//                 width: 76,
//                 height: 76,
//                 borderRadius: '50%',
//                 bgcolor: 'rgba(242,183,5,0.12)',
//                 display: 'flex',
//                 alignItems: 'center',
//                 justifyContent: 'center',
//                 mx: 'auto',
//                 mb: 2,
//               }}
//             >
//               <WorkspacePremiumIcon sx={{ fontSize: 40, color: '#D97706' }} />
//             </Box>
//             <Typography variant="h6" sx={{ fontWeight: 700, color: colors.textPrimary, mb: 0.75 }}>
//               {certificates.length === 0 ? 'No certificates earned yet' : 'No certificates match your search'}
//             </Typography>
//             <Typography variant="body2" sx={{ color: colors.textSecondary, maxWidth: 440, mx: 'auto', mb: 3, lineHeight: 1.6 }}>
//               {certificates.length === 0
//                 ? 'Attend live webinar sessions, complete the attendance criteria, and unlock your official certificates here!'
//                 : 'Try clearing your search keyword to view all your earned certificates.'}
//             </Typography>

//             {certificates.length === 0 ? (
//               <Button
//                 variant="contained"
//                 endIcon={<ArrowForwardIcon />}
//                 onClick={() => navigate('/dashboard/webinars?tab=available')}
//                 sx={{
//                   bgcolor: '#F2B705',
//                   color: '#172338',
//                   fontWeight: 800,
//                   textTransform: 'none',
//                   px: 3.5,
//                   py: 1.1,
//                   borderRadius: '12px',
//                   boxShadow: '0 6px 16px rgba(242,183,5,0.3)',
//                   '&:hover': { bgcolor: '#DDA600', boxShadow: '0 8px 22px rgba(242,183,5,0.4)' }
//                 }}
//               >
//                 Browse Upcoming Webinars
//               </Button>
//             ) : (
//               <Button
//                 variant="outlined"
//                 onClick={() => setSearch('')}
//                 sx={{
//                   color: '#172338',
//                   borderColor: '#F2B705',
//                   bgcolor: '#F2B705',
//                   fontWeight: 700,
//                   textTransform: 'none',
//                   borderRadius: '10px',
//                   px: 3,
//                   '&:hover': { bgcolor: '#DDA600', borderColor: '#DDA600' }
//                 }}
//               >
//                 Reset Search
//               </Button>
//             )}
//           </Paper>
//         ) : (
//           /* Grid container with wider card columns (380px to 440px wide, not skinny) */
//           <Box
//             sx={{
//               display: 'grid',
//               gridTemplateColumns: {
//                 xs: '1fr',
//                 sm: 'repeat(auto-fill, minmax(360px, 420px))',
//               },
//               gap: 3,
//               justifyContent: 'start',
//             }}
//           >
//             {filteredCertificates.map((w) => {
//               const certCode = w.certificateCode || w.certificateId;
//               const isDownloading = downloadingId === w.webinarId;
//               const cardBannerSrc = w.templateImageUrl
//                 ? (w.templateImageUrl.startsWith('http') ? w.templateImageUrl : `${apiBase}${w.templateImageUrl}`)
//                 : (templateBannerSrc || templateImgUrl);

//               return (
//                 <Paper
//                   key={w.webinarId}
//                   elevation={0}
//                   sx={{
//                     width: '100%',
//                     maxWidth: 440,
//                     display: 'flex',
//                     flexDirection: 'column',
//                     borderRadius: '20px',
//                     bgcolor: '#FFFFFF',
//                     border: '1.5px solid rgba(22, 163, 74, 0.28)',
//                     boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
//                     transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
//                     overflow: 'hidden',
//                     position: 'relative',
//                     '&:hover': {
//                       transform: 'translateY(-4px)',
//                       boxShadow: '0 16px 32px rgba(15, 23, 42, 0.12)',
//                       borderColor: '#16A34A',
//                       '& .cert-banner-img': {
//                         transform: 'scale(1.04)',
//                       }
//                     }
//                   }}
//                 >
//                   {/* ── TOP HALF: Certificate Top Half Visual Banner (Compact Height ~150px) ── */}
//                   <Box
//                     onClick={() => handleOpenView(w)}
//                     sx={{
//                       position: 'relative',
//                       height: 155,
//                       overflow: 'hidden',
//                       cursor: 'pointer',
//                       background: 'radial-gradient(circle at 80% 30%, #F59E0B 0%, #B45309 60%, #78350F 100%)',
//                       borderBottom: '1px solid #E2E8F0',
//                     }}
//                   >
//                     {/* Real template top-half image from wms.CertificateTemplates */}
//                     <Box
//                       component="img"
//                       className="cert-banner-img"
//                       src={cardBannerSrc}
//                       alt={`${w.webinarName} Certificate`}
//                       onError={(e) => {
//                         // Fallback: hide broken img, gradient remains
//                         e.target.style.display = 'none';
//                       }}
//                       sx={{
//                         width: '100%',
//                         height: '100%',
//                         objectFit: 'cover',
//                         objectPosition: 'top center',
//                         transition: 'transform 0.4s ease',
//                       }}
//                     />

//                     {/* Subtle dark gradient overlay to give trophy/cert banner depth */}
//                     <Box
//                       sx={{
//                         position: 'absolute',
//                         top: 0,
//                         left: 0,
//                         right: 0,
//                         bottom: 0,
//                         background: 'linear-gradient(180deg, rgba(15,23,42,0.1) 0%, rgba(15,23,42,0.45) 100%)',
//                         pointerEvents: 'none',
//                       }}
//                     />

//                     {/* Top Left: Category Tag from database table */}
//                     {w.categoryName && (
//                       <Box sx={{ position: 'absolute', top: 12, left: 12, zIndex: 2 }}>
//                         <Chip
//                           label={w.categoryName}
//                           size="small"
//                           sx={{
//                             fontWeight: 750,
//                             fontSize: '0.72rem',
//                             height: 24,
//                             bgcolor: 'rgba(255, 255, 255, 0.95)',
//                             color: '#0F172A',
//                             boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
//                           }}
//                         />
//                       </Box>
//                     )}

//                     {/* Top Right: "Completed" Pill Badge (Matches Eduprep Style) */}
//                     <Box sx={{ position: 'absolute', top: 12, right: 12, zIndex: 2 }}>
//                       <Box
//                         sx={{
//                           display: 'flex',
//                           alignItems: 'center',
//                           gap: 0.6,
//                           bgcolor: 'rgba(23, 35, 56, 0.72)',
//                           backdropFilter: 'blur(8px)',
//                           border: '1px solid rgba(255, 255, 255, 0.22)',
//                           color: '#FFFFFF',
//                           px: 1.25,
//                           py: 0.4,
//                           borderRadius: '20px',
//                           boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
//                         }}
//                       >
//                         <AccessTimeIcon sx={{ fontSize: 13, color: '#FDE047' }} />
//                         <Typography variant="caption" sx={{ fontWeight: 800,color: '#FDE047' , fontSize: '0.70rem', letterSpacing: '0.3px' }}>
//                           Completed
//                         </Typography>
//                       </Box>
//                     </Box>

//                     {/* Bottom overlay: Student Certificate Recipient strip */}
//                     <Box
//                       sx={{
//                         position: 'absolute',
//                         bottom: 10,
//                         left: 12,
//                         right: 12,
//                         zIndex: 2,
//                         display: 'flex',
//                         alignItems: 'center',
//                         justifyContent: 'space-between',
//                         bgcolor: 'rgba(15, 23, 42, 0.8)',
//                         backdropFilter: 'blur(10px)',
//                         border: '1px solid rgba(255, 255, 255, 0.15)',
//                         borderRadius: '8px',
//                         px: 1.4,
//                         py: 0.5,
//                       }}
//                     >
//                       <Box sx={{ minWidth: 0, flex: 1 }}>
                        
//                         <Typography variant="body2" noWrap sx={{ color: '#FFFFFF', fontWeight: 700, fontSize: '0.80rem' }}>
//                           {w.participantName || user?.firstName || 'Student'}
//                         </Typography>
//                       </Box>
//                       <VisibilityIcon sx={{ color: '#FDE047', fontSize: 17 }} />
//                     </Box>
//                   </Box>

//                   {/* ── BOTTOM HALF: Content & Details (Matches Eduprep layout) ── */}
//                   <Box sx={{ p: 2.2, display: 'flex', flexDirection: 'column', flex: 1 }}>
//                     {/* Title in bold purple/indigo (Eduprep signature color) */}
//                     <Typography
//                       variant="h6"
//                       title={w.webinarName}
//                       sx={{
//                         fontWeight: 800,
//                         color: '#f2b705',
//                         fontSize: '1.12rem',
//                         lineHeight: 1.3,
//                         mb: 0.5,
//                         display: '-webkit-box',
//                         WebkitLineClamp: 1,
//                         WebkitBoxOrient: 'vertical',
//                         overflow: 'hidden',
//                       }}
//                     >
//                       {w.webinarName}
//                     </Typography>

//                     {/* Sub-line: Issued Date */}
//                     <Typography
//                       variant="body2"
//                       sx={{
//                         fontWeight: 700,
//                         color: '#1F2937',
//                         fontSize: '0.82rem',
//                         mb: 0.4
//                       }}
//                     >
//                       Completed At: {formatDate(w.webinarDate)}
//                     </Typography>

//                     {/* Short Description */}
//                     <Typography
//                       variant="caption"
//                       sx={{
//                         color: '#6B7280',
//                         fontSize: '0.78rem',
//                         display: 'block',
//                         mb: 1.8,
//                         lineHeight: 1.4
//                       }}
//                     >
//                       Certified training session led by {w.conductorName} • {w.durationMinutes} min
//                     </Typography>

//                     {/* Compact Info Box (Matches the Prize Money box in Eduprep) */}
//                     <Box
//                       sx={{
//                         bgcolor: '#F9FAFB',
//                         borderRadius: '12px',
//                         border: '1px solid #E5E7EB',
//                         p: 1.25,
//                         mb: 2,
//                         display: 'flex',
//                         flexDirection: 'column',
//                         gap: 0.8
//                       }}
//                     >
//                       {/* Row 1: Certificate ID / Code */}
//                       <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
//                         <Typography variant="caption" sx={{ fontWeight: 600, color: '#4B5563', fontSize: '0.75rem' }}>
//                           Certificate ID:
//                         </Typography>
//                         <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
//                           <Chip
//                             label={certCode || 'VERIFIED'}
//                             size="small"
//                             sx={{
//                               bgcolor: '#D1FAE5',
//                               color: '#065F46',
//                               fontWeight: 800,
//                               fontSize: '0.74rem',
//                               height: 22,
//                               borderRadius: '6px',
//                               fontFamily: 'monospace'
//                             }}
//                           />
                       
//                         </Box>
//                       </Box>

//                       {/* Row 2: Instructor */}
//                       <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
//                         <Typography variant="caption" sx={{ fontWeight: 600, color: '#4B5563', fontSize: '0.75rem' }}>
//                           Instructor:
//                         </Typography>
//                         <Chip
//                           icon={<SchoolIcon sx={{ fontSize: '13px !important', color: '#6D28D9' }} />}
//                           label={w.conductorName || 'Lead Speaker'}
//                           size="small"
//                           sx={{
//                             bgcolor: '#EDE9FE',
//                             color: '#5B21B6',
//                             fontWeight: 750,
//                             fontSize: '0.73rem',
//                             height: 22,
//                             borderRadius: '6px'
//                           }}
//                         />
//                       </Box>
//                     </Box>

//                     {/* Footer Row: Details (Eye) on Left & Download Button on Right */}
//                     <Box
//                       sx={{
//                         display: 'flex',
//                         alignItems: 'center',
//                         justifyContent: 'space-between',
//                         pt: 1.2,
//                         borderTop: '1px solid #F3F4F6',
//                         mt: 'auto'
//                       }}
//                     >
//                       {/* Left: View Details Button */}
//                       <Button
//                         variant="text"
//                         size="small"
//                         startIcon={<VisibilityIcon sx={{ fontSize: 17 }} />}
//                         onClick={() => handleOpenView(w)}
//                         sx={{
//                           color: '#4B5563',
//                           fontWeight: 700,
//                           fontSize: '0.84rem',
//                           textTransform: 'none',
//                           p: 0.5,
//                           '&:hover': { color: '#111827', bgcolor: 'transparent' }
//                         }}
//                       >
//                         View
//                       </Button>

//                       {/* Right: Download PDF Button */}
//                       <Button
//                         variant="contained"
//                         size="small"
//                         disabled={isDownloading}
//                         startIcon={
//                           isDownloading ? (
//                             <CircularProgress size={14} sx={{ color: '#172338' }} />
//                           ) : (
//                             <DownloadIcon sx={{ fontSize: 16 }} />
//                           )
//                         }
//                         onClick={(e) => handleDownload(w, e)}
//                         sx={{
//                           bgcolor: '#F2B705',
//                           color: '#172338',
//                           fontWeight: 700,
//                           fontSize: '0.80rem',
//                           textTransform: 'none',
//                           px: 2.2,
//                           py: 0.6,
//                           borderRadius: '8px',
//                           boxShadow: 'none',
//                           '&:hover': {
//                             bgcolor: '#EAB308',
//                             boxShadow: 'none'
//                           }
//                         }}
//                       >
//                         {isDownloading ? 'Downloading...' : 'Download'}
//                       </Button>
//                     </Box>
//                   </Box>
//                 </Paper>
//               );
//             })}
//           </Box>
//         )}
//       </Box>

//       {/* ── Interactive View / Preview Modal (Google-style gradient + blur) ── */}
//       <Dialog
//         open={Boolean(viewDialogWebinar)}
//         onClose={handleCloseView}
//         maxWidth={false}
//         fullWidth
//         // Blurred, tinted backdrop
//         BackdropProps={{
//           sx: {
//             backdropFilter: 'blur(10px)',
//             WebkitBackdropFilter: 'blur(10px)',
//             background:
//               'radial-gradient(circle at 15% 20%, rgba(66,133,244,0.35) 0%, transparent 45%), radial-gradient(circle at 85% 80%, rgba(242,183,5,0.30) 0%, transparent 45%), rgba(15,23,42,0.55)'
//           }
//         }}
//         // Styled via the Dialog's own sx + !important so MUI's default paper styles
//         // (auto height, scrollbars, square corners) can never override it.
//         sx={{
//           '& .MuiDialog-paper': {
//             position: 'relative !important',
//             width: 'min(94vw, 1500px) !important',
//             maxWidth: 'none !important',
//             height: isMobile ? 'auto !important' : '92vh !important',
//             maxHeight: '92vh !important',
//             margin: '0 !important',
//             display: 'flex !important',
//             flexDirection: 'column !important',
//             borderRadius: '28px !important',
//             overflow: 'hidden !important',
//             // Gradient border (blue → yellow → light blue)
//             border: '2.5px solid transparent !important',
//             background: `linear-gradient(${colors.surface || '#FFFFFF'}, ${colors.surface || '#FFFFFF'}) padding-box, linear-gradient(135deg, #4285F4 0%, #38BDF8 30%, #FDE047 65%, #F2B705 100%) border-box !important`,
//             boxShadow:
//               '0 30px 80px rgba(15,23,42,0.45), 0 0 60px rgba(66,133,244,0.25), 0 0 80px rgba(242,183,5,0.18) !important'
//           }
//         }}
//       >
//         {/* Blurred blue glow orbs in the four corners */}
//         <Box
//           sx={{
//             position: 'absolute',
//             top: -90,
//             left: -90,
//             width: 300,
//             height: 300,
//             borderRadius: '50%',
//             background: 'radial-gradient(circle, rgba(66,133,244,0.65) 0%, rgba(66,133,244,0) 70%)',
//             filter: 'blur(40px)',
//             pointerEvents: 'none',
//             zIndex: 0
//           }}
//         />
//         <Box
//           sx={{
//             position: 'absolute',
//             top: -70,
//             right: -70,
//             width: 260,
//             height: 260,
//             borderRadius: '50%',
//             background: 'radial-gradient(circle, rgba(56,189,248,0.55) 0%, rgba(56,189,248,0) 70%)',
//             filter: 'blur(40px)',
//             pointerEvents: 'none',
//             zIndex: 0
//           }}
//         />
//         <Box
//           sx={{
//             position: 'absolute',
//             bottom: -100,
//             left: -80,
//             width: 320,
//             height: 320,
//             borderRadius: '50%',
//             background: 'radial-gradient(circle, rgba(66,133,244,0.45) 0%, rgba(66,133,244,0) 70%)',
//             filter: 'blur(50px)',
//             pointerEvents: 'none',
//             zIndex: 0
//           }}
//         />
//         <Box
//           sx={{
//             position: 'absolute',
//             bottom: -90,
//             right: -90,
//             width: 320,
//             height: 320,
//             borderRadius: '50%',
//             background: 'radial-gradient(circle, rgba(66,133,244,0.55) 0%, rgba(66,133,244,0) 70%)',
//             filter: 'blur(50px)',
//             pointerEvents: 'none',
//             zIndex: 0
//           }}
//         />

//         {/* ── Header: yellow gradient (same family as the Download button) ── */}
//         <DialogTitle
//           component="div"
//           sx={{
//             position: 'relative',
//             zIndex: 2,
//             flexShrink: 0,
//             display: 'flex',
//             alignItems: 'center',
//             justifyContent: 'space-between',
//             py: 1,
//             px: { xs: 2, sm: 3 },
//             color: '#172338',
//             background:
//               'radial-gradient(circle at 12% 0%, rgba(255,255,255,0.55) 0%, transparent 45%), radial-gradient(circle at 100% 100%, rgba(66,133,244,0.35) 0%, transparent 50%), linear-gradient(110deg, #FDE047 0%, #F2B705 55%, #F59E0B 100%)',
//             borderBottom: '1px solid rgba(255,255,255,0.55)',
//             boxShadow: '0 8px 24px rgba(242,183,5,0.35)'
//           }}
//         >
//           <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
//             <Box
//               sx={{
//                 width: 38,
//                 height: 38,
//                 borderRadius: '12px',
//                 display: 'flex',
//                 alignItems: 'center',
//                 justifyContent: 'center',
//                 bgcolor: 'rgba(255,255,255,0.45)',
//                 backdropFilter: 'blur(10px)',
//                 border: '1px solid rgba(255,255,255,0.7)',
//                 boxShadow: '0 6px 16px rgba(23,35,56,0.18)'
//               }}
//             >
//               <WorkspacePremiumIcon sx={{ color: '#172338', fontSize: 23 }} />
//             </Box>
//             <Box>
//               <Typography
//                 variant="subtitle1"
//                 sx={{ color: '#172338', fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.3px', fontSize: '1.02rem' }}
//               >
//                 Certificate of Completion
//               </Typography>
//               <Typography
//                 variant="body2"
//                 sx={{ color: 'rgba(23,35,56,0.78)', fontWeight: 600, fontSize: '0.78rem', mt: 0 }}
//               >
//                 {viewDialogWebinar?.webinarName}
//               </Typography>
//             </Box>
//           </Box>

//           <IconButton
//             onClick={handleCloseView}
//             size="small"
//             sx={{
//               color: '#172338',
//               bgcolor: 'rgba(255,255,255,0.45)',
//               backdropFilter: 'blur(10px)',
//               border: '1px solid rgba(255,255,255,0.7)',
//               transition: 'all 0.2s ease',
//               '&:hover': { bgcolor: 'rgba(255,255,255,0.8)', transform: 'rotate(90deg)' }
//             }}
//           >
//             <CloseIcon />
//           </IconButton>
//         </DialogTitle>

//         {/* ── Content: soft Google-style gradient with blurred color washes ── */}
//         <DialogContent
//           sx={{
//             position: 'relative',
//             zIndex: 1,
//             flex: 1,
//             minHeight: 0,
//             p: { xs: 1, sm: 1.5 },
//             overflow: 'hidden',
//             display: 'flex',
//             flexDirection: 'column',
//             alignItems: 'center',
//             justifyContent: 'center',
//             background:
//               'radial-gradient(circle at 0% 0%, rgba(66,133,244,0.22) 0%, transparent 40%), radial-gradient(circle at 100% 0%, rgba(56,189,248,0.18) 0%, transparent 38%), radial-gradient(circle at 100% 100%, rgba(66,133,244,0.22) 0%, transparent 40%), radial-gradient(circle at 0% 100%, rgba(253,224,71,0.20) 0%, transparent 40%), linear-gradient(135deg, rgba(66,133,244,0.06) 0%, rgba(255,255,255,0) 50%, rgba(242,183,5,0.10) 100%)'
//           }}
//         >
//           {previewLoading ? (
//             <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
//               <CircularProgress size={48} thickness={4} sx={{ color: '#4285F4' }} />
//               <Typography variant="body2" sx={{ color: colors.textPrimary, fontWeight: 700 }}>
//                 Rendering official vector PDF certificate...
//               </Typography>
//             </Box>
//           ) : isMobile ? (
//             <Box
//               sx={{
//                 textAlign: 'center',
//                 px: 2.5,
//                 py: 5,
//                 maxWidth: 360,
//                 borderRadius: '18px',
//                 bgcolor: 'rgba(255,255,255,0.75)',
//                 backdropFilter: 'blur(10px)',
//                 border: '1px solid rgba(66,133,244,0.3)'
//               }}
//             >
//               <WorkspacePremiumIcon sx={{ fontSize: 44, color: '#F2B705', mb: 1 }} />
//               <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#172338', mb: 0.5 }}>
//                 Not portable in mobile view
//               </Typography>
//               <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600 }}>
//                 You can download and see.
//               </Typography>
//             </Box>
//           ) : previewBlobUrl ? (
//             <Box
//               ref={setPreviewBox}
//               sx={{
//                 width: '100%',
//                 height: '100%',
//                 display: 'flex',
//                 alignItems: 'center',
//                 justifyContent: 'center',
//                 overflow: 'hidden'
//               }}
//             >
//               {/* Fixed-size PDF scaled down/up to exactly fit the available space */}
//               <Box
//                 sx={{
//                   width: PDF_W * previewScale,
//                   height: PDF_H * previewScale,
//                   flexShrink: 0,
//                   borderRadius: '14px',
//                   overflow: 'hidden',
//                   bgcolor: '#FFFFFF',
//                   border: '2px solid transparent',
//                   background:
//                     'linear-gradient(#FFFFFF, #FFFFFF) padding-box, linear-gradient(135deg, rgba(66,133,244,0.85), rgba(253,224,71,0.9), rgba(56,189,248,0.85)) border-box',
//                   boxShadow: '0 18px 50px rgba(15,23,42,0.28), 0 0 40px rgba(66,133,244,0.20)'
//                 }}
//               >
//                 <iframe
//                   src={`${previewBlobUrl}#toolbar=0&navpanes=0&scrollbar=0&view=Fit&zoom=page-fit`}
//                   title="Certificate PDF Viewer"
//                   scrolling="no"
//                   style={{
//                     width: PDF_W,
//                     height: PDF_H,
//                     border: 'none',
//                     display: 'block',
//                     overflow: 'hidden',
//                     transform: `scale(${previewScale})`,
//                     transformOrigin: 'top left'
//                   }}
//                 />
//               </Box>
//             </Box>
//           ) : (
//             <Typography variant="body2" sx={{ color: colors.textPrimary, py: 8, fontWeight: 600 }}>
//               Failed to display certificate preview.
//             </Typography>
//           )}
//         </DialogContent>

//         {/* ── Footer: frosted glass bar ── */}
//         <DialogActions
//           sx={{
//             position: 'relative',
//             zIndex: 2,
//             flexShrink: 0,
//             py: 1.1,
//             px: { xs: 2, sm: 3 },
//             background:
//               'linear-gradient(90deg, rgba(66,133,244,0.10) 0%, rgba(255,255,255,0.65) 50%, rgba(242,183,5,0.16) 100%)',
//             backdropFilter: 'blur(14px)',
//             WebkitBackdropFilter: 'blur(14px)',
//             borderTop: '1px solid rgba(66,133,244,0.25)',
//             display: 'flex',
//             alignItems: 'center',
//             justifyContent: 'flex-end',
//             gap: 1.5
//           }}
//         >
//           <Button
//             variant="outlined"
//             onClick={handleCloseView}
//             sx={{
//               borderRadius: '12px',
//               color: '#1D4ED8',
//               borderColor: 'rgba(66,133,244,0.55)',
//               bgcolor: 'rgba(255,255,255,0.7)',
//               backdropFilter: 'blur(6px)',
//               textTransform: 'none',
//               fontWeight: 700,
//               px: 3,
//               '&:hover': { bgcolor: 'rgba(66,133,244,0.12)', borderColor: '#4285F4' }
//             }}
//           >
//             Close
//           </Button>
//           <Button
//             variant="contained"
//             startIcon={<DownloadIcon />}
//             onClick={() => handleDownload(viewDialogWebinar)}
//             sx={{
//               borderRadius: '12px',
//               background: 'linear-gradient(110deg, #FDE047 0%, #F2B705 60%, #F59E0B 100%)',
//               color: '#172338',
//               fontWeight: 800,
//               textTransform: 'none',
//               px: 3.5,
//               boxShadow: '0 8px 22px rgba(242,183,5,0.45), 0 0 0 1px rgba(255,255,255,0.5) inset',
//               '&:hover': {
//                 background: 'linear-gradient(110deg, #FACC15 0%, #EAB308 60%, #D97706 100%)',
//                 boxShadow: '0 10px 28px rgba(242,183,5,0.55)'
//               }
//             }}
//           >
//             Download PDF
//           </Button>
//         </DialogActions>
//       </Dialog>
//     </Box>
//   );
// }







import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogActions,
  DialogTitle,
  InputBase,
  useMediaQuery,
  useTheme
} from '@mui/material';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CloseIcon from '@mui/icons-material/Close';
import SchoolIcon from '@mui/icons-material/School';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SearchIcon from '@mui/icons-material/Search';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import VerifiedIcon from '@mui/icons-material/Verified';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import toast from 'react-hot-toast';

import { webinarService, certificateService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useThemeColors } from '../../context/ThemeContext';

// Helper: Format Date
const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

export default function MyCertificates() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  // View / Preview Dialog state
  const [viewDialogWebinar, setViewDialogWebinar] = useState(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Responsive fit: certificate is rendered at a fixed logical size and scaled to the popup
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const PDF_W = 1123; // A4 landscape @ 96dpi
  const PDF_H = 794;
  const [previewBox, setPreviewBox] = useState(null);
  const [previewScale, setPreviewScale] = useState(1);

  useEffect(() => {
    if (!previewBox) return undefined;
    const update = () => {
      const w = previewBox.clientWidth;
      const h = previewBox.clientHeight;
      if (w > 0 && h > 0) {
        setPreviewScale(Math.min(w / PDF_W, h / PDF_H));
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(previewBox);
    return () => ro.disconnect();
  }, [previewBox]);

  const [templateBannerSrc, setTemplateBannerSrc] = useState(null);

  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5270';
  const templateImgUrl = `${apiBase}/api/certificates/templates/CertificateTemplate1/preview`;

  // Fetch certificate template preview (authenticated with JWT)
  useEffect(() => {
    certificateService.getTemplates()
      .then((res) => {
        if (res.data?.success && res.data.data?.length > 0) {
          const t = res.data.data[0];
          setTemplateBannerSrc(t.previewBase64 || t.previewUrl);
        }
      })
      .catch((err) => {
        console.error('Could not load template preview:', err);
      });
  }, []);

  // Load completed webinars and filter for certificate-eligible
  const loadCertificates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await webinarService.getCompleted();
      if (res.data?.success) {
        const allCompleted = res.data.data || [];
        const eligibleOnly = allCompleted.filter(
          (w) => w.canDownloadCertificate || w.isCertificateEligible
        );
        setCertificates(eligibleOnly);
      }
    } catch (err) {
      console.error('Error fetching certificates:', err);
      toast.error('Failed to load certificates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCertificates();
  }, [loadCertificates]);

  // Clean up blob URL on unmount or dialog close
  useEffect(() => {
    return () => {
      if (previewBlobUrl) {
        window.URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [previewBlobUrl]);

  // Filtered certificates list
  const filteredCertificates = useMemo(() => {
    if (!search.trim()) return certificates;
    const q = search.toLowerCase();
    return certificates.filter((item) => {
      const matchesTitle = item.webinarName?.toLowerCase().includes(q);
      const matchesCode = (item.certificateCode || item.certificateId)?.toLowerCase().includes(q);
      const matchesInstructor = item.conductorName?.toLowerCase().includes(q);
      const matchesCat = item.categoryName?.toLowerCase().includes(q);
      return matchesTitle || matchesCode || matchesInstructor || matchesCat;
    });
  }, [certificates, search]);

  // Statistics summary
  const stats = useMemo(() => {
    const total = certificates.length;
    const totalSeconds = certificates.reduce((acc, c) => acc + (c.attendedDuration || 0), 0);
    const hours = (totalSeconds / 3600).toFixed(1);
    const categories = new Set(certificates.map((c) => c.categoryName).filter(Boolean)).size;
    const latestRaw = certificates
      .map((c) => c.webinarDate)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0];
    const latest = latestRaw
      ? new Date(latestRaw).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : '—';
    return { total, hours, categories, latest };
  }, [certificates]);

  const statTiles = [
    {
      label: 'Earned Certificates',
      value: stats.total,
      icon: <WorkspacePremiumIcon sx={{ fontSize: 28 }} />,
      bg: 'linear-gradient(135deg, #FFF1E2 0%, #FFF8F0 100%)',
      border: 'rgba(249,115,22,0.18)',
      iconBg: '#FFE0C2',
      iconColor: '#EA580C',
      shadow: 'rgba(249,115,22,0.16)'
    },
    {
      label: 'Certified Hours',
      value: `${stats.hours}h`,
      icon: <AccessTimeIcon sx={{ fontSize: 28 }} />,
      bg: 'linear-gradient(135deg, #EAF2FF 0%, #F5F9FF 100%)',
      border: 'rgba(66,133,244,0.20)',
      iconBg: '#D6E6FF',
      iconColor: '#1D4ED8',
      shadow: 'rgba(66,133,244,0.16)'
    },
    {
      label: 'Latest Completion',
      value: stats.latest,
      icon: <EventAvailableIcon sx={{ fontSize: 28 }} />,
      bg: 'linear-gradient(135deg, #E9F9EE 0%, #F4FCF7 100%)',
      border: 'rgba(34,197,94,0.22)',
      iconBg: '#CDF3D8',
      iconColor: '#16A34A',
      shadow: 'rgba(34,197,94,0.16)'
    },
    {
      label: 'Topics Covered',
      value: stats.categories,
      icon: <CategoryOutlinedIcon sx={{ fontSize: 28 }} />,
      bg: 'linear-gradient(135deg, #F3EDFF 0%, #FAF7FF 100%)',
      border: 'rgba(139,92,246,0.20)',
      iconBg: '#E4D8FF',
      iconColor: '#7C3AED',
      shadow: 'rgba(139,92,246,0.16)'
    }
  ];

  // Copy certificate ID
  const handleCopyId = (code, e) => {
    e?.stopPropagation();
    if (!code) return;
    navigator.clipboard
      ?.writeText(code)
      .then(() => toast.success('Certificate ID copied'))
      .catch(() => toast.error('Could not copy ID'));
  };

  // Trigger PDF file download
  const handleDownload = async (webinar, e) => {
    e?.stopPropagation();
    setDownloadingId(webinar.webinarId);
    try {
      const res = await webinarService.downloadStudentCertificate(webinar.webinarId);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = (webinar.webinarName || 'Webinar').replace(/[^a-zA-Z0-9]/g, '_');
      link.setAttribute('download', `${safeName}-Certificate.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Certificate downloaded successfully! 🎓');
    } catch (err) {
      console.error('Error downloading certificate:', err);
      toast.error('Failed to download certificate. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  // Open Full Certificate View Modal
  const handleOpenView = async (webinar) => {
    setViewDialogWebinar(webinar);
    setPreviewLoading(true);
    try {
      if (previewBlobUrl) {
        window.URL.revokeObjectURL(previewBlobUrl);
      }
      const res = await (webinarService.previewStudentCertificate
        ? webinarService.previewStudentCertificate(webinar.webinarId)
        : webinarService.downloadStudentCertificate(webinar.webinarId));
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      setPreviewBlobUrl(url);
    } catch (err) {
      console.error('Error loading certificate preview:', err);
      toast.error('Could not load certificate preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCloseView = () => {
    setViewDialogWebinar(null);
    if (previewBlobUrl) {
      window.URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
  };



  return (
    <Box
      sx={{
        minHeight: 'calc(100vh - 110px)',
        display: 'flex',
        flexDirection: 'column',
        maxWidth: 1600,
        bgcolor: 'transparent',
        mx: 'auto',
        width: '100%'
      }}
    >
      {/* ── Hero: soft pastel gradient, Google-style ───────────────────────── */}
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          mb: 3,
          px: { xs: 3, md: 5 },
          py: { xs: 3.5, md: 4.5 },
          borderRadius: '32px',
          background:
            'radial-gradient(circle at 85% 20%, rgba(66,133,244,0.10) 0%, transparent 40%), radial-gradient(circle at 10% 100%, rgba(253,224,71,0.25) 0%, transparent 45%), linear-gradient(120deg, #FFF3E6 0%, #FFF9F2 50%, #F3F7FF 100%)',
          border: '1px solid rgba(249,115,22,0.16)',
          boxShadow: '0 10px 40px rgba(249,115,22,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 3,
          flexShrink: 0
        }}
      >
        <Box sx={{ position: 'relative', zIndex: 2, maxWidth: 620 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.8,
              px: 1.6,
              py: 0.6,
              mb: 2,
              borderRadius: '999px',
              bgcolor: 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(249,115,22,0.22)',
              boxShadow: '0 2px 8px rgba(249,115,22,0.10)'
            }}
          >
            <WorkspacePremiumIcon sx={{ fontSize: 17, color: '#EA580C' }} />
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#9A3412' }}>
              Accredited Certificates
            </Typography>
          </Box>

          <Typography
            component="h1"
            sx={{
              fontWeight: 800,
              fontSize: { xs: '1.9rem', md: '2.7rem' },
              lineHeight: 1.12,
              letterSpacing: '-1px',
              color: '#0F172A'
            }}
          >
            Celebrate Your{' '}
            <Box
              component="span"
              sx={{
                background: 'linear-gradient(90deg, #F97316 0%, #F2B705 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              Achievements
            </Box>
          </Typography>
          <Typography sx={{ mt: 1.5, color: '#475569', fontSize: { xs: '0.95rem', md: '1.05rem' }, lineHeight: 1.6 }}>
            View, verify, and download your accredited webinar completion certificates.
          </Typography>

          <Button
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            onClick={() => navigate('/dashboard/webinars?tab=available')}
            sx={{
              mt: 3,
              px: 3.2,
              py: 1.3,
              borderRadius: '16px',
              textTransform: 'none',
              fontWeight: 800,
              fontSize: '0.98rem',
              color: '#FFFFFF',
              background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
              boxShadow: '0 10px 24px rgba(234,88,12,0.35)',
              '&:hover': {
                background: 'linear-gradient(135deg, #FB923C 0%, #EA580C 100%)',
                boxShadow: '0 14px 30px rgba(234,88,12,0.45)'
              }
            }}
          >
            Explore Webinars
          </Button>
        </Box>

        {/* Decorative certificate illustration */}
        <Box
          sx={{
            display: { xs: 'none', md: 'block' },
            position: 'relative',
            width: 380,
            height: 220,
            flexShrink: 0,
            mr: 2
          }}
        >
          <Box sx={{ position: 'absolute', top: -6, left: 10, width: 120, height: 120, borderRadius: '50%', bgcolor: 'rgba(134,239,172,0.55)' }} />
          <Box sx={{ position: 'absolute', bottom: 0, right: 0, width: 130, height: 130, borderRadius: '50%', bgcolor: 'rgba(147,197,253,0.50)' }} />
          <Box sx={{ position: 'absolute', top: 30, right: 36, width: 56, height: 56, borderRadius: '50%', bgcolor: 'rgba(253,224,71,0.65)' }} />

          <Box
            sx={{
              position: 'absolute',
              top: 18,
              left: 44,
              width: 270,
              height: 178,
              borderRadius: '18px',
              bgcolor: '#FFFFFF',
              transform: 'rotate(-5deg)',
              boxShadow: '0 22px 44px rgba(15,23,42,0.18)',
              border: '2px solid #F2B705',
              p: 1.2
            }}
          >
            <Box
              sx={{
                height: '100%',
                borderRadius: '12px',
                border: '1px solid rgba(242,183,5,0.55)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.6,
                px: 2
              }}
            >
              <Typography sx={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: '1.15rem', letterSpacing: '4px', color: '#B7791F' }}>
                CERTIFICATE
              </Typography>
              <Typography sx={{ fontSize: '0.5rem', fontWeight: 800, letterSpacing: '3px', color: '#D4A017' }}>
                OF APPRECIATION
              </Typography>
              <Box sx={{ width: '70%', height: 3, borderRadius: 2, bgcolor: '#E2E8F0', mt: 1 }} />
              <Box sx={{ width: '55%', height: 3, borderRadius: 2, bgcolor: '#EEF2F7' }} />
              <Box sx={{ width: '62%', height: 3, borderRadius: 2, bgcolor: '#EEF2F7' }} />
            </Box>
          </Box>

          <Box
            sx={{
              position: 'absolute',
              bottom: 8,
              left: 250,
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #FDE047 0%, #F2B705 60%, #D97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 12px 26px rgba(217,119,6,0.4)',
              border: '3px solid #FFFFFF'
            }}
          >
            <WorkspacePremiumIcon sx={{ color: '#FFFFFF', fontSize: 34 }} />
          </Box>

          <Box
            sx={{
              position: 'absolute',
              top: 0,
              right: 22,
              width: 62,
              height: 62,
              borderRadius: '18px',
              bgcolor: '#172338',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: 'rotate(8deg)',
              boxShadow: '0 12px 26px rgba(23,35,56,0.35)'
            }}
          >
            <SchoolIcon sx={{ color: '#FDE047', fontSize: 34 }} />
          </Box>
        </Box>
      </Box>

      {/* ── Stat tiles (pastel, like the Webinars page) ────────────────────── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
          gap: 2,
          mb: 4,
          flexShrink: 0
        }}
      >
        {statTiles.map((t) => (
          <Box
            key={t.label}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              p: { xs: 1.75, md: 2.5 },
              borderRadius: '24px',
              background: t.bg,
              border: `1px solid ${t.border}`,
              transition: 'all 0.25s ease',
              '&:hover': { transform: 'translateY(-3px)', boxShadow: `0 14px 30px ${t.shadow}` }
            }}
          >
            <Box
              sx={{
                width: 54,
                height: 54,
                borderRadius: '16px',
                bgcolor: t.iconBg,
                color: t.iconColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {t.icon}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748B' }} noWrap>
                {t.label}
              </Typography>
              <Typography sx={{ fontSize: { xs: '1.5rem', md: '1.9rem' }, fontWeight: 800, color: '#0F172A', lineHeight: 1.15 }} noWrap>
                {t.value}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      {/* ── Section header + search ────────────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', md: 'flex-end' },
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2,
          mb: 3,
          flexShrink: 0
        }}
      >
        <Box>
          <Typography
            component="h2"
            sx={{ fontSize: { xs: '1.6rem', md: '2rem' }, fontWeight: 800, letterSpacing: '-0.6px', color: colors.textPrimary, lineHeight: 1.2 }}
          >
            My Certificates
          </Typography>
          <Typography sx={{ mt: 0.5, color: colors.textSecondary, fontSize: '0.95rem' }}>
            Review your earned certificates, copy verification IDs, and download official PDFs.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: { xs: '100%', md: 'auto' }, flexWrap: 'wrap' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              height: 48,
              width: { xs: '100%', sm: 360 },
              borderRadius: '999px',
              bgcolor: colors.surface,
              border: `1px solid ${colors.border}`,
              boxShadow: '0 2px 10px rgba(15,23,42,0.04)',
              transition: 'all 0.2s ease',
              '&:focus-within': {
                borderColor: '#4285F4',
                boxShadow: '0 0 0 4px rgba(66,133,244,0.15)'
              }
            }}
          >
            <SearchIcon sx={{ color: '#94A3B8', fontSize: 22 }} />
            <InputBase
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by webinar, ID, instructor..."
              sx={{ flex: 1, fontSize: '0.95rem', fontWeight: 500, color: colors.textPrimary }}
            />
            {search && (
              <IconButton size="small" onClick={() => setSearch('')} sx={{ color: '#94A3B8' }}>
                <CloseIcon sx={{ fontSize: 18 }} />
              </IconButton>
            )}
          </Box>

          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.8,
              height: 48,
              px: 2,
              borderRadius: '999px',
              bgcolor: '#172338',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.88rem',
              whiteSpace: 'nowrap'
            }}
          >
            <WorkspacePremiumIcon sx={{ fontSize: 18, color: '#FDE047' }} />
            {filteredCertificates.length} of {certificates.length}
          </Box>
        </Box>
      </Box>

      {/* ── Certificate cards (horizontal, like the webinar cards) ─────────── */}
      <Box sx={{ flexGrow: 1, pb: 4 }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 10, gap: 2 }}>
            <CircularProgress size={44} thickness={4.5} sx={{ color: '#F97316' }} />
            <Typography variant="body2" sx={{ color: colors.textSecondary, fontWeight: 600 }}>
              Loading your certificates...
            </Typography>
          </Box>
        ) : filteredCertificates.length === 0 ? (
          <Box
            sx={{
              py: 8,
              px: 3,
              textAlign: 'center',
              borderRadius: '32px',
              background: 'linear-gradient(135deg, #FFF7ED 0%, #FFFFFF 55%, #F3F7FF 100%)',
              border: '1px dashed rgba(249,115,22,0.35)',
              maxWidth: 620,
              mx: 'auto',
              mt: 2
            }}
          >
            <Box
              sx={{
                width: 84,
                height: 84,
                borderRadius: '26px',
                background: 'linear-gradient(135deg, #FDE047 0%, #F2B705 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2.5,
                boxShadow: '0 12px 28px rgba(242,183,5,0.4)'
              }}
            >
              <WorkspacePremiumIcon sx={{ fontSize: 46, color: '#172338' }} />
            </Box>
            <Typography sx={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', mb: 0.75 }}>
              {certificates.length === 0 ? 'No certificates earned yet' : 'No certificates match your search'}
            </Typography>
            <Typography sx={{ color: '#64748B', maxWidth: 440, mx: 'auto', mb: 3, lineHeight: 1.6 }}>
              {certificates.length === 0
                ? 'Attend live webinar sessions, complete the attendance criteria, and unlock your official certificates here!'
                : 'Try clearing your search keyword to view all your earned certificates.'}
            </Typography>
            {certificates.length === 0 ? (
              <Button
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/dashboard/webinars?tab=available')}
                sx={{
                  px: 3.5,
                  py: 1.2,
                  borderRadius: '16px',
                  textTransform: 'none',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
                  boxShadow: '0 10px 24px rgba(234,88,12,0.35)'
                }}
              >
                Browse Upcoming Webinars
              </Button>
            ) : (
              <Button
                variant="outlined"
                onClick={() => setSearch('')}
                sx={{ px: 3, borderRadius: '999px', textTransform: 'none', fontWeight: 700, color: '#EA580C', borderColor: '#FDBA74' }}
              >
                Reset Search
              </Button>
            )}
          </Box>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(auto-fill, minmax(500px, 1fr))' },
              gap: 3
            }}
          >
            {filteredCertificates.map((w) => {
              const certCode = w.certificateCode || w.certificateId;
              const isDownloading = downloadingId === w.webinarId;
              const cardBannerSrc = w.templateImageUrl
                ? (w.templateImageUrl.startsWith('http') ? w.templateImageUrl : `${apiBase}${w.templateImageUrl}`)
                : (templateBannerSrc || templateImgUrl);
              const host = w.conductorName || 'Lead Speaker';

              return (
                <Paper
                  key={w.webinarId}
                  elevation={0}
                  sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: 2.5,
                    p: 2.5,
                    borderRadius: '28px',
                    bgcolor: colors.surface,
                    border: `1px solid ${colors.border}`,
                    boxShadow: '0 8px 30px rgba(15,23,42,0.05)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 20px 46px rgba(249,115,22,0.14)',
                      borderColor: 'rgba(249,115,22,0.35)',
                      '& .cert-thumb': { transform: 'scale(1.06)' },
                      '& .cert-eye': { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }
                    }
                  }}
                >
                  {/* Thumbnail */}
                  <Box
                    onClick={() => handleOpenView(w)}
                    sx={{
                      position: 'relative',
                      width: { xs: '100%', sm: 220 },
                      height: { xs: 190, sm: 'auto' },
                      minHeight: { sm: 230 },
                      flexShrink: 0,
                      borderRadius: '20px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      background: 'linear-gradient(135deg, #FFE8CC 0%, #FFD0A0 100%)',
                      border: '1px solid rgba(15,23,42,0.06)'
                    }}
                  >
                    <Box
                      component="img"
                      className="cert-thumb"
                      src={cardBannerSrc}
                      alt={`${w.webinarName} Certificate`}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'top center',
                        transition: 'transform 0.5s ease'
                      }}
                    />
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(180deg, rgba(15,23,42,0) 45%, rgba(15,23,42,0.72) 100%)',
                        pointerEvents: 'none'
                      }}
                    />
                    <Box
                      className="cert-eye"
                      sx={{
                        position: 'absolute',
                        top: '45%',
                        left: '50%',
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        bgcolor: 'rgba(255,255,255,0.95)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0,
                        transform: 'translate(-50%, -50%) scale(0.8)',
                        transition: 'all 0.25s ease',
                        boxShadow: '0 8px 22px rgba(0,0,0,0.25)'
                      }}
                    >
                      <VisibilityIcon sx={{ color: '#EA580C', fontSize: 24 }} />
                    </Box>
                    <Box sx={{ position: 'absolute', left: 12, right: 12, bottom: 10, pointerEvents: 'none' }}>
                      <Typography sx={{ fontSize: '0.66rem', fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                        Awarded to
                      </Typography>
                      <Typography noWrap sx={{ fontSize: '0.92rem', fontWeight: 800, color: '#FFFFFF' }}>
                        {w.participantName || user?.firstName || 'Student'}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Details */}
                  <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.2 }}>
                      {w.categoryName && (
                        <Chip
                          label={w.categoryName}
                          size="small"
                          sx={{ height: 28, fontWeight: 700, fontSize: '0.78rem', bgcolor: '#EDE9FE', color: '#5B21B6', borderRadius: '999px' }}
                        />
                      )}
                     
                    </Box>

                    <Typography
                      title={w.webinarName}
                      sx={{
                        fontWeight: 800,
                        fontSize: '1.3rem',
                        lineHeight: 1.25,
                        letterSpacing: '-0.3px',
                        color: colors.textPrimary,
                        mb: 1.5,
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {w.webinarName}
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.4, mb: 1.8 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
                          color: '#FFFFFF',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        {host.trim().charAt(0).toUpperCase()}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography noWrap sx={{ fontWeight: 700, fontSize: '0.95rem', color: colors.textPrimary, lineHeight: 1.2 }}>
                          {host}
                        </Typography>
                        <Typography sx={{ fontSize: '0.78rem', color: colors.textSecondary }}>Host & Speaker</Typography>
                      </Box>
                    </Box>

                    {/* Info panel */}
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 1.5,
                        p: 1.6,
                        mb: 1.5,
                        borderRadius: '18px',
                        bgcolor: 'rgba(100,116,139,0.07)'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1, minWidth: 0 }}>
                        <CalendarMonthIcon sx={{ fontSize: 24, color: '#475569' }} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748B', lineHeight: 1.2 }}>Completed</Typography>
                          <Typography noWrap sx={{ fontSize: '0.86rem', fontWeight: 800, color: colors.textPrimary }}>
                            {w.webinarDate ? new Date(w.webinarDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1, minWidth: 0 }}>
                        <AccessTimeIcon sx={{ fontSize: 24, color: '#475569' }} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748B', lineHeight: 1.2 }}>Duration</Typography>
                          <Typography noWrap sx={{ fontSize: '0.86rem', fontWeight: 800, color: colors.textPrimary }}>
                            {w.durationMinutes ? `${w.durationMinutes} min` : '—'}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>

                    {/* Certificate ID */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 2 }}>
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>Certificate ID</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                        <Chip
                          label={certCode || 'VERIFIED'}
                          size="small"
                          sx={{
                            bgcolor: '#E0F2FE',
                            color: '#075985',
                            fontWeight: 800,
                            fontSize: '0.76rem',
                            height: 26,
                            borderRadius: '8px',
                            fontFamily: 'monospace',
                            maxWidth: 190
                          }}
                        />
                        {certCode && (
                          <Tooltip title="Copy ID">
                            <IconButton size="small" onClick={(e) => handleCopyId(certCode, e)} sx={{ color: '#64748B' }}>
                              <ContentCopyIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </Box>

                    {/* Actions */}
                    <Box sx={{ display: 'flex', gap: 1.2, mt: 'auto' }}>
                      <Button
                        variant="outlined"
                        startIcon={<VisibilityIcon sx={{ fontSize: 19 }} />}
                        onClick={() => handleOpenView(w)}
                        sx={{
                          flex: 1,
                          py: 1.05,
                          borderRadius: '14px',
                          textTransform: 'none',
                          fontWeight: 700,
                          color: '#1D4ED8',
                          borderColor: 'rgba(66,133,244,0.45)',
                          bgcolor: 'rgba(66,133,244,0.05)',
                          '&:hover': { bgcolor: 'rgba(66,133,244,0.12)', borderColor: '#4285F4' }
                        }}
                      >
                        View
                      </Button>
                      <Button
                        variant="contained"
                        disabled={isDownloading}
                        startIcon={
                          isDownloading ? <CircularProgress size={16} sx={{ color: '#FFFFFF' }} /> : <DownloadIcon sx={{ fontSize: 19 }} />
                        }
                        onClick={(e) => handleDownload(w, e)}
                        sx={{
                          flex: 1.3,
                          py: 1.05,
                          borderRadius: '14px',
                          textTransform: 'none',
                          fontWeight: 800,
                          color: '#FFFFFF',
                          background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
                          boxShadow: '0 8px 20px rgba(234,88,12,0.30)',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #FB923C 0%, #EA580C 100%)',
                            boxShadow: '0 12px 26px rgba(234,88,12,0.42)'
                          },
                          '&.Mui-disabled': { color: '#FFFFFF', opacity: 0.7 }
                        }}
                      >
                        {isDownloading ? 'Downloading...' : 'Download'}
                      </Button>
                    </Box>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        )}
      </Box>

      {/* ── Interactive View / Preview Modal (Google-style gradient + blur) ── */}
      <Dialog
        open={Boolean(viewDialogWebinar)}
        onClose={handleCloseView}
        maxWidth={false}
        fullWidth
        // Blurred, tinted backdrop
        BackdropProps={{
          sx: {
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            background:
              'radial-gradient(circle at 15% 20%, rgba(66,133,244,0.35) 0%, transparent 45%), radial-gradient(circle at 85% 80%, rgba(242,183,5,0.30) 0%, transparent 45%), rgba(15,23,42,0.55)'
          }
        }}
        // Styled via the Dialog's own sx + !important so MUI's default paper styles
        // (auto height, scrollbars, square corners) can never override it.
        sx={{
          '& .MuiDialog-paper': {
            position: 'relative !important',
            width: 'min(94vw, 1500px) !important',
            maxWidth: 'none !important',
            height: isMobile ? 'auto !important' : '92vh !important',
            maxHeight: '92vh !important',
            margin: '0 !important',
            display: 'flex !important',
            flexDirection: 'column !important',
            borderRadius: '28px !important',
            overflow: 'hidden !important',
            // Gradient border (blue → yellow → light blue)
            border: '2.5px solid transparent !important',
            background: `linear-gradient(${colors.surface || '#FFFFFF'}, ${colors.surface || '#FFFFFF'}) padding-box, linear-gradient(135deg, #4285F4 0%, #38BDF8 30%, #FDE047 65%, #F2B705 100%) border-box !important`,
            boxShadow:
              '0 30px 80px rgba(15,23,42,0.45), 0 0 60px rgba(66,133,244,0.25), 0 0 80px rgba(242,183,5,0.18) !important'
          }
        }}
      >
        {/* Blurred blue glow orbs in the four corners */}
        <Box
          sx={{
            position: 'absolute',
            top: -90,
            left: -90,
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(66,133,244,0.65) 0%, rgba(66,133,244,0) 70%)',
            filter: 'blur(40px)',
            pointerEvents: 'none',
            zIndex: 0
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: -70,
            right: -70,
            width: 260,
            height: 260,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(56,189,248,0.55) 0%, rgba(56,189,248,0) 70%)',
            filter: 'blur(40px)',
            pointerEvents: 'none',
            zIndex: 0
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: -100,
            left: -80,
            width: 320,
            height: 320,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(66,133,244,0.45) 0%, rgba(66,133,244,0) 70%)',
            filter: 'blur(50px)',
            pointerEvents: 'none',
            zIndex: 0
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: -90,
            right: -90,
            width: 320,
            height: 320,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(66,133,244,0.55) 0%, rgba(66,133,244,0) 70%)',
            filter: 'blur(50px)',
            pointerEvents: 'none',
            zIndex: 0
          }}
        />

        {/* ── Header: yellow gradient (same family as the Download button) ── */}
        <DialogTitle
          component="div"
          sx={{
            position: 'relative',
            zIndex: 2,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            py: 1,
            px: { xs: 2, sm: 3 },
            color: '#172338',
            background:
              'radial-gradient(circle at 12% 0%, rgba(255,255,255,0.55) 0%, transparent 45%), radial-gradient(circle at 100% 100%, rgba(66,133,244,0.35) 0%, transparent 50%), linear-gradient(110deg, #FDE047 0%, #F2B705 55%, #F59E0B 100%)',
            borderBottom: '1px solid rgba(255,255,255,0.55)',
            boxShadow: '0 8px 24px rgba(242,183,5,0.35)'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(255,255,255,0.45)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.7)',
                boxShadow: '0 6px 16px rgba(23,35,56,0.18)'
              }}
            >
              <WorkspacePremiumIcon sx={{ color: '#172338', fontSize: 23 }} />
            </Box>
            <Box>
              <Typography
                variant="subtitle1"
                sx={{ color: '#172338', fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.3px', fontSize: '1.02rem' }}
              >
                Certificate of Completion
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: 'rgba(23,35,56,0.78)', fontWeight: 600, fontSize: '0.78rem', mt: 0 }}
              >
                {viewDialogWebinar?.webinarName}
              </Typography>
            </Box>
          </Box>

          <IconButton
            onClick={handleCloseView}
            size="small"
            sx={{
              color: '#172338',
              bgcolor: 'rgba(255,255,255,0.45)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.7)',
              transition: 'all 0.2s ease',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.8)', transform: 'rotate(90deg)' }
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        {/* ── Content: soft Google-style gradient with blurred color washes ── */}
        <DialogContent
          sx={{
            position: 'relative',
            zIndex: 1,
            flex: 1,
            minHeight: 0,
            p: { xs: 1, sm: 1.5 },
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background:
              'radial-gradient(circle at 0% 0%, rgba(66,133,244,0.22) 0%, transparent 40%), radial-gradient(circle at 100% 0%, rgba(56,189,248,0.18) 0%, transparent 38%), radial-gradient(circle at 100% 100%, rgba(66,133,244,0.22) 0%, transparent 40%), radial-gradient(circle at 0% 100%, rgba(253,224,71,0.20) 0%, transparent 40%), linear-gradient(135deg, rgba(66,133,244,0.06) 0%, rgba(255,255,255,0) 50%, rgba(242,183,5,0.10) 100%)'
          }}
        >
          {previewLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <CircularProgress size={48} thickness={4} sx={{ color: '#4285F4' }} />
              <Typography variant="body2" sx={{ color: colors.textPrimary, fontWeight: 700 }}>
                Rendering official vector PDF certificate...
              </Typography>
            </Box>
          ) : isMobile ? (
            <Box
              sx={{
                textAlign: 'center',
                px: 2.5,
                py: 5,
                maxWidth: 360,
                borderRadius: '18px',
                bgcolor: 'rgba(255,255,255,0.75)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(66,133,244,0.3)'
              }}
            >
              <WorkspacePremiumIcon sx={{ fontSize: 44, color: '#F2B705', mb: 1 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#172338', mb: 0.5 }}>
                Not portable in mobile view
              </Typography>
              <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600 }}>
                You can download and see.
              </Typography>
            </Box>
          ) : previewBlobUrl ? (
            <Box
              ref={setPreviewBox}
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}
            >
              {/* Fixed-size PDF scaled down/up to exactly fit the available space */}
              <Box
                sx={{
                  width: PDF_W * previewScale,
                  height: PDF_H * previewScale,
                  flexShrink: 0,
                  borderRadius: '14px',
                  overflow: 'hidden',
                  bgcolor: '#FFFFFF',
                  border: '2px solid transparent',
                  background:
                    'linear-gradient(#FFFFFF, #FFFFFF) padding-box, linear-gradient(135deg, rgba(66,133,244,0.85), rgba(253,224,71,0.9), rgba(56,189,248,0.85)) border-box',
                  boxShadow: '0 18px 50px rgba(15,23,42,0.28), 0 0 40px rgba(66,133,244,0.20)'
                }}
              >
                <iframe
                  src={`${previewBlobUrl}#toolbar=0&navpanes=0&scrollbar=0&view=Fit&zoom=page-fit`}
                  title="Certificate PDF Viewer"
                  scrolling="no"
                  style={{
                    width: PDF_W,
                    height: PDF_H,
                    border: 'none',
                    display: 'block',
                    overflow: 'hidden',
                    transform: `scale(${previewScale})`,
                    transformOrigin: 'top left'
                  }}
                />
              </Box>
            </Box>
          ) : (
            <Typography variant="body2" sx={{ color: colors.textPrimary, py: 8, fontWeight: 600 }}>
              Failed to display certificate preview.
            </Typography>
          )}
        </DialogContent>

        {/* ── Footer: frosted glass bar ── */}
        <DialogActions
          sx={{
            position: 'relative',
            zIndex: 2,
            flexShrink: 0,
            py: 1.1,
            px: { xs: 2, sm: 3 },
            background:
              'linear-gradient(90deg, rgba(66,133,244,0.10) 0%, rgba(255,255,255,0.65) 50%, rgba(242,183,5,0.16) 100%)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            borderTop: '1px solid rgba(66,133,244,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 1.5
          }}
        >
          <Button
            variant="outlined"
            onClick={handleCloseView}
            sx={{
              borderRadius: '12px',
              color: '#1D4ED8',
              borderColor: 'rgba(66,133,244,0.55)',
              bgcolor: 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(6px)',
              textTransform: 'none',
              fontWeight: 700,
              px: 3,
              '&:hover': { bgcolor: 'rgba(66,133,244,0.12)', borderColor: '#4285F4' }
            }}
          >
            Close
          </Button>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={() => handleDownload(viewDialogWebinar)}
            sx={{
              borderRadius: '12px',
              background: 'linear-gradient(110deg, #FDE047 0%, #F2B705 60%, #F59E0B 100%)',
              color: '#172338',
              fontWeight: 800,
              textTransform: 'none',
              px: 3.5,
              boxShadow: '0 8px 22px rgba(242,183,5,0.45), 0 0 0 1px rgba(255,255,255,0.5) inset',
              '&:hover': {
                background: 'linear-gradient(110deg, #FACC15 0%, #EAB308 60%, #D97706 100%)',
                boxShadow: '0 10px 28px rgba(242,183,5,0.55)'
              }
            }}
          >
            Download PDF
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}