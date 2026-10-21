// import { useState, useEffect, useRef } from "react";
// import { useNavigate, Link, useSearchParams } from "react-router-dom";
// import {
//   Box, Typography, TextField, Button,
//   Paper, InputAdornment, Container, IconButton, Divider, Chip, Radio, RadioGroup, FormControlLabel,
//   Dialog, DialogContent, DialogActions, CircularProgress
// } from "@mui/material";
// import {
//   Mail, Lock, Eye, EyeOff, User, Phone,
//   Calendar, Clock, Users, ShieldCheck, CheckCircle2, CreditCard, ArrowLeft, Sparkles, Check, ExternalLink
// } from "lucide-react";
// import toast from "react-hot-toast";
// import { PhoneInput } from "react-international-phone";
// import "react-international-phone/style.css";
// import { authService, webinarService } from "../services/api";
// import { validateEmail, validatePassword } from "../utils/validation";
// import { useAppTheme } from "../context/ThemeContext";
// import logo from "../assets/logo1.png";

// const formatDate = (d) => {
//   if (!d) return "—";
//   try {
//     return new Date(d).toLocaleDateString("en-US", {
//       weekday: "short",
//       year: "numeric",
//       month: "short",
//       day: "numeric",
//     });
//   } catch {
//     return d;
//   }
// };

// const formatTime = (t) => {
//   if (!t) return "—";
//   try {
//     return new Date(t).toLocaleTimeString("en-US", {
//       hour: "numeric",
//       minute: "2-digit",
//       hour12: true,
//     });
//   } catch {
//     return t;
//   }
// };

// const WebinarRegistration = ({ mode }) => {
//   const themeContext = useAppTheme?.();
//   const isDark = mode ? mode === "dark" : themeContext?.isDark ?? false;
//   const navigate = useNavigate();
//   const [searchParams] = useSearchParams();
//   const trackingId = searchParams.get("trackingId");

//   const [webinarInfo, setWebinarInfo]   = useState(null);

//   // Sub-steps: "enter_email" | "existing_user_confirm" | "new_user" | "payment"
//   const [webinarStep, setWebinarStep]   = useState("enter_email");
//   const [existingUser, setExistingUser] = useState(null); // { userId, firstName, lastName, email }
//   const [pendingUser, setPendingUser]   = useState(null); // User registered or selected for registration
//   const [checkingEmail, setCheckingEmail] = useState(false);

//   // Payment
//   const [paymentMethod, setPaymentMethod] = useState("upi");
//   const [paying, setPaying]             = useState(false);

//   // Success Popup Modal
//   const [showSuccessModal, setShowSuccessModal] = useState(false);
//   const [countdown, setCountdown]               = useState(5);
//   const countdownIntervalRef                    = useRef(null);

//   // Form State
//   const [formData, setFormData] = useState({
//     firstName: "",
//     lastName: "",
//     email: "",
//     password: "",
//     countryCode: "+1",
//     mobileNumber: ""
//   });

//   const [showPassword, setShowPassword] = useState(false);
//   const [loading, setLoading]           = useState(false);
//   const [error, setError]               = useState("");

//   const applicationUrl = `${window.location.origin}/dashboard`;

//   // Fetch webinar details
//   useEffect(() => {
//     if (trackingId) {
//       webinarService.getPublic(trackingId).then(res => {
//         if (res.data?.success) setWebinarInfo(res.data.data);
//       }).catch(() => {});
//     }
//   }, [trackingId]);

//   // Countdown timer for success popup
//   useEffect(() => {
//     if (showSuccessModal) {
//       setCountdown(5);
//       countdownIntervalRef.current = setInterval(() => {
//         setCountdown((prev) => {
//           if (prev <= 1) {
//             clearInterval(countdownIntervalRef.current);
//             navigate("/dashboard");
//             return 0;
//           }
//           return prev - 1;
//         });
//       }, 1000);

//       return () => {
//         if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
//       };
//     }
//   }, [showSuccessModal, navigate]);

//   const handleCloseSuccessModal = () => {
//     if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
//     setShowSuccessModal(false);
//     navigate("/dashboard");
//   };

//   const handleChange = (e) => {
//     const { name, value } = e.target;
//     setFormData(prev => ({ ...prev, [name]: value }));
//     setError("");
//   };

//   const handlePhoneChange = (phone) => {
//     setFormData(prev => ({
//       ...prev,
//       mobileNumber: phone.replaceAll(/[^0-9+]/g, '')
//     }));
//   };

//   // ── Step 1: Check Email ─────────────────────────────────
//   const handleCheckEmail = async (e) => {
//     e.preventDefault();
//     setError("");

//     const emailValidation = validateEmail(formData.email);
//     if (!emailValidation.isValid) {
//       setError(emailValidation.error);
//       return;
//     }

//     setCheckingEmail(true);
//     try {
//       const res = await webinarService.checkEmail(formData.email.trim());
//       if (res.data?.success && res.data.data?.exists) {
//         // Existing user found in wms.Users!
//         const existing = res.data.data;
//         setExistingUser(existing);
//         setPendingUser({
//           id: existing.userId,
//           firstName: existing.firstName,
//           email: existing.email || formData.email
//         });

//         // NEVER ask for password again if user already exists
//         if (webinarInfo?.isPaid) {
//           setWebinarStep("payment"); // Direct to payment screen
//         } else {
//           setWebinarStep("existing_user_confirm"); // Direct to 1-click confirmation
//         }
//       } else {
//         // New user
//         setExistingUser(null);
//         setWebinarStep("new_user");
//       }
//     } catch {
//       setError("Failed to verify email. Please try again.");
//     } finally {
//       setCheckingEmail(false);
//     }
//   };

//   // ── Step 2A: Confirm Free Registration (Existing User - No Password Needed) ─
//   const handleConfirmFreeRegistration = async () => {
//     setLoading(true);
//     setError("");
//     try {
//       const userId = existingUser?.userId || existingUser?.id || pendingUser?.id;
//       if (!userId) {
//         setError("User identity could not be verified. Please re-enter your email.");
//         setLoading(false);
//         return;
//       }
//       const regRes = await webinarService.registerTracking(trackingId, userId);
//       if (regRes.data?.success) {
//         setShowSuccessModal(true);
//       } else {
//         setError(regRes.data?.message || "Registration failed. Please try again.");
//       }
//     } catch (err) {
//       setError(err.response?.data?.message || "Registration failed. Please try again.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ── Step 2B: Create Account (New User) ──────────────────
//   const handleNewUserSubmit = async (e) => {
//     e.preventDefault();
//     setError("");

//     const passwordValidation = validatePassword(formData.password);
//     if (!passwordValidation.isValid) {
//       setError(passwordValidation.error);
//       return;
//     }

//     if (!formData.firstName.trim()) {
//       setError("First name is required");
//       return;
//     }

//     let countryCode = "";
//     let mobileNumber = "";

//     if (formData.mobileNumber) {
//       const phoneMatch = formData.mobileNumber.match(/^\+(\d{1,3})(\d+)$/);
//       if (phoneMatch) {
//         countryCode = `+${phoneMatch[1]}`;
//         mobileNumber = phoneMatch[2];
//       } else {
//         mobileNumber = formData.mobileNumber;
//       }
//     }

//     setLoading(true);
//     try {
//       const response = await authService.register(
//         formData.firstName,
//         formData.lastName,
//         formData.email,
//         formData.password,
//         countryCode,
//         mobileNumber
//       );

//       if (response.data.success) {
//         const user = response.data.user;
//         localStorage.setItem("token", response.data.token);
//         localStorage.setItem("user", JSON.stringify(user));
//         localStorage.setItem("firstName", user.firstName);

//         if (webinarInfo?.isPaid) {
//           setPendingUser(user);
//           setWebinarStep("payment");
//         } else {
//           // Free webinar -> register immediately
//           await webinarService.registerTracking(trackingId, user.id);
//           setShowSuccessModal(true);
//         }
//       } else {
//         setError(response.data.message || "Registration failed");
//       }
//     } catch (err) {
//       setError(err.response?.data?.message || "An error occurred during registration");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ── Step 3: Complete Payment (Paid Webinar) ─────────────
//   const handleCompletePayment = async () => {
//     setPaying(true);
//     try {
//       const currentUserId = pendingUser?.id || existingUser?.userId || existingUser?.id;
//       if (!currentUserId) {
//         toast.error("Could not determine user account. Please re-enter your email.");
//         setPaying(false);
//         return;
//       }
//       const regRes = await webinarService.registerTracking(trackingId, currentUserId);
//       if (regRes.data?.success) {
//         setShowSuccessModal(true);
//       } else {
//         toast.error(regRes.data?.message || "Payment verification failed.");
//       }
//     } catch (err) {
//       toast.error(err.response?.data?.message || "Error processing payment.");
//     } finally {
//       setPaying(false);
//     }
//   };

