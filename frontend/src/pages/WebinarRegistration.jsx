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
import { useAuth } from "../context/AuthContext";
import { getCurrencySymbolFromCountryCode } from "../utils/countryUtils";
import logo from "../assets/logo1.png";

/* Layout Stack wrapper */
const Stack = ({ alignItems, justifyContent, flexWrap, gap, sx, ...rest }) => (
  <MuiStack sx={{ alignItems, justifyContent, flexWrap, gap, ...sx }} {...rest} />
);

const FW = { regular: 400, semibold: 600 };
const FONT = `"Inter", "Segoe UI", system-ui, -apple-system, sans-serif`;

const STUDENT_ROUTES = [
  '/dashboard', '/dashboard/profile', '/dashboard/webinars', '/dashboard/upcoming',
  '/dashboard/registered', '/dashboard/completed', '/dashboard/certificates',
  '/dashboard/recordings', '/dashboard/payments', '/dashboard/notifications',
];

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
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const trackingId = searchParams.get("trackingId");

  const [webinarInfo, setWebinarInfo] = useState(null);
  // Steps: "preview" | "enter_email" | "login_password" | "new_user" | "payment"
  const [webinarStep, setWebinarStep] = useState("preview");
  const [existingUser, setExistingUser] = useState(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [paying, setPaying] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const countdownIntervalRef = useRef(null);

  // Seat Hold state (BookMyShow dual-clock pattern)
  const [activeHoldToken, setActiveHoldToken] = useState(() => localStorage.getItem(`hold_${trackingId}`) || null);
  const [holdCountdown, setHoldCountdown] = useState(300);
  const holdIntervalRef = useRef(null);

  const startHoldTimer = (seconds = 300) => {
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    setHoldCountdown(seconds);
    holdIntervalRef.current = setInterval(() => {
      setHoldCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(holdIntervalRef.current);
          setActiveHoldToken(null);
          localStorage.removeItem(`hold_${trackingId}`);
          toast.error("Your 5-minute reservation hold has expired. Please select your seat again.");
          setWebinarStep("preview");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    };
  }, []);

  const [formData, setFormData] = useState({
    firstName: "", lastName: "", email: "", password: "",
    countryCode: "+91", mobileNumber: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Restore authenticated session from localStorage if already logged in
  useEffect(() => {
    try {
      const rawUser = localStorage.getItem('user');
      const token = localStorage.getItem('token');
      if (rawUser && token) {
        const u = JSON.parse(rawUser);
        if (u && (u.id || u.userId)) {
          const uid = u.id || u.userId;
          setExistingUser({ ...u, userId: uid });
          setFormData((prev) => ({
            ...prev,
            email: u.email || prev.email,
            firstName: u.firstName || prev.firstName,
            lastName: u.lastName || prev.lastName,
            countryCode: u.countryCode || prev.countryCode
          }));
        }
      }
    } catch {}
  }, []);

  // Fetch webinar details
  useEffect(() => {
    if (!trackingId) return;
    webinarService.getPublic(trackingId)
      .then((res) => { if (res.data?.success) setWebinarInfo(res.data.data); })
      .catch(() => {});
  }, [trackingId]);

  // Check and restore active seat reservation hold on mount if active
  useEffect(() => {
    if (!trackingId) return;
    const token = localStorage.getItem(`hold_${trackingId}`);
    const expiresStr = localStorage.getItem(`hold_expires_${trackingId}`);
    if (token && expiresStr) {
      const expiresUtc = new Date(expiresStr).getTime();
      const nowUtc = Date.now();
      const remainingSec = Math.floor((expiresUtc - nowUtc) / 1000);
      if (remainingSec > 0) {
        setActiveHoldToken(token);
        startHoldTimer(Math.min(remainingSec, 300));
      } else {
        localStorage.removeItem(`hold_${trackingId}`);
        localStorage.removeItem(`hold_expires_${trackingId}`);
        setActiveHoldToken(null);
      }
    }
  }, [trackingId]);

  // Success countdown
  useEffect(() => {
    if (!showSuccessModal) return;
    setCountdown(5);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          navigate("/dashboard/webinars?tab=registered");
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
    navigate("/dashboard/webinars?tab=registered");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handlePhoneChange = (phone, meta) => {
    const cleanPhone = (phone || "").replaceAll(/[^0-9+]/g, "");
    let dial = "";
    if (meta?.country?.dialCode) {
      dial = meta.country.dialCode.startsWith("+") ? meta.country.dialCode : `+${meta.country.dialCode}`;
    } else {
      const match = cleanPhone.match(/^\+(\d{1,3})/);
      if (match) dial = `+${match[1]}`;
    }
    setFormData((prev) => ({
      ...prev,
      mobileNumber: cleanPhone,
      countryCode: dial || prev.countryCode
    }));
  };

  const handleStartRegistration = () => {
    setError("");
    // If already logged in, skip email step
    if (existingUser && localStorage.getItem('token')) {
      if (webinarInfo?.isPaid) setWebinarStep("payment");
      else handleConfirmDirectFreeRegistration();
      return;
    }
    setWebinarStep("enter_email");
  };

  // ── Step 1: Check IsSignedUp by Email ──
  const handleCheckEmail = async (e) => {
    e.preventDefault();
    setError("");
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.isValid) return setError(emailValidation.error);

    setCheckingEmail(true);
    try {
      const res = await webinarService.checkEmail(formData.email.trim());
      if (res.data?.success && res.data.data?.exists) {
        // IsSignedUp == true (Existing account in database)
        const existing = res.data.data;
        setExistingUser(existing);
        if (existing.countryCode) {
          setFormData((prev) => ({ ...prev, countryCode: existing.countryCode }));
        }

        // If active session token already exists for this exact user
        const token = localStorage.getItem('token');
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        if (token && storedUser.email?.toLowerCase() === formData.email.trim().toLowerCase()) {
          // Already logged in as this user
          await triggerSeatHold(existing.userId);
          if (webinarInfo?.isPaid) setWebinarStep("payment");
          else await handleConfirmDirectFreeRegistration(existing.userId);
          return;
        }

        // Prompt for password to securely sign in
        setWebinarStep("login_password");
      } else {
        // IsSignedUp == false (New friend / Not signed up)
        setExistingUser(null);
        setWebinarStep("new_user");
      }
    } catch {
      setError("Unable to verify email. Please try again.");
    } finally {
      setCheckingEmail(false);
    }
  };

  // Helper to atomically hold seat
  const triggerSeatHold = async (userId) => {
    try {
      const holdRes = await webinarService.holdSeat(trackingId, userId);
      if (holdRes.data?.success && holdRes.data?.data) {
        const hData = holdRes.data.data;
        setActiveHoldToken(hData.holdToken);
        localStorage.setItem(`hold_${trackingId}`, hData.holdToken);
        localStorage.setItem(`hold_expires_${trackingId}`, hData.expiresAt);
        startHoldTimer(hData.remainingSeconds || 300);
      }
    } catch {}
  };

  // ── Step 2A: Login Existing User (IsSignedUp == true) ──
  const handleExistingUserLogin = async (e) => {
    e.preventDefault();
    setError("");
    if (!formData.password) {
      setError("Please enter your password to continue.");
      return;
    }

    setLoading(true);
    try {
      const loginRes = await authService.login(formData.email.trim(), formData.password);
      if (loginRes.data?.success) {
        const { user: userData, token } = loginRes.data;
        const minUser = {
          id: userData.id,
          firstName: userData.firstName,
          roleId: userData.roleId,
          roleName: userData.roleName || "Student",
          email: userData.email,
        };

        login(minUser, token, STUDENT_ROUTES);
        setExistingUser({ ...userData, userId: userData.id });
        await triggerSeatHold(userData.id);

        if (webinarInfo?.isPaid) {
          setWebinarStep("payment");
        } else {
          // Register free webinar
          const regRes = await webinarService.registerTracking(trackingId, userData.id, activeHoldToken);
          if (regRes.data?.success) {
            localStorage.removeItem(`hold_${trackingId}`);
            localStorage.removeItem(`hold_expires_${trackingId}`);
            setShowSuccessModal(true);
          } else {
            setError(regRes.data?.message || "Registration failed. Please try again.");
          }
        }
      } else {
        setError(loginRes.data?.message || "Incorrect password. Please try again.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Incorrect password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Direct Free Registration for already logged in user
  const handleConfirmDirectFreeRegistration = async (overrideUserId) => {
    setLoading(true);
    setError("");
    try {
      const userId = overrideUserId || existingUser?.userId || existingUser?.id;
      if (!userId) {
        setError("Unable to identify your account. Please sign in again.");
        return;
      }
      await triggerSeatHold(userId);
      const res = await webinarService.registerTracking(trackingId, userId, activeHoldToken);
      if (res.data?.success) {
        localStorage.removeItem(`hold_${trackingId}`);
        localStorage.removeItem(`hold_expires_${trackingId}`);
        setShowSuccessModal(true);
      } else {
        setError(res.data?.message || "Registration failed. Please try again.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Complete Payment ──
  const handleCompletePayment = async () => {
    setPaying(true);
    try {
      let userId = existingUser?.userId || existingUser?.id;
      if (!userId) {
        try {
          const rawUser = localStorage.getItem('user');
          if (rawUser) {
            const u = JSON.parse(rawUser);
            userId = u?.id || u?.userId;
          }
        } catch {}
      }
      if (!userId) {
        toast.error("Account session expired. Please sign in again.");
        setWebinarStep("enter_email");
        return;
      }

      const regRes = await webinarService.registerTracking(trackingId, userId, activeHoldToken);
      if (regRes.data?.success) {
        localStorage.removeItem(`hold_${trackingId}`);
        localStorage.removeItem(`hold_expires_${trackingId}`);
        setShowSuccessModal(true);
      } else {
        toast.error(regRes.data?.message || "Payment could not be confirmed.");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "There was a problem processing your request.");
    } finally {
      setPaying(false);
    }
  };

  /* Design tokens - Exact Original ProDesX Theme */
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

  // Country pricing
  const activeCountryCode = existingUser?.countryCode || formData.countryCode || "+91";
  const matchedCountryPrice = (webinarInfo?.countryPrices || []).find(
    (p) => p.countryCode === activeCountryCode || p.countryCode?.replace(/[^\d]/g, '') === activeCountryCode?.replace(/[^\d]/g, '')
  );

  const isPriceAvailableForCountry = !info.isPaid || (matchedCountryPrice != null && matchedCountryPrice.amount > 0);
  const currentPrice = matchedCountryPrice != null ? matchedCountryPrice.amount : (info.price || 0);
  const currentCurrency = matchedCountryPrice?.currencySymbol || getCurrencySymbolFromCountryCode(activeCountryCode);
  const amount = Number(currentPrice || 0).toLocaleString();
  const isCapacityFull = Boolean(info.participantLimit && info.participantLimit > 0 && (info.registrationCount || 0) >= info.participantLimit);
  const isSessionEnded = Boolean(info.isCompleted || (info.endTime && new Date(info.endTime) < new Date()));

  const stepTitle = {
    enter_email: "Save your seat",
    login_password: "Confirm your account",
    new_user: "Sign up required",
    payment: "Complete your payment"
  }[webinarStep];

  const stepSubtitle = {
    enter_email: "Enter your email to get started. It only takes a minute.",
    login_password: `Welcome back, ${existingUser?.firstName || 'Student'}! Enter your password to continue.`,
    new_user: "You have to sign up to our platform before continuing registration.",
    payment: "Review your order and choose how you'd like to pay."
  }[webinarStep];

  const details = [
    { icon: Calendar, label: "Date", value: formatDate(info.webinarDate || info.startTime) },
    { icon: Clock, label: "Time & duration", value: `${formatTime(info.startTime || info.webinarDate)} · ${info.durationMinutes || 60} min` },
    { icon: User, label: "Speaker", value: info.conductorName || "Expert speaker" },
    { icon: Users, label: "Seats", value: info.participantLimit ? `${info.participantLimit} seats total` : "Open registration" }
  ];

  const stepLabels = ["Account", info.isPaid ? "Payment" : "Confirm"];
  const activeStep = webinarStep === "payment" ? 1 : 0;

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
                    {info.isPaid
                      ? (isPriceAvailableForCountry ? `${currentCurrency}${amount} per seat` : "Not available in your country")
                      : "Free to attend"}
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

            {/* ---------- Right: Dynamic Form ---------- */}
            <Box sx={{
              p: { xs: 3, sm: 4, lg: 5 }, display: "flex", flexDirection: "column",
              minHeight: 0, overflowY: "auto"
            }}>
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
                        info.isPaid ? `One-time fee of ${currentCurrency}${amount}, no hidden charges` : "Completely free to attend"
                      ].map((text) => (
                        <Stack key={text} direction="row" spacing={1.25} alignItems="center">
                          <Box sx={{ color: colors.green, display: "flex" }}><CheckCircle2 size={18} /></Box>
                          <Typography sx={{ fontSize: 14, color: colors.text }}>{text}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                    {error && (
                      <Typography role="alert" sx={{ color: colors.danger, fontSize: 13 }}>
                        {error}
                      </Typography>
                    )}
                    <Button
                      fullWidth
                      disabled={checkingEmail || isSessionEnded || isCapacityFull}
                      onClick={handleStartRegistration}
                      endIcon={!checkingEmail && !isSessionEnded && !isCapacityFull && <ArrowRight size={18} />}
                      sx={primaryButtonSx}
                    >
                      {checkingEmail ? (
                        <CircularProgress size={22} sx={{ color: "#fff" }} />
                      ) : isSessionEnded ? (
                        "Webinar Ended"
                      ) : isCapacityFull ? (
                        "Capacity Full / Sold Out"
                      ) : (
                        "Register for webinar"
                      )}
                    </Button>
                  </Stack>
                )}

                {webinarStep !== "preview" && (
                  <>
                    {/* Stepper & Live Hold Timer */}
                    <Box sx={{ mb: 2.5, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
                      <Stack direction="row" spacing={1.5} sx={{ flex: 1, minWidth: 200 }}>
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

                      {/* Live 5:00 Hold Countdown Indicator */}
                      {activeHoldToken && (
                        <Box sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: .75,
                          px: 1.5,
                          py: .5,
                          borderRadius: "100px",
                          bgcolor: holdCountdown <= 60 ? "#fee2e2" : "#fef3c7",
                          border: `1px solid ${holdCountdown <= 60 ? "#fca5a5" : "#fde68a"}`,
                          color: holdCountdown <= 60 ? "#dc2626" : "#b45309",
                          fontSize: 12,
                          fontWeight: FW.semibold
                        }}>
                          <Clock size={13} />
                          <span>Seat Held: {Math.floor(holdCountdown / 60)}:{String(holdCountdown % 60).padStart(2, "0")}</span>
                        </Box>
                      )}
                    </Box>

                    <Typography sx={{ fontSize: { xs: 26, sm: 30 }, fontWeight: FW.semibold, letterSpacing: "-.02em", lineHeight: 1.2 }}>
                      {stepTitle}
                    </Typography>
                    <Typography sx={{ mt: .75, mb: 2.5, fontSize: 14, lineHeight: 1.6, color: colors.muted }}>
                      {stepSubtitle}
                    </Typography>

                    {/* ── STEP 1: Enter Email (Smart Identifier) ── */}
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
                        <Button fullWidth type="submit" disabled={checkingEmail || !formData.email.trim()} endIcon={!checkingEmail && <ArrowRight size={18} />} sx={{ ...primaryButtonSx, mt: 3 }}>
                          {checkingEmail ? <CircularProgress size={22} sx={{ color: "#fff" }} /> : "Continue"}
                        </Button>
                        <Stack direction="row" alignItems="center" justifyContent="center" spacing={.8} sx={{ mt: 2.5, color: colors.muted }}>
                          <ShieldCheck size={14} />
                          <Typography sx={{ fontSize: 12.5 }}>Your details are protected and used only for this registration.</Typography>
                        </Stack>
                      </Box>
                    )}

                    {/* ── STEP 2A: Existing User Password Challenge (IsSignedUp == true) ── */}
                    {webinarStep === "login_password" && (
                      <Box component="form" onSubmit={handleExistingUserLogin}>
                        <Box sx={{ p: 2, mb: 2.5, borderRadius: "16px", bgcolor: isDark ? "rgba(217,119,6,.12)" : "#fffbeb", border: `1px solid ${colors.line}` }}>
                          <Stack direction="row" alignItems="center" spacing={1.5}>
                            <Box sx={{ width: 40, height: 40, borderRadius: "12px", bgcolor: isDark ? "rgba(217,119,6,.22)" : "#fef3c7", color: colors.primary, display: "grid", placeItems: "center", flexShrink: 0 }}>
                              <User size={20} />
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography sx={{ fontSize: 14.5, fontWeight: FW.semibold }}>
                                {existingUser?.firstName ? `${existingUser.firstName} ${existingUser.lastName || ''}` : 'Existing Account'}
                              </Typography>
                              <Typography sx={{ fontSize: 13, color: colors.muted, overflowWrap: "anywhere" }}>
                                {existingUser?.email || formData.email}
                              </Typography>
                            </Box>
                            <Button size="small" onClick={() => { setWebinarStep("enter_email"); setError(""); setFormData(p => ({ ...p, password: "" })); }} sx={{ minWidth: 0, textTransform: "none", fontSize: 12.5, fontWeight: FW.semibold, color: colors.primary }}>
                              Change
                            </Button>
                          </Stack>
                        </Box>

                        <Box sx={{ mb: 1 }}>
                          <Typography sx={labelSx}>Password</Typography>
                          <TextField
                            fullWidth name="password" autoComplete="current-password"
                            placeholder="Enter your account password"
                            type={showPassword ? "text" : "password"} value={formData.password}
                            onChange={handleChange} autoFocus sx={fieldSx}
                            InputProps={{
                              startAdornment: <InputAdornment position="start"><Lock size={18} color={colors.muted} /></InputAdornment>,
                              endAdornment: <InputAdornment position="end"><IconButton aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)} edge="end" size="small" sx={{ color: colors.muted }}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</IconButton></InputAdornment>
                            }}
                          />
                        </Box>

                        {error && <Typography role="alert" sx={{ mt: 1.5, color: colors.danger, fontSize: 13 }}>{error}</Typography>}
                        <Button fullWidth type="submit" disabled={loading || !formData.password} endIcon={!loading && <ArrowRight size={18} />} sx={{ ...primaryButtonSx, mt: 3 }}>
                          {loading ? <CircularProgress size={22} sx={{ color: "#fff" }} /> : info.isPaid ? "Sign in & continue to payment" : "Sign in & claim my seat"}
                        </Button>
                        <Box sx={{ mt: 2, textAlign: "center" }}>
                          <Button onClick={() => { setWebinarStep("enter_email"); setError(""); }} startIcon={<ArrowLeft size={15} />} sx={ghostButtonSx}>
                            Use a different email
                          </Button>
                        </Box>
                      </Box>
                    )}

                    {/* ── STEP 2B: New User Registration Gate (Navigate to Signup) ── */}
                    {webinarStep === "new_user" && (
                      <Stack spacing={2.5}>
                        <Box sx={{ p: 2, borderRadius: "16px", bgcolor: isDark ? "rgba(217,119,6,.12)" : "#fffbeb", border: `1px solid ${colors.line}` }}>
                          <Stack direction="row" alignItems="center" spacing={1.5}>
                            <Box sx={{ width: 40, height: 40, borderRadius: "12px", bgcolor: isDark ? "rgba(217,119,6,.22)" : "#fef3c7", color: colors.primary, display: "grid", placeItems: "center", flexShrink: 0 }}>
                              <User size={20} />
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography sx={{ fontSize: 14.5, fontWeight: FW.semibold }}>
                                Account Not Found
                              </Typography>
                              <Typography sx={{ fontSize: 13, color: colors.muted, overflowWrap: "anywhere" }}>
                                {formData.email}
                              </Typography>
                            </Box>
                            <Button size="small" onClick={() => { setWebinarStep("enter_email"); setError(""); }} sx={{ minWidth: 0, textTransform: "none", fontSize: 12.5, fontWeight: FW.semibold, color: colors.primary }}>
                              Change
                            </Button>
                          </Stack>
                        </Box>

                        <Typography sx={{ fontSize: 14, color: colors.muted, lineHeight: 1.6 }}>
                          You have to sign up to our platform before you can register for this webinar. Click below to complete your student registration and claim your seat.
                        </Typography>

                        <Button
                          fullWidth
                          onClick={() => {
                            const signupUrl = `/signup?email=${encodeURIComponent(formData.email)}&redirect=${encodeURIComponent(`/dashboard/webinars?register=${trackingId}`)}`;
                            navigate(signupUrl);
                          }}
                          endIcon={<ArrowRight size={18} />}
                          sx={{ ...primaryButtonSx, mt: 1 }}
                        >
                          Sign Up & Continue Registration
                        </Button>

                        <Box sx={{ textAlign: "center", mt: 1 }}>
                          <Button onClick={() => { setWebinarStep("enter_email"); setError(""); }} startIcon={<ArrowLeft size={15} />} sx={ghostButtonSx}>
                            Use a different email
                          </Button>
                        </Box>
                      </Stack>
                    )}

                    {/* ── STEP 3: Payment Screen ── */}
                    {webinarStep === "payment" && (
                      <Stack spacing={1.75}>
                        <Button startIcon={<ArrowLeft size={15} />} onClick={() => { setWebinarStep(existingUser ? "login_password" : "new_user"); setError(""); }} sx={{ ...ghostButtonSx, alignSelf: "flex-start", p: 0, minWidth: 0 }}>
                          Back
                        </Button>

                        {!isPriceAvailableForCountry ? (
                          <Box sx={{ p: 3, borderRadius: "16px", bgcolor: isDark ? "rgba(220,38,38,.1)" : "#fee2e2", border: "1px solid rgba(220,38,38,.2)", textAlign: "center" }}>
                            <Typography sx={{ fontSize: 16, fontWeight: FW.semibold, color: colors.danger }}>
                              Webinar not available in your region
                            </Typography>
                            <Typography sx={{ fontSize: 13.5, color: colors.muted, mt: 1 }}>
                              Pricing has not been configured for your country ({activeCountryCode}). Please check back later or contact support.
                            </Typography>
                          </Box>
                        ) : (
                          <>
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
                                <Typography sx={{ fontSize: 26, fontWeight: FW.semibold, letterSpacing: "-.02em" }}>{currentCurrency}{amount}</Typography>
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
                              {paying ? <CircularProgress size={22} sx={{ color: "#fff" }} /> : `Pay ${currentCurrency}${amount}`}
                            </Button>
                            <Stack direction="row" alignItems="center" justifyContent="center" spacing={.8} sx={{ color: colors.muted }}>
                              <ShieldCheck size={14} color={colors.green} />
                              <Typography sx={{ fontSize: 12.5 }}>Secure payment · Your details stay protected</Typography>
                            </Stack>
                          </>
                        )}
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