//   const dynamicInputStyle = {
//     "& .MuiOutlinedInput-root": {
//       color: isDark ? "#ffffff" : "#0f172a",
//       backgroundColor: isDark ? "rgba(15, 23, 42, 0.4)" : "rgba(241, 245, 249, 0.6)",
//       "& fieldset": { borderColor: isDark ? "rgba(59, 130, 246, 0.2)" : "rgba(59, 130, 246, 0.15)", borderRadius: "8px" },
//       "&:hover fieldset": { borderColor: isDark ? "rgba(59, 130, 246, 0.45)" : "rgba(59, 130, 246, 0.3)" },
//       "&.Mui-focused fieldset": { borderColor: "#3b82f6", borderRadius: "8px" },
//       "& .MuiInputBase-input": { py: 1.75 }
//     },
//     "& .MuiInputBase-input::placeholder": { color: isDark ? "#64748b" : "#94a3b8", opacity: 1 },
//   };

//   return (
//     <Box sx={{
//       minHeight: "100vh",
//       display: "flex",
//       bgcolor: isDark ? "#0d0f14" : "#f1f5f9",
//       position: "relative",
//       py: 4,
//       backgroundImage: isDark
//         ? `radial-gradient(at 0% 0%, rgba(59, 130, 246, 0.12) 0px, transparent 50%),
//            radial-gradient(at 100% 100%, rgba(37, 99, 235, 0.1) 0px, transparent 50%)`
//         : `radial-gradient(at 0% 0%, rgba(59, 130, 246, 0.08) 0px, transparent 50%),
//            radial-gradient(at 100% 100%, rgba(37, 99, 235, 0.05) 0px, transparent 50%)`
//     }}>

//       <Container maxWidth="sm" sx={{ display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1, my: "auto" }}>
//         <Paper elevation={0} sx={{
//           p: { xs: 3, sm: 4.5 },
//           width: "100%",
//           maxWidth: 520,
//           bgcolor: isDark ? "rgba(19, 22, 32, 0.75)" : "rgba(255, 255, 255, 0.88)",
//           backdropFilter: "blur(20px)",
//           border: isDark ? "1px solid rgba(59, 130, 246, 0.2)" : "1px solid rgba(59, 130, 246, 0.15)",
//           borderRadius: 3.5,
//           boxShadow: isDark ? "0 20px 50px rgba(0, 0, 0, 0.5)" : "0 20px 50px rgba(59, 130, 246, 0.1)",
//           textAlign: "center"
//         }}>

//           {/* Logo */}
//           <Box sx={{ mb: 3, display: "flex", justifyContent: "center" }}>
//             <img
//               src={logo}
//               alt="Logo"
//               style={{
//                 height: "100px",
//                 objectFit: "contain",
//                 filter: isDark ? "drop-shadow(0 4px 12px rgba(59, 130, 246, 0.15))" : "none"
//               }}
//             />
//           </Box>

//           {/* ══════════════════════════════════════════════════
//               WEBINAR HIGHLIGHTED DETAILS CARD (Line-by-line)
//           ══════════════════════════════════════════════════ */}
//           {webinarInfo && (
//             <Box sx={{
//               mb: 3,
//               p: 2.5,
//               borderRadius: 3,
//               bgcolor: isDark ? "rgba(15, 23, 42, 0.65)" : "#ffffff",
//               border: isDark ? "1px solid rgba(99, 102, 241, 0.3)" : "1px solid rgba(99, 102, 241, 0.2)",
//               boxShadow: isDark ? "0 8px 25px rgba(0,0,0,0.35)" : "0 8px 25px rgba(99, 102, 241, 0.08)",
//               textAlign: "left"
//             }}>
//               {/* Line 1: Webinar Title */}
//               <Typography sx={{
//                 fontSize: "18px",
//                 fontWeight: 800,
//                 color: isDark ? "#ffffff" : "#0f172a",
//                 mb: 1.25,
//                 lineHeight: 1.3
//               }}>
//                 {webinarInfo.webinarName}
//               </Typography>

//               {/* Line 2: Webinar Type & Category Badges */}
//               <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, mb: 1.5 }}>
//                 {webinarInfo.isPaid ? (
//                   <Chip
//                     label={`PAID WEBINAR • ₹${webinarInfo.price}`}
//                     sx={{
//                       fontWeight: 800,
//                       fontSize: "11.5px",
//                       letterSpacing: "0.5px",
//                       bgcolor: "rgba(245, 158, 11, 0.15)",
//                       color: "#d97706",
//                       border: "1px solid rgba(245, 158, 11, 0.35)",
//                       height: 26,
//                       px: 0.5
//                     }}
//                   />
//                 ) : (
//                   <Chip
//                     label="100% FREE WEBINAR"
//                     sx={{
//                       fontWeight: 800,
//                       fontSize: "11.5px",
//                       letterSpacing: "0.5px",
//                       bgcolor: "rgba(34, 197, 94, 0.15)",
//                       color: "#16a34a",
//                       border: "1px solid rgba(34, 197, 94, 0.35)",
//                       height: 26,
//                       px: 0.5
//                     }}
//                   />
//                 )}
//                 {webinarInfo.categoryName && (
//                   <Chip
//                     label={webinarInfo.categoryName}
//                     sx={{
//                       fontWeight: 600,
//                       fontSize: "11.5px",
//                       bgcolor: isDark ? "rgba(99, 102, 241, 0.15)" : "rgba(99, 102, 241, 0.08)",
//                       color: "#6366f1",
//                       border: "1px solid rgba(99, 102, 241, 0.25)",
//                       height: 26
//                     }}
//                   />
//                 )}
//               </Box>

//               <Divider sx={{ my: 1.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0" }} />

//               {/* Line 3: Date */}
//               <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, py: 0.6 }}>
//                 <Box sx={{ width: 26, height: 26, borderRadius: 1.5, bgcolor: isDark ? "rgba(59,130,246,0.15)" : "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
//                   <Calendar size={14} color="#3b82f6" />
//                 </Box>
//                 <Box>
//                   <Typography sx={{ fontSize: "10.5px", fontWeight: 700, color: isDark ? "#94a3b8" : "#64748b", textTransform: "uppercase" }}>
//                     Date
//                   </Typography>
//                   <Typography sx={{ fontSize: "13px", fontWeight: 600, color: isDark ? "#f1f5f9" : "#1e293b" }}>
//                     {formatDate(webinarInfo.webinarDate)}
//                   </Typography>
//                 </Box>
//               </Box>

//               {/* Line 4: Time & Duration */}
//               <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, py: 0.6 }}>
//                 <Box sx={{ width: 26, height: 26, borderRadius: 1.5, bgcolor: isDark ? "rgba(168,85,247,0.15)" : "#fbf5ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
//                   <Clock size={14} color="#a855f7" />
//                 </Box>
//                 <Box>
//                   <Typography sx={{ fontSize: "10.5px", fontWeight: 700, color: isDark ? "#94a3b8" : "#64748b", textTransform: "uppercase" }}>
//                     Time & Duration
//                   </Typography>
//                   <Typography sx={{ fontSize: "13px", fontWeight: 600, color: isDark ? "#f1f5f9" : "#1e293b" }}>
//                     {formatTime(webinarInfo.webinarDate)} – {formatTime(webinarInfo.webinarEndTime || webinarInfo.webinarDate)} ({webinarInfo.durationMinutes || 60} min)
//                   </Typography>
//                 </Box>
//               </Box>

//               {/* Line 5: Speaker */}
//               <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, py: 0.6 }}>
//                 <Box sx={{ width: 26, height: 26, borderRadius: 1.5, bgcolor: isDark ? "rgba(16,185,129,0.15)" : "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center" }}>
//                   <User size={14} color="#10b981" />
//                 </Box>
//                 <Box>
//                   <Typography sx={{ fontSize: "10.5px", fontWeight: 700, color: isDark ? "#94a3b8" : "#64748b", textTransform: "uppercase" }}>
//                     Speaker / Conductor
//                   </Typography>
//                   <Typography sx={{ fontSize: "13px", fontWeight: 600, color: isDark ? "#f1f5f9" : "#1e293b" }}>
//                     {webinarInfo.conductorName || "Expert Speaker"}
//                   </Typography>
//                 </Box>
//               </Box>

//               {/* Line 6: Capacity */}
//               <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, py: 0.6 }}>
//                 <Box sx={{ width: 26, height: 26, borderRadius: 1.5, bgcolor: isDark ? "rgba(244,63,94,0.15)" : "#fff1f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
//                   <Users size={14} color="#f43f5e" />
//                 </Box>
//                 <Box>
//                   <Typography sx={{ fontSize: "10.5px", fontWeight: 700, color: isDark ? "#94a3b8" : "#64748b", textTransform: "uppercase" }}>
//                     Capacity
//                   </Typography>
//                   <Typography sx={{ fontSize: "13px", fontWeight: 600, color: isDark ? "#f1f5f9" : "#1e293b" }}>
//                     {webinarInfo.capacity ? `${webinarInfo.capacity} Seats Total` : "Unlimited Seats"}
//                   </Typography>
//                 </Box>
//               </Box>
//             </Box>
//           )}

//           {/* ══════════════════════════════════════════════════
//               SMART EMAIL-FIRST WORKFLOW
//           ══════════════════════════════════════════════════ */}

//           {/* SUB-STEP 1: ENTER EMAIL ONLY */}
//           {webinarStep === "enter_email" && (
//             <Box sx={{ textAlign: "left" }}>
//               <Typography variant="h5" sx={{ fontWeight: 800, color: isDark ? "#fff" : "#0f172a", mb: 0.5 }}>
//                 Register for Webinar
//               </Typography>
//               <Typography sx={{ fontSize: "13px", color: isDark ? "#94a3b8" : "#64748b", mb: 3 }}>
//                 Enter your email address to get started
//               </Typography>

//               <form onSubmit={handleCheckEmail}>
//                 <Box sx={{ mb: 2.5 }}>
//                   <Typography sx={{ fontSize: "12px", fontWeight: 700, color: isDark ? "#94a3b8" : "#475569", mb: 0.75, ml: 0.5, textTransform: "uppercase" }}>
//                     Email Address
//                   </Typography>
//                   <TextField
//                     fullWidth
//                     placeholder="student@example.com"
//                     type="email"
//                     name="email"
//                     value={formData.email}
//                     onChange={handleChange}
//                     autoFocus
//                     InputProps={{
//                       startAdornment: (
//                         <InputAdornment position="start" sx={{ mr: 1.5 }}>
//                           <Mail size={18} color="#3b82f6" />
//                         </InputAdornment>
//                       )
//                     }}
//                     sx={dynamicInputStyle}
//                   />
//                 </Box>

//                 {error && (
//                   <Typography sx={{ mb: 2.5, fontSize: "13px", color: "#ef4444" }}>
//                     ✕ {error}
//                   </Typography>
//                 )}

//                 <Button
//                   fullWidth
//                   variant="contained"
//                   type="submit"
//                   disabled={checkingEmail}
//                   sx={{
//                     py: 1.5,
//                     fontSize: "15px",
//                     fontWeight: 700,
//                     textTransform: "none",
//                     borderRadius: 2,
//                     bgcolor: "#3b82f6",
//                     "&:hover": { bgcolor: "#2563eb" }
//                   }}
//                 >
//                   {checkingEmail ? <CircularProgress size={20} sx={{ color: "#fff" }} /> : "Continue"}
//                 </Button>
//               </form>
//             </Box>
//           )}

//           {/* SUB-STEP 2A: EXISTING USER (1-CLICK FREE CONFIRMATION - NO PASSWORD) */}
//           {webinarStep === "existing_user_confirm" && (
//             <Box sx={{ textAlign: "left" }}>
//               <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
//                 <Typography sx={{ fontSize: "13px", color: isDark ? "#94a3b8" : "#64748b" }}>
//                   Registered account: <b>{existingUser?.email || formData.email}</b>
//                 </Typography>
//                 <Button size="small" onClick={() => { setWebinarStep("enter_email"); setError(""); }} sx={{ textTransform: "none", fontSize: "12px", p: 0 }}>
//                   Change
//                 </Button>
//               </Box>

//               <Box sx={{
//                 p: 2, mb: 2.5, borderRadius: 2.5,
//                 bgcolor: isDark ? "rgba(34,197,94,0.12)" : "#f0fdf4",
//                 border: "1px solid rgba(34,197,94,0.25)"
//               }}>
//                 <Typography sx={{ fontSize: "15px", fontWeight: 700, color: isDark ? "#86efac" : "#166534" }}>
//                   Welcome back, {existingUser?.firstName || "Student"}!
//                 </Typography>
//                 <Typography sx={{ fontSize: "12.5px", color: isDark ? "#cbd5e1" : "#15803d", mt: 0.5 }}>
//                   Your account is verified. Click below to claim your seat — no password needed!
//                 </Typography>
//               </Box>

//               {error && (
//                 <Typography sx={{ mb: 2.5, fontSize: "13px", color: "#ef4444" }}>
//                   ✕ {error}
//                 </Typography>
//               )}

//               <Button
//                 fullWidth
//                 variant="contained"
//                 onClick={handleConfirmFreeRegistration}
//                 disabled={loading}
//                 sx={{
//                   py: 1.6,
//                   fontSize: "15px",
//                   fontWeight: 700,
//                   textTransform: "none",
//                   borderRadius: 2,
//                   bgcolor: "#16a34a",
//                   "&:hover": { bgcolor: "#15803d" }
//                 }}
//               >
//                 {loading ? "Confirming..." : "Confirm Free Registration"}
//               </Button>
//             </Box>
//           )}

//           {/* SUB-STEP 2B: NEW USER (COLLECT PROFILE & CREATE ACCOUNT) */}
//           {webinarStep === "new_user" && (
//             <Box sx={{ textAlign: "left" }}>
//               <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
//                 <Typography sx={{ fontSize: "13px", color: isDark ? "#94a3b8" : "#64748b" }}>
//                   Email: <b>{formData.email}</b>
//                 </Typography>
//                 <Button size="small" onClick={() => { setWebinarStep("enter_email"); setError(""); }} sx={{ textTransform: "none", fontSize: "12px", p: 0 }}>
//                   Change
//                 </Button>
//               </Box>

//               <Box sx={{
//                 p: 1.5, mb: 2.5, borderRadius: 2,
//                 bgcolor: isDark ? "rgba(99,102,241,0.12)" : "rgba(99,102,241,0.08)",
//                 border: "1px solid rgba(99,102,241,0.25)"
//               }}>
//                 <Typography sx={{ fontSize: "13.5px", fontWeight: 700, color: isDark ? "#fff" : "#4338ca" }}>
//                   New Student Account
//                 </Typography>
//                 <Typography sx={{ fontSize: "12px", color: isDark ? "#cbd5e1" : "#6366f1", mt: 0.25 }}>
//                   Fill in your name and password to create your account and reserve your seat.
//                 </Typography>
//               </Box>

//               <form onSubmit={handleNewUserSubmit}>
//                 {/* First Name & Last Name */}
//                 <Box sx={{ display: "flex", gap: 1.5, mb: 2 }}>
//                   <Box sx={{ flex: 1 }}>
//                     <Typography sx={{ fontSize: "12px", fontWeight: 700, color: isDark ? "#94a3b8" : "#475569", mb: 0.5, textTransform: "uppercase" }}>
//                       First Name
//                     </Typography>
//                     <TextField
//                       fullWidth
//                       placeholder="John"
//                       name="firstName"
//                       value={formData.firstName}
//                       onChange={handleChange}
//                       autoFocus
//                       sx={dynamicInputStyle}
//                     />
//                   </Box>
//                   <Box sx={{ flex: 1 }}>
//                     <Typography sx={{ fontSize: "12px", fontWeight: 700, color: isDark ? "#94a3b8" : "#475569", mb: 0.5, textTransform: "uppercase" }}>
//                       Last Name
//                     </Typography>
//                     <TextField
//                       fullWidth
//                       placeholder="Doe"
//                       name="lastName"
//                       value={formData.lastName}
//                       onChange={handleChange}
//                       sx={dynamicInputStyle}
//                     />
//                   </Box>
//                 </Box>

//                 {/* Phone Number */}
//                 <Box sx={{ mb: 2 }}>
//                   <Typography sx={{ fontSize: "12px", fontWeight: 700, color: isDark ? "#94a3b8" : "#475569", mb: 0.5, textTransform: "uppercase" }}>
//                     Phone Number (Optional)
//                   </Typography>
//                   <PhoneInput
//                     defaultCountry="us"
//                     value={formData.mobileNumber}
//                     onChange={handlePhoneChange}
//                     inputProps={{
//                       style: {
//                         width: "100%",
//                         padding: "12px 14px",
//                         fontSize: "14px",
//                         color: isDark ? "#f8fafc" : "#0f172a",
//                         backgroundColor: isDark ? "rgba(15, 23, 42, 0.4)" : "rgba(241, 245, 249, 0.6)",
//                         border: isDark ? "1px solid rgba(59, 130, 246, 0.2)" : "1px solid rgba(59, 130, 246, 0.15)",
//                         borderRadius: "8px",
//                         fontFamily: "inherit",
//                         outline: "none",
//                       }
//                     }}
//                   />
//                 </Box>

//                 {/* Password */}
//                 <Box sx={{ mb: 2.5 }}>
//                   <Typography sx={{ fontSize: "12px", fontWeight: 700, color: isDark ? "#94a3b8" : "#475569", mb: 0.5, textTransform: "uppercase" }}>
//                     Create Password
//                   </Typography>
//                   <TextField
//                     fullWidth
//                     placeholder="••••••••"
//                     type={showPassword ? "text" : "password"}
//                     name="password"
//                     value={formData.password}
//                     onChange={handleChange}
//                     InputProps={{
//                       startAdornment: (
//                         <InputAdornment position="start" sx={{ mr: 1.5 }}>
//                           <Lock size={18} color="#3b82f6" />
//                         </InputAdornment>
//                       ),
//                       endAdornment: (
//                         <InputAdornment position="end">
//                           <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: isDark ? "#64748b" : "#94a3b8" }}>
//                             {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
//                           </IconButton>
//                         </InputAdornment>
//                       )
//                     }}
//                     sx={dynamicInputStyle}
//                   />
//                   <Typography sx={{ fontSize: "11px", color: isDark ? "#64748b" : "#94a3b8", mt: 0.5 }}>
//                     At least 6 characters
//                   </Typography>
//                 </Box>

//                 {error && (
//                   <Typography sx={{ mb: 2.5, fontSize: "13px", color: "#ef4444" }}>
//                     ✕ {error}
//                   </Typography>
//                 )}

//                 <Button
//                   fullWidth
//                   variant="contained"
//                   type="submit"
//                   disabled={loading}
//                   sx={{
//                     py: 1.5,
//                     fontSize: "15px",
//                     fontWeight: 700,
//                     textTransform: "none",
//                     borderRadius: 2,
//                     bgcolor: "#3b82f6",
//                     "&:hover": { bgcolor: "#2563eb" }
//                   }}
//                 >
//                   {loading ? "Creating Account..." : (webinarInfo?.isPaid ? "Continue to Payment" : "Create Account & Register")}
//                 </Button>
//               </form>
//             </Box>
//           )}

//           {/* SUB-STEP 3: PAYMENT SCREEN (PAID WEBINARS ONLY) */}
//           {webinarStep === "payment" && webinarInfo && (
//             <Box sx={{ textAlign: "left" }}>
//               <Button
//                 startIcon={<ArrowLeft size={16} />}
//                 onClick={() => setWebinarStep(existingUser ? "enter_email" : "new_user")}
//                 sx={{ mb: 2, textTransform: "none", color: isDark ? "#94a3b8" : "#64748b", px: 0 }}
//               >
//                 Back to details
//               </Button>

//               {/* Existing User Banner if verified */}
//               {existingUser && (
//                 <Box sx={{
//                   p: 1.5, mb: 2.5, borderRadius: 2,
//                   bgcolor: isDark ? "rgba(34, 197, 94, 0.12)" : "#f0fdf4",
//                   border: "1px solid rgba(34, 197, 94, 0.25)",
//                   display: "flex", alignItems: "center", justifyContent: "space-between"
//                 }}>
//                   <Box>
//                     <Typography sx={{ fontSize: "13.5px", fontWeight: 700, color: isDark ? "#86efac" : "#166534" }}>
//                       Welcome back, {existingUser.firstName || "Student"}!
//                     </Typography>
//                     <Typography sx={{ fontSize: "12px", color: isDark ? "#cbd5e1" : "#15803d" }}>
//                       Account verified ({existingUser.email || formData.email})
//                     </Typography>
//                   </Box>
//                   <Button size="small" onClick={() => { setWebinarStep("enter_email"); setError(""); }} sx={{ textTransform: "none", fontSize: "12px", p: 0 }}>
//                     Change
//                   </Button>
//                 </Box>
//               )}

//               <Typography variant="h5" sx={{ fontWeight: 800, color: isDark ? "#fff" : "#0f172a", mb: 0.5 }}>
//                 Complete Payment
//               </Typography>
//               <Typography sx={{ fontSize: "13px", color: isDark ? "#94a3b8" : "#64748b", mb: 3 }}>
//                 Final step to confirm your webinar seat
//               </Typography>

//               {/* Order Summary Card */}
//               <Box sx={{
//                 p: 2.5,
//                 borderRadius: 2.5,
//                 bgcolor: isDark ? "rgba(15, 23, 42, 0.6)" : "#f8fafc",
//                 border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e2e8f0",
//                 mb: 3
//               }}>
//                 <Typography sx={{ fontSize: "11px", fontWeight: 700, color: "#6366f1", textTransform: "uppercase" }}>
//                   Order Summary
//                 </Typography>
//                 <Typography sx={{ fontSize: "16px", fontWeight: 700, color: isDark ? "#fff" : "#0f172a", mt: 0.5 }}>
//                   {webinarInfo.webinarName}
//                 </Typography>
//                 <Typography sx={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b", mt: 0.25 }}>
//                   Speaker: {webinarInfo.conductorName}
//                 </Typography>

//                 <Divider sx={{ my: 1.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0" }} />

//                 <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
//                   <Typography sx={{ fontSize: "14px", fontWeight: 600, color: isDark ? "#cbd5e1" : "#475569" }}>
//                     Total Amount
//                   </Typography>
//                   <Typography sx={{ fontSize: "20px", fontWeight: 800, color: "#d97706" }}>
//                     ₹{webinarInfo.price}
//                   </Typography>
//                 </Box>
//               </Box>

//               {/* Payment Method Selector */}
//               <Typography sx={{ fontSize: "12px", fontWeight: 700, color: isDark ? "#94a3b8" : "#64748b", textTransform: "uppercase", mb: 1.5 }}>
//                 Select Payment Method
//               </Typography>

//               <RadioGroup value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
//                 <Paper sx={{
//                   p: 1.5, mb: 1.5, borderRadius: 2, display: "flex", alignItems: "center",
//                   bgcolor: paymentMethod === "upi" ? (isDark ? "rgba(59,130,246,0.15)" : "#eff6ff") : (isDark ? "rgba(15, 23, 42, 0.4)" : "#fff"),
//                   border: paymentMethod === "upi" ? "1.5px solid #3b82f6" : (isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e2e8f0"),
//                   cursor: "pointer"
//                 }} onClick={() => setPaymentMethod("upi")}>
//                   <FormControlLabel value="upi" control={<Radio size="small" />} label="" sx={{ m: 0, mr: 1 }} />
//                   <Sparkles size={18} color="#3b82f6" style={{ marginRight: 8 }} />
//                   <Box>
//                     <Typography sx={{ fontSize: "13.5px", fontWeight: 700, color: isDark ? "#fff" : "#0f172a" }}>
//                       UPI Instant Pay
//                     </Typography>
//                     <Typography sx={{ fontSize: "11px", color: isDark ? "#94a3b8" : "#64748b" }}>
//                       Google Pay, PhonePe, Paytm, BHIM
//                     </Typography>
//                   </Box>
//                 </Paper>

//                 <Paper sx={{
//                   p: 1.5, mb: 2.5, borderRadius: 2, display: "flex", alignItems: "center",
//                   bgcolor: paymentMethod === "card" ? (isDark ? "rgba(59,130,246,0.15)" : "#eff6ff") : (isDark ? "rgba(15, 23, 42, 0.4)" : "#fff"),
//                   border: paymentMethod === "card" ? "1.5px solid #3b82f6" : (isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e2e8f0"),
//                   cursor: "pointer"
//                 }} onClick={() => setPaymentMethod("card")}>
//                   <FormControlLabel value="card" control={<Radio size="small" />} label="" sx={{ m: 0, mr: 1 }} />
//                   <CreditCard size={18} color="#10b981" style={{ marginRight: 8 }} />
//                   <Box>
//                     <Typography sx={{ fontSize: "13.5px", fontWeight: 700, color: isDark ? "#fff" : "#0f172a" }}>
//                       Credit / Debit Card
//                     </Typography>
//                     <Typography sx={{ fontSize: "11px", color: isDark ? "#94a3b8" : "#64748b" }}>
//                       Visa, MasterCard, RuPay
//                     </Typography>
//                   </Box>
//                 </Paper>
//               </RadioGroup>

//               <Button
//                 fullWidth
//                 variant="contained"
//                 disabled={paying}
//                 onClick={handleCompletePayment}
//                 sx={{
//                   py: 1.6,
//                   fontSize: "15px",
//                   fontWeight: 700,
//                   borderRadius: 2.5,
//                   bgcolor: "#d97706",
//                   color: "#fff",
//                   "&:hover": { bgcolor: "#b45309" },
//                   textTransform: "none",
//                   boxShadow: "0 4px 15px rgba(217,119,6,0.3)"
//                 }}
//               >
//                 {paying ? "Processing Payment..." : `Pay ₹${webinarInfo.price} & Confirm Seat`}
//               </Button>

//               <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, mt: 2 }}>
//                 <ShieldCheck size={14} color="#10b981" />
//                 <Typography sx={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b" }}>
//                   Secure Checkout
//                 </Typography>
//               </Box>
//             </Box>
//           )}

//           {/* Terms */}
//           <Typography sx={{ mt: 4, fontSize: "12px", color: isDark ? "#64748b" : "#94a3b8" }}>
//             By continuing, you agree to our{" "}
//             <span style={{ color: isDark ? "#94a3b8" : "#475569", cursor: "pointer", fontWeight: 600 }}>
//               Terms of Service
//             </span>
//           </Typography>
//         </Paper>
//       </Container>

//       {/* ══════════════════════════════════════════════════
//           SUCCESS POPUP MODAL (5s auto-close + manual cancel)
//       ══════════════════════════════════════════════════ */}
//       <Dialog
//         open={showSuccessModal}
//         onClose={handleCloseSuccessModal}
//         maxWidth="xs"
//         fullWidth
//         PaperProps={{
//           sx: {
//             borderRadius: 3.5,
//             p: 1.5,
//             bgcolor: isDark ? "#131620" : "#ffffff",
//             border: isDark ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(34,197,94,0.2)",
//             boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
//             textAlign: "center"
//           }
//         }}
//       >
//         <DialogContent sx={{ pt: 3.5, pb: 2 }}>
//           {/* Animated celebration icon */}
//           <Box sx={{
//             width: 64,
//             height: 64,
//             borderRadius: "50%",
//             bgcolor: "rgba(34,197,94,0.15)",
//             border: "2px solid #22c55e",
//             display: "flex",
//             alignItems: "center",
//             justifyContent: "center",
//             mx: "auto",
//             mb: 2.5
//           }}>
//             <CheckCircle2 size={36} color="#16a34a" />
//           </Box>

//           <Typography variant="h5" sx={{ fontWeight: 800, color: isDark ? "#fff" : "#0f172a", mb: 1 }}>
//             Webinar Registered Successfully!
//           </Typography>

//           {webinarInfo && (
//             <Chip
//               label={webinarInfo.webinarName}
//               sx={{
//                 fontWeight: 700,
//                 fontSize: "13px",
//                 bgcolor: isDark ? "rgba(99,102,241,0.15)" : "#eff6ff",
//                 color: "#4f46e5",
//                 mb: 2,
//                 maxWidth: "90%"
//               }}
//             />
//           )}

//           {/* Exact required text */}
//           <Typography sx={{ fontSize: "14px", lineHeight: 1.6, color: isDark ? "#cbd5e1" : "#475569", mb: 2 }}>
//             Webinar registered success. For more details, log in to the application to check:
//           </Typography>

//           {/* Application URL box */}
//           <Box sx={{
//             p: 1.25,
//             borderRadius: 2,
//             bgcolor: isDark ? "rgba(15, 23, 42, 0.6)" : "#f1f5f9",
//             border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e2e8f0",
//             display: "flex",
//             alignItems: "center",
//             justifyContent: "center",
//             gap: 1,
//             wordBreak: "break-all"
//           }}>
//             <Typography sx={{ fontSize: "13px", fontWeight: 600, color: "#3b82f6" }}>
//               {applicationUrl}
//             </Typography>
//           </Box>

//           <Typography sx={{ fontSize: "12px", color: isDark ? "#64748b" : "#94a3b8", mt: 2 }}>
//             Auto-redirecting in <b>{countdown}s</b>...
//           </Typography>
//         </DialogContent>

//         <DialogActions sx={{ pb: 3, px: 3, display: "flex", gap: 1.5, justifyContent: "center" }}>
//           <Button
//             variant="outlined"
//             onClick={handleCloseSuccessModal}
//             sx={{
//               textTransform: "none",
//               borderRadius: 2,
//               px: 3,
//               borderColor: isDark ? "rgba(255,255,255,0.2)" : "#cbd5e1",
//               color: isDark ? "#94a3b8" : "#64748b"
//             }}
//           >
//             Cancel / Close
//           </Button>

//           <Button
//             variant="contained"
//             onClick={handleCloseSuccessModal}
//             endIcon={<ExternalLink size={16} />}
//             sx={{
//               textTransform: "none",
//               borderRadius: 2,
//               px: 3,
//               bgcolor: "#16a34a",
//               "&:hover": { bgcolor: "#15803d" },
//               fontWeight: 700
//             }}
//           >
//             Go to Dashboard
//           </Button>
//         </DialogActions>
//       </Dialog>
//     </Box>
//   );
// };

// export default WebinarRegistration;












import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Box, Typography, TextField, Button, Paper, InputAdornment, Container,
  IconButton, Divider, Radio, RadioGroup, Dialog, DialogContent,
  DialogActions, CircularProgress, Stack as MuiStack
} from "@mui/material";
import {
  Mail, Lock, Eye, EyeOff, User, Calendar, Clock, Users, ShieldCheck,
  CheckCircle2, CreditCard, ArrowLeft, ExternalLink, ArrowRight,
  Video, Check, Smartphone, Sparkles
} from "lucide-react";
import toast from "react-hot-toast";
import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";
import { authService, webinarService } from "../services/api";
import { validateEmail, validatePassword } from "../utils/validation";
import { useAppTheme } from "../context/ThemeContext";
import logo from "../assets/logo1.png";

/* Newer MUI versions ignore layout props (alignItems, justifyContent, gap, flexWrap)
   passed directly to <Stack>. This wrapper moves them into sx so they work everywhere. */
const Stack = ({ alignItems, justifyContent, flexWrap, gap, sx, ...rest }) => (
  <MuiStack sx={{ alignItems, justifyContent, flexWrap, gap, ...sx }} {...rest} />
);

/* Only two font weights are used across the whole page. */
const FW = { regular: 400, semibold: 600 };
const FONT = `"Inter", "Segoe UI", system-ui, -apple-system, sans-serif`;

const formatDate = (d) => {
  if (!d) return "Date to be announced";
  try {
    return new Date(d).toLocaleDateString("en-IN", {
      weekday: "short", day: "numeric", month: "short", year: "numeric"
    });
  } catch { return d; }
};

const formatTime = (t) => {
  if (!t) return "Time to be announced";
  try {
    return new Date(t).toLocaleTimeString("en-IN", {
      hour: "numeric", minute: "2-digit", hour12: true
    });
  } catch { return t; }
};

const WebinarRegistration = ({ mode }) => {
  const themeContext = useAppTheme?.();
  const isDark = mode ? mode === "dark" : themeContext?.isDark ?? false;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const trackingId = searchParams.get("trackingId");

  const [webinarInfo, setWebinarInfo] = useState(null);
  const [webinarStep, setWebinarStep] = useState("preview");
  const [existingUser, setExistingUser] = useState(null);
  const [pendingUser, setPendingUser] = useState(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [paying, setPaying] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const countdownIntervalRef = useRef(null);
  const [formData, setFormData] = useState({
    firstName: "", lastName: "", email: "", password: "",
    countryCode: "+1", mobileNumber: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const applicationUrl = `${window.location.origin}/dashboard`;

  useEffect(() => {
    if (!trackingId) return;
    webinarService.getPublic(trackingId)
      .then((res) => { if (res.data?.success) setWebinarInfo(res.data.data); })
      .catch(() => {});
  }, [trackingId]);

  useEffect(() => {
    if (!showSuccessModal) return;
    setCountdown(5);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          navigate("/dashboard");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [showSuccessModal, navigate]);

  const handleCloseSuccessModal = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setShowSuccessModal(false);
    navigate("/dashboard");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handlePhoneChange = (phone) => {
    setFormData((prev) => ({ ...prev, mobileNumber: phone.replaceAll(/[^0-9+]/g, "") }));
  };

  const handleCheckEmail = async (e) => {
    e.preventDefault();
    setError("");
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.isValid) return setError(emailValidation.error);

    setCheckingEmail(true);
    try {
      const res = await webinarService.checkEmail(formData.email.trim());
      if (res.data?.success && res.data.data?.exists) {
        const existing = res.data.data;
        setExistingUser(existing);
        setPendingUser({
          id: existing.userId,
          firstName: existing.firstName,
          email: existing.email || formData.email
        });
        if (webinarInfo?.isPaid) setWebinarStep("payment");
        else setWebinarStep("existing_user_confirm");
      } else {
        setExistingUser(null);
        setWebinarStep("new_user");
      }
    } catch {
      setError("We couldn't check that email. Please try again.");
    } finally {
      setCheckingEmail(false);
    }
  };

  const handleConfirmFreeRegistration = async () => {
    setLoading(true);
    setError("");
    try {
      const userId = existingUser?.userId || existingUser?.id || pendingUser?.id;
      if (!userId) {
        setError("We couldn't verify the account. Please enter your email again.");
        return;
      }
      const res = await webinarService.registerTracking(trackingId, userId);
      if (res.data?.success) setShowSuccessModal(true);
      else setError(res.data?.message || "Registration failed. Please try again.");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleNewUserSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) return setError(passwordValidation.error);
    if (!formData.firstName.trim()) return setError("First name is required");

    let countryCode = "";
    let mobileNumber = "";
    if (formData.mobileNumber) {
      const phoneMatch = formData.mobileNumber.match(/^\+(\d{1,3})(\d+)$/);
      if (phoneMatch) {
        countryCode = `+${phoneMatch[1]}`;
        mobileNumber = phoneMatch[2];
      } else mobileNumber = formData.mobileNumber;
    }

    setLoading(true);
    try {
      const response = await authService.register(
        formData.firstName, formData.lastName, formData.email,
        formData.password, countryCode, mobileNumber
      );
      if (response.data.success) {
        const user = response.data.user;
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(user));
        localStorage.setItem("firstName", user.firstName);
        if (webinarInfo?.isPaid) {
          setPendingUser(user);
          setWebinarStep("payment");
        } else {
          const reg = await webinarService.registerTracking(trackingId, user.id);
          if (reg.data?.success) setShowSuccessModal(true);
          else setError(reg.data?.message || "Account created, but registration could not be completed. Please try again.");
        }
      } else setError(response.data.message || "Registration failed");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong while creating your account.");
    } finally {
      setLoading(false);
    }
  };

  const handleCompletePayment = async () => {
    setPaying(true);
    try {
      const userId = pendingUser?.id || existingUser?.userId || existingUser?.id;
      if (!userId) {
        toast.error("We couldn't identify your account. Please start again.");
        return;
      }
      // Connect this action to the real payment gateway/order verification flow.
      const regRes = await webinarService.registerTracking(trackingId, userId);
      if (regRes.data?.success) setShowSuccessModal(true);
      else toast.error(regRes.data?.message || "Payment could not be confirmed.");
    } catch (err) {
      toast.error(err.response?.data?.message || "There was a problem processing your request.");
    } finally {
      setPaying(false);
    }
  };

  /* ---------- Design tokens ---------- */
  const colors = {
    bg: isDark ? "#14110b" : "#fef3c7",
    panel: isDark ? "#111827" : "#ffffff",
    soft: isDark ? "#1c1a14" : "#fffbeb",
    text: isDark ? "#f1f5f9" : "#1b2033",
    muted: isDark ? "#94a3b8" : "#6b7390",
    line: isDark ? "rgba(148,163,184,.18)" : "#e5e8f2",
    primary: "#d97706",
    primaryHover: "#b45309",
    green: "#12a174",
    danger: "#e5484d"
  };

  const fieldSx = {
    "& .MuiOutlinedInput-root": {
      borderRadius: "12px", color: colors.text, fontFamily: FONT,
      backgroundColor: isDark ? "rgba(255,255,255,.04)" : "#fff",
      transition: "box-shadow .2s, border-color .2s",
      "& fieldset": { borderColor: colors.line },
      "&:hover fieldset": { borderColor: isDark ? "#52637f" : "#c4c9e2" },
      "&.Mui-focused": { boxShadow: "0 0 0 4px rgba(217,119,6,.15)" },
      "&.Mui-focused fieldset": { borderColor: colors.primary, borderWidth: "1px" },
      "& input": { py: 1.6, fontSize: 14.5, fontWeight: FW.regular }
    },
    "& .MuiInputBase-input::placeholder": { color: colors.muted, opacity: .8 }
  };

  const primaryButtonSx = {
    py: 1.55, borderRadius: "12px", textTransform: "none", fontFamily: FONT,
    fontSize: 15, fontWeight: FW.semibold, letterSpacing: 0, color: "#fff",
    background: colors.primary, boxShadow: "0 8px 20px rgba(217,119,6,.28)",
    "&:hover": { background: colors.primaryHover, boxShadow: "0 10px 24px rgba(217,119,6,.36)" },
    "&.Mui-disabled": { color: "#fff", opacity: .6, background: colors.primary }
  };

  const labelSx = {
    fontSize: 13, fontWeight: FW.semibold, color: colors.text, mb: .9
  };

  const ghostButtonSx = {
    textTransform: "none", fontFamily: FONT, fontSize: 13,
    fontWeight: FW.semibold, color: colors.muted,
    "&:hover": { bgcolor: "transparent", color: colors.primary }
  };

  const info = webinarInfo || {};
  const amount = Number(info.price || 0).toLocaleString("en-IN");

  const stepTitle = {
    enter_email: "Save your seat",
    existing_user_confirm: "Welcome back",
    new_user: "Create your account",
    payment: "Complete your payment"
  }[webinarStep];

  const stepSubtitle = {
    enter_email: "Enter your email to get started. It only takes a minute.",
    existing_user_confirm: "We found your account. Confirm to reserve your seat.",
    new_user: "Set up your account once and you're ready to learn.",
    payment: "Review your order and choose how you'd like to pay."
  }[webinarStep];

  const details = [
    { icon: Calendar, label: "Date", value: formatDate(info.webinarDate) },
    { icon: Clock, label: "Time & duration", value: `${formatTime(info.webinarDate)} · ${info.durationMinutes || 60} min` },
    { icon: User, label: "Speaker", value: info.conductorName || "Expert speaker" },
    { icon: Users, label: "Seats", value: info.capacity ? `${info.capacity} seats total` : "Open registration" }
  ];

  const stepLabels = ["Account", info.isPaid ? "Payment" : "Confirm"];
  const activeStep = webinarStep === "payment" || webinarStep === "existing_user_confirm" ? 1 : 0;

  return (
    <Box sx={{
      minHeight: "100svh", height: { md: "100svh" }, width: "100%",
      overflowX: "hidden", overflowY: { xs: "auto", md: "hidden" }, boxSizing: "border-box",
      bgcolor: colors.bg, color: colors.text, fontFamily: FONT,
      "& *": { fontFamily: `${FONT} !important` },
      backgroundImage: isDark
        ? "radial-gradient(ellipse at 10% 0%, rgba(217,119,6,.18), transparent 40%), radial-gradient(ellipse at 100% 100%, rgba(217,119,6,.08), transparent 36%)"
        : "radial-gradient(ellipse at 8% 0%, rgba(217,119,6,.10), transparent 38%), radial-gradient(ellipse at 100% 100%, rgba(18,161,116,.07), transparent 36%)",
      py: { xs: 2, sm: 3, md: 2.5 }, px: { xs: 1.5, sm: 3 },
      display: "flex", alignItems: "center"
    }}>
      <Container maxWidth="lg" disableGutters sx={{ height: { md: "100%" }, maxHeight: { md: 860 } }}>
        <Paper elevation={0} sx={{
          overflow: "hidden", borderRadius: { xs: "20px", md: "28px" },
          height: { md: "100%" }, display: "flex", flexDirection: "column",
          border: `1px solid ${colors.line}`, bgcolor: colors.panel,
          boxShadow: isDark ? "0 30px 80px rgba(0,0,0,.35)" : "0 24px 70px rgba(40,50,100,.10)"
        }}>
          {/* Brand bar */}
          <Box sx={{
            px: { xs: 2.5, sm: 4, lg: 5 }, py: 2,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderBottom: `1px solid ${colors.line}`
          }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box sx={{ width: 40, height: 40, borderRadius: "12px", bgcolor: "#fff", border: `1px solid ${colors.line}`, display: "grid", placeItems: "center" }}>
                <img src={logo} alt="ProDesX" style={{ width: "80%", height: "80%", objectFit: "contain" }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 16, fontWeight: FW.semibold, lineHeight: 1.2 }}>ProDesX</Typography>
                <Typography sx={{ fontSize: 12, color: colors.muted, fontWeight: FW.regular }}>Learn something extraordinary</Typography>
              </Box>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={.8} sx={{ color: colors.green, display: { xs: "none", sm: "flex" } }}>
              <ShieldCheck size={16} />
              <Typography sx={{ fontSize: 13, fontWeight: FW.regular, color: colors.muted }}>Secure registration</Typography>
            </Stack>
          </Box>

          <Box sx={{
            display: "grid", flex: 1, minHeight: 0,
            gridTemplateColumns: { xs: "minmax(0,1fr)", md: "minmax(0,5fr) minmax(0,6fr)" }
          }}>
            {/* ---------- Left: webinar info ---------- */}
            <Box sx={{
              p: { xs: 3, sm: 4, lg: 5 }, color: "#fff", position: "relative", overflow: "hidden",
              background: "linear-gradient(160deg, #d97706 0%, #c26a05 100%)",
              display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 3,
              "& .MuiTypography-root": { color: "#fff" }
            }}>
              <Box sx={{ position: "absolute", width: 320, height: 320, borderRadius: "50%", top: -140, right: -120, background: "rgba(255,255,255,.07)", pointerEvents: "none" }} />
              <Box sx={{ position: "absolute", width: 220, height: 220, borderRadius: "50%", bottom: -100, left: -80, background: "rgba(255,255,255,.05)", pointerEvents: "none" }} />

              <Box sx={{ position: "relative" }}>
                <Stack direction="row" alignItems="center" spacing={.8} sx={{
                  display: "inline-flex", px: 1.5, py: .6, mb: 2.5, borderRadius: "999px",
                  bgcolor: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.2)"
                }}>
                  <Sparkles size={13} />
                  <Typography sx={{ fontSize: 12, fontWeight: FW.semibold }}>Live webinar</Typography>
                </Stack>

                <Typography sx={{
                  fontSize: { xs: 30, sm: 36, lg: 40 }, fontWeight: FW.semibold,
                  lineHeight: 1.15, letterSpacing: "-.02em", overflowWrap: "anywhere"
                }}>
                  Title - {info.webinarName || "Your next big idea starts here."}
                </Typography>

                <Typography sx={{ mt: 2, fontSize: 15, lineHeight: 1.7, fontWeight: FW.regular, color: "rgba(255,255,255,.8)", maxWidth: 420 }}>
                  Learn from experienced speakers, explore fresh ideas, and take your next step with a community of curious learners.
                </Typography>

                <Stack direction="row" useFlexGap flexWrap="wrap" gap={1} sx={{ mt: 3 }}>
                  <Box sx={{ px: 1.75, py: .7, borderRadius: "999px", bgcolor: "#fef3c7", color: "#92400e", fontSize: 13, fontWeight: FW.semibold }}>
                    {info.isPaid ? `₹${amount} per seat` : "Free to attend"}
                  </Box>
                  {info.categoryName && (
                    <Box sx={{ px: 1.75, py: .7, borderRadius: "999px", border: "1px solid rgba(255,255,255,.35)", fontSize: 13, fontWeight: FW.regular }}>
                      {info.categoryName}
                    </Box>
                  )}
                </Stack>
              </Box>

              {/* Details list */}
              <Box sx={{
                position: "relative", borderRadius: "18px", overflow: "hidden",
                bgcolor: "rgba(255,255,255,.10)", border: "1px solid rgba(255,255,255,.16)",
                backdropFilter: "blur(6px)"
              }}>
                {details.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <Box key={item.label} sx={{
                      display: "flex", alignItems: "center", gap: 1.75, px: 2.25, py: 1.35,
                      borderTop: i === 0 ? 0 : "1px solid rgba(255,255,255,.12)"
                    }}>
                      <Box sx={{ width: 36, height: 36, borderRadius: "10px", bgcolor: "rgba(255,255,255,.16)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                        <Icon size={17} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: 12, fontWeight: FW.regular, color: "rgba(255,255,255,.7)" }}>{item.label}</Typography>
                        <Typography sx={{ fontSize: 14.5, fontWeight: FW.semibold, overflowWrap: "anywhere" }}>{item.value}</Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>

            {/* ---------- Right: form ---------- */}
            <Box sx={{
              p: { xs: 3, sm: 4, lg: 5 }, display: "flex", flexDirection: "column",
              minHeight: 0, overflowY: "auto"
            }}>
              {/* my:auto centres vertically but never clips the top when content is taller */}
              <Box sx={{ maxWidth: 440, width: "100%", mx: "auto", my: "auto" }}>
                {webinarStep === "preview" && (
                  <Stack spacing={3}>
                    <Box sx={{ width: 52, height: 52, borderRadius: "16px", display: "grid", placeItems: "center", color: colors.primary, bgcolor: isDark ? "rgba(217,119,6,.16)" : "#fef3c7" }}>
                      <Video size={24} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: { xs: 28, sm: 32 }, fontWeight: FW.semibold, letterSpacing: "-.02em", lineHeight: 1.2 }}>
                        Ready to join?
                      </Typography>
                      <Typography sx={{ mt: 1.5, fontSize: 15, lineHeight: 1.7, color: colors.muted }}>
                        Reserve your spot in this live session, learn directly from the speaker, and get your joining details by email.
                      </Typography>
                    </Box>
                    <Stack spacing={1.5}>
                      {[
                        "Live and interactive Q&A with the speaker",
                        "Joining details sent right after registration",
                        info.isPaid ? `One-time fee of ₹${amount}, no hidden charges` : "Completely free to attend"
                      ].map((text) => (
                        <Stack key={text} direction="row" spacing={1.25} alignItems="center">
                          <Box sx={{ color: colors.green, display: "flex" }}><CheckCircle2 size={18} /></Box>
                          <Typography sx={{ fontSize: 14, color: colors.text }}>{text}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                    <Button fullWidth onClick={() => setWebinarStep("enter_email")} endIcon={<ArrowRight size={18} />} sx={primaryButtonSx}>
                      Register for webinar
                    </Button>
                  </Stack>
                )}

                {webinarStep !== "preview" && (
                  <>
                    {/* Step indicator */}
                    <Stack direction="row" spacing={1.5} sx={{ mb: 2.5 }}>
                      {stepLabels.map((label, index) => {
                        const done = index < activeStep;
                        const current = index === activeStep;
                        return (
                          <Box key={label} sx={{ flex: 1 }}>
                            <Box sx={{ height: 4, borderRadius: 4, bgcolor: done || current ? colors.primary : colors.line, mb: 1 }} />
                            <Stack direction="row" spacing={.75} alignItems="center">
                              {done && <Check size={13} color={colors.primary} />}
                              <Typography sx={{ fontSize: 12.5, fontWeight: current ? FW.semibold : FW.regular, color: current || done ? colors.text : colors.muted }}>
                                {index + 1}. {label}
                              </Typography>
                            </Stack>
                          </Box>
                        );
                      })}
                    </Stack>

                    <Typography sx={{ fontSize: { xs: 26, sm: 30 }, fontWeight: FW.semibold, letterSpacing: "-.02em", lineHeight: 1.2 }}>
                      {stepTitle}
                    </Typography>
                    <Typography sx={{ mt: .75, mb: 2.5, fontSize: 14, lineHeight: 1.6, color: colors.muted }}>
                      {stepSubtitle}
                    </Typography>

                    {/* Email step */}
                    {webinarStep === "enter_email" && (
                      <Box component="form" onSubmit={handleCheckEmail}>
                        <Typography sx={labelSx}>Email address</Typography>
                        <TextField
                          fullWidth type="email" name="email" autoComplete="email"
                          placeholder="you@example.com" value={formData.email}
                          onChange={handleChange} autoFocus sx={fieldSx}
                          InputProps={{ startAdornment: <InputAdornment position="start"><Mail size={18} color={colors.muted} /></InputAdornment> }}
                        />
                        {error && <Typography role="alert" sx={{ mt: 1.25, color: colors.danger, fontSize: 13 }}>{error}</Typography>}
                        <Button fullWidth type="submit" disabled={checkingEmail} endIcon={!checkingEmail && <ArrowRight size={18} />} sx={{ ...primaryButtonSx, mt: 3 }}>
                          {checkingEmail ? <CircularProgress size={22} sx={{ color: "#fff" }} /> : "Continue"}
                        </Button>
                        <Stack direction="row" alignItems="center" justifyContent="center" spacing={.8} sx={{ mt: 2.5, color: colors.muted }}>
                          <ShieldCheck size={14} />
                          <Typography sx={{ fontSize: 12.5 }}>Your details are protected and used only for this registration.</Typography>
                        </Stack>
                      </Box>
                    )}

                    {/* Existing user */}
                    {webinarStep === "existing_user_confirm" && (
                      <Stack spacing={2.5}>
                        <Box sx={{ p: 2.25, borderRadius: "16px", bgcolor: isDark ? "rgba(18,161,116,.10)" : "#effaf6", border: "1px solid rgba(18,161,116,.22)" }}>
                          <Stack direction="row" alignItems="center" spacing={1.5}>
                            <Box sx={{ width: 40, height: 40, borderRadius: "50%", bgcolor: isDark ? "rgba(18,161,116,.2)" : "#d5f4e8", display: "grid", placeItems: "center", color: colors.green, flexShrink: 0 }}>
                              <CheckCircle2 size={20} />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ fontSize: 15, fontWeight: FW.semibold }}>
                                Welcome back{existingUser?.firstName ? `, ${existingUser.firstName}` : ""}
                              </Typography>
                              <Typography sx={{ fontSize: 13, color: colors.muted, overflowWrap: "anywhere" }}>{existingUser?.email || formData.email}</Typography>
                            </Box>
                          </Stack>
                        </Box>
                        {error && <Typography role="alert" sx={{ color: colors.danger, fontSize: 13 }}>{error}</Typography>}
                        <Button fullWidth onClick={handleConfirmFreeRegistration} disabled={loading} endIcon={!loading && <Check size={18} />} sx={primaryButtonSx}>
                          {loading ? <CircularProgress size={22} sx={{ color: "#fff" }} /> : "Confirm my free seat"}
                        </Button>
                        <Button onClick={() => { setWebinarStep("enter_email"); setError(""); }} startIcon={<ArrowLeft size={15} />} sx={{ ...ghostButtonSx, alignSelf: "center" }}>
                          Use a different email
                        </Button>
                      </Stack>
                    )}

                    {/* New user */}
                    {webinarStep === "new_user" && (
                      <Box component="form" onSubmit={handleNewUserSubmit}>
                        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 1.75, py: 1.25, mb: 3, borderRadius: "12px", bgcolor: colors.soft, border: `1px solid ${colors.line}` }}>
                          <Mail size={16} color={colors.muted} />
                          <Typography sx={{ fontSize: 13.5, flex: 1, overflowWrap: "anywhere" }}>{formData.email}</Typography>
                          <Button size="small" onClick={() => { setWebinarStep("enter_email"); setError(""); }} sx={{ minWidth: 0, textTransform: "none", fontSize: 13, fontWeight: FW.semibold, color: colors.primary }}>Edit</Button>
                        </Stack>

                        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, mb: 2.5 }}>
                          <Box>
                            <Typography sx={labelSx}>First name</Typography>
                            <TextField fullWidth name="firstName" placeholder="Alex" autoComplete="given-name" value={formData.firstName} onChange={handleChange} autoFocus sx={fieldSx} />
                          </Box>
                          <Box>
                            <Typography sx={labelSx}>Last name</Typography>
                            <TextField fullWidth name="lastName" placeholder="Morgan" autoComplete="family-name" value={formData.lastName} onChange={handleChange} sx={fieldSx} />
                          </Box>
                        </Box>

                        <Box sx={{ mb: 2.5 }}>
                          <Typography sx={labelSx}>
                            Phone number <Typography component="span" sx={{ fontSize: 12, color: colors.muted, fontWeight: FW.regular }}>(optional)</Typography>
                          </Typography>
                          <PhoneInput
                            defaultCountry="in" value={formData.mobileNumber} onChange={handlePhoneChange}
                            style={{ width: "100%" }}
                            inputProps={{ autoComplete: "tel", "aria-label": "Phone number" }}
                            inputStyle={{
                              width: "100%", height: 50, padding: "0 14px", fontSize: 14.5, fontWeight: FW.regular,
                              color: colors.text, background: isDark ? "rgba(255,255,255,.04)" : "#fff",
                              border: `1px solid ${colors.line}`, borderRadius: "0 12px 12px 0", outline: "none", boxSizing: "border-box"
                            }}
                            countrySelectorStyleProps={{
                              buttonStyle: {
                                height: 50, padding: "0 10px", border: `1px solid ${colors.line}`, borderRight: 0,
                                borderRadius: "12px 0 0 12px", background: isDark ? "#1c1a14" : "#fffbeb"
                              }
                            }}
                          />
                        </Box>

                        <Box sx={{ mb: 1 }}>
                          <Typography sx={labelSx}>Password</Typography>
                          <TextField
                            fullWidth name="password" autoComplete="new-password"
                            placeholder="Create a strong password"
                            type={showPassword ? "text" : "password"} value={formData.password}
                            onChange={handleChange} sx={fieldSx}
                            InputProps={{
                              startAdornment: <InputAdornment position="start"><Lock size={18} color={colors.muted} /></InputAdornment>,
                              endAdornment: <InputAdornment position="end"><IconButton aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)} edge="end" size="small" sx={{ color: colors.muted }}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</IconButton></InputAdornment>
                            }}
                          />
                          <Typography sx={{ mt: .9, fontSize: 12, color: colors.muted }}>Use at least 6 characters, or follow your application's password policy.</Typography>
                        </Box>

                        {error && <Typography role="alert" sx={{ mt: 1.5, color: colors.danger, fontSize: 13 }}>{error}</Typography>}
                        <Button fullWidth type="submit" disabled={loading} endIcon={!loading && <ArrowRight size={18} />} sx={{ ...primaryButtonSx, mt: 3 }}>
                          {loading ? <CircularProgress size={22} sx={{ color: "#fff" }} /> : info.isPaid ? "Create account & continue" : "Create account & register"}
                        </Button>
                        <Typography sx={{ mt: 2, textAlign: "center", color: colors.muted, fontSize: 12, lineHeight: 1.6 }}>
                          By continuing, you agree to the platform's Terms of Service and Privacy Policy.
                        </Typography>
                      </Box>
                    )}

                    {/* Payment */}
                    {webinarStep === "payment" && (
                      <Stack spacing={1.75}>
                        <Button startIcon={<ArrowLeft size={15} />} onClick={() => { setWebinarStep(existingUser ? "enter_email" : "new_user"); setError(""); }} sx={{ ...ghostButtonSx, alignSelf: "flex-start", p: 0, minWidth: 0 }}>
                          Back
                        </Button>

                        <Box sx={{ p: 2, borderRadius: "16px", bgcolor: colors.soft, border: `1px solid ${colors.line}` }}>
                          <Stack direction="row" spacing={1.5} alignItems="flex-start">
                            <Box sx={{ width: 40, height: 40, borderRadius: "12px", bgcolor: isDark ? "rgba(217,119,6,.18)" : "#fef3c7", color: colors.primary, display: "grid", placeItems: "center", flexShrink: 0 }}>
                              <Video size={19} />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ fontSize: 15, fontWeight: FW.semibold, lineHeight: 1.4, overflowWrap: "anywhere" }}>Title - {info.webinarName}</Typography>
                              <Typography sx={{ fontSize: 13, color: colors.muted, mt: .4 }}>Speaker - {info.conductorName || "Expert speaker"} / Duration - {info.durationMinutes || 60} minutes</Typography>
                            </Box>
                          </Stack>
                          <Divider sx={{ my: 1.5, borderColor: colors.line }} />
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography sx={{ fontSize: 14, color: colors.muted }}>Total (1 seat)</Typography>
                            <Typography sx={{ fontSize: 26, fontWeight: FW.semibold, letterSpacing: "-.02em" }}>₹{amount}</Typography>
                          </Stack>
                        </Box>

                        <Typography sx={{ ...labelSx, mb: 0 }}>Payment method</Typography>
                        <RadioGroup value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} sx={{ gap: 1 }}>
                          {[
                            { value: "upi", title: "UPI", desc: "Google Pay, PhonePe, Paytm and more", icon: Smartphone },
                            { value: "card", title: "Credit or debit card", desc: "Visa, Mastercard and RuPay", icon: CreditCard }
                          ].map((method) => {
                            const Icon = method.icon;
                            const selected = paymentMethod === method.value;
                            return (
                              <Paper key={method.value} elevation={0} onClick={() => setPaymentMethod(method.value)} sx={{
                                p: 1.1, borderRadius: "14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 1.25,
                                border: `1.5px solid ${selected ? colors.primary : colors.line}`,
                                bgcolor: selected ? (isDark ? "rgba(217,119,6,.15)" : "#fffbeb") : colors.panel,
                                transition: "all .2s"
                              }}>
                                <Radio value={method.value} size="small" sx={{ p: .5, color: colors.muted, "&.Mui-checked": { color: colors.primary } }} />
                                <Box sx={{ width: 38, height: 38, borderRadius: "11px", bgcolor: colors.soft, color: selected ? colors.primary : colors.muted, display: "grid", placeItems: "center", flexShrink: 0 }}>
                                  <Icon size={18} />
                                </Box>
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography sx={{ fontSize: 14, fontWeight: FW.semibold }}>{method.title}</Typography>
                                  <Typography sx={{ fontSize: 12.5, color: colors.muted, mt: .2 }}>{method.desc}</Typography>
                                </Box>
                              </Paper>
                            );
                          })}
                        </RadioGroup>

                        <Button fullWidth disabled={paying} onClick={handleCompletePayment} endIcon={!paying && <ArrowRight size={18} />} sx={primaryButtonSx}>
                          {paying ? <CircularProgress size={22} sx={{ color: "#fff" }} /> : `Pay ₹${amount}`}
                        </Button>
                        <Stack direction="row" alignItems="center" justifyContent="center" spacing={.8} sx={{ color: colors.muted }}>
                          <ShieldCheck size={14} color={colors.green} />
                          <Typography sx={{ fontSize: 12.5 }}>Secure payment · Your details stay protected</Typography>
                        </Stack>
                      </Stack>
                    )}

                    <Divider sx={{ my: 2, borderColor: colors.line }} />
                    <Typography sx={{ color: colors.muted, fontSize: 12.5, textAlign: "center" }}>
                      Need help? Contact the event team.
                    </Typography>
                  </>
                )}
              </Box>
            </Box>
          </Box>

          {/* Footer */}
          <Box sx={{
            px: { xs: 2.5, sm: 4, lg: 5 }, py: 1.75, display: "flex", alignItems: "center",
            justifyContent: "space-between", gap: 1, flexWrap: "wrap",
            borderTop: `1px solid ${colors.line}`, bgcolor: isDark ? "rgba(0,0,0,.15)" : "#fafbff"
          }}>
            <Typography sx={{ fontSize: 12, color: colors.muted }}>© {new Date().getFullYear()} ProDesX. All rights reserved.</Typography>
            <Stack direction="row" spacing={2.5} sx={{ color: colors.muted }}>
              <Typography sx={{ fontSize: 12 }}>Privacy</Typography>
              <Typography sx={{ fontSize: 12 }}>Terms</Typography>
            </Stack>
          </Box>
        </Paper>
      </Container>

      {/* Success dialog */}
      <Dialog
        open={showSuccessModal} onClose={handleCloseSuccessModal} maxWidth="xs" fullWidth
        PaperProps={{ sx: {
          borderRadius: "24px", p: 1, bgcolor: colors.panel, color: colors.text,
          border: `1px solid ${colors.line}`, boxShadow: "0 28px 80px rgba(0,0,0,.25)"
        }}}
      >
        <DialogContent sx={{ textAlign: "center", pt: 4, pb: 2, px: { xs: 2, sm: 3 } }}>
          <Box sx={{ width: 68, height: 68, borderRadius: "50%", mx: "auto", mb: 2.5, display: "grid", placeItems: "center", color: colors.green, bgcolor: isDark ? "rgba(18,161,116,.15)" : "#e3f8ef" }}>
            <CheckCircle2 size={34} />
          </Box>
          <Typography sx={{ fontSize: 24, fontWeight: FW.semibold, letterSpacing: "-.02em" }}>You're registered!</Typography>
          <Typography sx={{ mt: 1.25, fontSize: 14, color: colors.muted, lineHeight: 1.7 }}>
            Your seat is confirmed. Check your email for event updates and joining information.
          </Typography>
          {info.webinarName && (
            <Typography sx={{ mt: 2.5, fontSize: 14, fontWeight: FW.semibold, color: colors.primary, overflowWrap: "anywhere" }}>
              {info.webinarName}
            </Typography>
          )}
          <Typography sx={{ mt: 2, fontSize: 12.5, color: colors.muted }}>Opening your dashboard in {countdown} seconds…</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, justifyContent: "center" }}>
          <Button onClick={handleCloseSuccessModal} endIcon={<ExternalLink size={16} />} sx={{ ...primaryButtonSx, px: 3.5, minWidth: 200 }}>
            Go to dashboard
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WebinarRegistration;