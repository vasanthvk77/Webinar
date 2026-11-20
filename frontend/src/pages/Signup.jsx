import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import {
  Box, Typography, TextField, Button,
  Paper, InputAdornment, Container, IconButton, Divider,
  Snackbar, Alert
} from "@mui/material";
import { Mail, Lock, Eye, EyeOff, User, Phone, CheckCircle, RotateCw } from "lucide-react";
import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";
import { authService } from "../services/api";
import { validateEmail, validatePassword } from "../utils/validation";
import logo from "../assets/logo1.png";

const Signup = ({ mode }) => {
  const isDark = mode === "dark";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Safely parse redirect target (prevents Open Redirect attacks)
  const getSafeRedirect = () => {
    const redirectCandidate = searchParams.get("redirect");
    if (
      typeof redirectCandidate === "string" &&
      redirectCandidate.startsWith("/") &&
      !redirectCandidate.startsWith("//") &&
      !redirectCandidate.includes("\\")
    ) {
      return redirectCandidate;
    }
    return "/dashboard";
  };

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: searchParams.get("email") || "",
    password: "",
    countryCode: "+1",
    mobileNumber: ""
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Snackbar State
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "error"
  });

  const showSnackbar = (message, severity = "error") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = (event, reason) => {
    if (reason === "clickaway") return;
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // OTP Verification States
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpTimer, setOtpTimer] = useState(0);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpBlocked, setOtpBlocked] = useState(false);

  // 60-second OTP Countdown Timer
  useEffect(() => {
    let interval = null;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "email") {
      if (isEmailVerified || otpSent) {
        setIsEmailVerified(false);
        setOtpSent(false);
        setOtp("");
        setOtpBlocked(false);
        setOtpTimer(0);
      }
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhoneChange = (phone) => {
    // Extract country code and number from international format
    // PhoneInput returns format like: +1 555-1234
    setFormData(prev => ({
      ...prev,
      mobileNumber: phone.replaceAll(/[^0-9+]/g, '') // Remove formatting, keep + and digits
    }));
  };

  // Send OTP
  const handleSendOtp = async () => {
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.isValid) {
      showSnackbar(emailValidation.error, "error");
      return;
    }

    setOtpSending(true);
    try {
      const response = await authService.sendOtp(formData.email.trim(), 1);
      if (response.data.success) {
        showSnackbar(response.data.message || "Verification code sent to your email!", "success");
        setOtpSent(true);
        setOtp("");
        setOtpBlocked(false);
        const seconds = response.data.expiresInSeconds || 60;
        setOtpTimer(seconds);
      } else {
        showSnackbar(response.data.message || "Failed to send OTP.", "error");
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to send OTP. Please try again.";
      showSnackbar(msg, "error");
    } finally {
      setOtpSending(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async () => {
    if (!otp.trim() || otp.trim().length !== 6) {
      showSnackbar("Please enter the 6-digit OTP code.", "error");
      return;
    }

    setOtpVerifying(true);
    try {
      const response = await authService.verifyOtp(formData.email.trim(), otp.trim(), 1);
      if (response.data.success) {
        showSnackbar("Email verified successfully!", "success");
        setIsEmailVerified(true);
        setOtpSent(false);
        setOtp("");
        setOtpTimer(0);
      } else {
        showSnackbar(response.data.message || "Verification failed.", "error");
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to verify OTP.";
      showSnackbar(msg, "error");
      if (msg.includes("Maximum OTP verification attempts exceeded") || msg.includes("exceeded")) {
        setOtpBlocked(true);
      }
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isEmailVerified) {
      showSnackbar("Please verify your email address before creating an account.", "error");
      return;
    }

    // Validate
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.isValid) {
      showSnackbar(emailValidation.error, "error");
      return;
    }

    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      showSnackbar(passwordValidation.error, "error");
      return;
    }

    if (!formData.firstName.trim()) {
      showSnackbar("First name is required", "error");
      return;
    }

    // Extract country code and number from phone
    let countryCode = "";
    let mobileNumber = "";

    if (formData.mobileNumber) {
      const phoneMatch = formData.mobileNumber.match(/^\+(\d{1,3})(\d+)$/);
      if (phoneMatch) {
        countryCode = `+${phoneMatch[1]}`;
        mobileNumber = phoneMatch[2];
      } else {
        mobileNumber = formData.mobileNumber;
      }
    }

    setLoading(true);
    try {
      const response = await authService.register(
        formData.firstName,
        formData.lastName,
        formData.email,
        formData.password,
        countryCode,
        mobileNumber
      );

      if (response.data.success) {
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user));
        localStorage.setItem("firstName", response.data.user.firstName);
        showSnackbar("Registration successful!", "success");
        navigate(getSafeRedirect(), { replace: true });
      } else {
        showSnackbar(response.data.message || "Registration failed", "error");
      }
    } catch (err) {
      showSnackbar(err.response?.data?.message || "An error occurred during registration", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    try {
      const response = await authService.googleLogin(credentialResponse.credential);
      
      if (response.data.success) {
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user));
        localStorage.setItem("firstName", response.data.user.firstName);
        showSnackbar(`Welcome, ${response.data.user.firstName}!`, "success");
        navigate(getSafeRedirect(), { replace: true });
      } else {
        showSnackbar(response.data.message || "Google signup failed", "error");
      }
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Google authentication failed", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (window.google) {
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: handleGoogleSuccess,
      });
      window.google.accounts.id.renderButton(
        document.getElementById("google_signup_button"),
        {
          theme: isDark ? "dark" : "light",
          size: "large",
          width: "100%",
          text: "signup_with"
        }
      );
    }
  }, [isDark]);

  const dynamicInputStyle = {
    "& .MuiOutlinedInput-root": {
      color: isDark ? "#f8fafc" : "#0f172a",
      backgroundColor: isDark ? "rgba(15, 23, 42, 0.4)" : "rgba(241, 245, 249, 0.6)",
      "& fieldset": { borderColor: isDark ? "rgba(59, 130, 246, 0.2)" : "rgba(59, 130, 246, 0.15)", borderRadius: "8px" },
      "&:hover fieldset": { borderColor: isDark ? "rgba(59, 130, 246, 0.45)" : "rgba(59, 130, 246, 0.3)" },
      "&.Mui-focused fieldset": { borderColor: "#3b82f6", borderRadius: "8px" },
      "& .MuiInputBase-input": { py: 2 }
    },
    "& .MuiInputBase-input::placeholder": { color: isDark ? "#64748b" : "#94a3b8", opacity: 1 },
  };

  return (
    <Box sx={{
      height: "100vh",
      display: "flex",
      bgcolor: isDark ? "#0d0f14" : "#f1f5f9",
      position: "relative",
      overflow: "hidden",
      backgroundImage: isDark
        ? `radial-gradient(at 0% 0%, rgba(59, 130, 246, 0.12) 0px, transparent 50%),
           radial-gradient(at 100% 100%, rgba(37, 99, 235, 0.1) 0px, transparent 50%)`
        : `radial-gradient(at 0% 0%, rgba(59, 130, 246, 0.08) 0px, transparent 50%),
           radial-gradient(at 100% 100%, rgba(37, 99, 235, 0.05) 0px, transparent 50%)`
    }}>

      {/* Animated background blob */}
      <Box sx={{
        position: "absolute",
        top: "20%", left: "10%",
        width: "400px", height: "400px",
        background: isDark
          ? "linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.1) 100%)"
          : "linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(37, 99, 235, 0.05) 100%)",
        filter: "blur(100px)",
        borderRadius: "50%",
        animation: "pulse 10s infinite alternate"
      }} />

      <Container maxWidth="sm" sx={{ display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1 }}>
        <Paper elevation={0} sx={{
          p: 5,
          width: "100%",
          maxWidth: 480,
          bgcolor: isDark ? "rgba(19, 22, 32, 0.65)" : "rgba(255, 255, 255, 0.8)",
          backdropFilter: "blur(20px)",
          border: isDark ? "1px solid rgba(59, 130, 246, 0.15)" : "1px solid rgba(59, 130, 246, 0.12)",
          borderRadius: 3,
          boxShadow: isDark ? "0 20px 40px rgba(0, 0, 0, 0.4)" : "0 20px 40px rgba(59, 130, 246, 0.08)",
          textAlign: "center",
          maxHeight: "90vh",
          overflowY: "auto"
        }}>

          {/* Logo */}
          <Box sx={{ mb: 4, display: "flex", justifyContent: "center" }}>
            <img
              src={logo}
              alt="Logo"
              style={{
                height: "140px",
                objectFit: "contain",
                filter: isDark ? "drop-shadow(0 4px 12px rgba(59, 130, 246, 0.15))" : "none"
              }}
            />
          </Box>

          {/* Title */}
          <Typography variant="h4" sx={{ color: isDark ? "#ffffff" : "#0f172a", fontWeight: 600, mb: 1, letterSpacing: "-1px" }}>
            Create Account
          </Typography>
          <Typography variant="body2" sx={{ color: isDark ? "#94a3b8" : "#475569", mb: 5 }}>
            <b>Join our webinar platform</b>
          </Typography>

          {/* Google Button */}
          <Box
            id="google_signup_button"
            sx={{ display: "flex", justifyContent: "center", mb: 2 }}
          />

          <Divider sx={{ my: 3, color: isDark ? "#334155" : "#cbd5e1" }}>Or signup with Email</Divider>

          <form onSubmit={handleSubmit}>
            {/* First Name */}
            <Box sx={{ textAlign: "left", mb: 3 }}>
              <Typography sx={{ fontSize: "12px", fontWeight: 700, color: isDark ? "#94a3b8" : "#475569", mb: 1, ml: 0.5, textTransform: "uppercase", letterSpacing: "0.2px" }}>
                First Name
              </Typography>
              <TextField
                fullWidth
                placeholder="John"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                autoComplete="given-name"
                autoFocus
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start" sx={{ mr: 1.5 }}>
                      <User size={18} color="#3b82f6" />
                    </InputAdornment>
                  ),
                }}
                sx={dynamicInputStyle}
              />
            </Box>

            {/* Last Name */}
            <Box sx={{ textAlign: "left", mb: 3 }}>
              <Typography sx={{ fontSize: "12px", fontWeight: 700, color: isDark ? "#94a3b8" : "#475569", mb: 1, ml: 0.5, textTransform: "uppercase", letterSpacing: "0.2px" }}>
                Last Name
              </Typography>
              <TextField
                fullWidth
                placeholder="Doe"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                autoComplete="family-name"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start" sx={{ mr: 1.5 }}>
                      <User size={18} color="#3b82f6" />
                    </InputAdornment>
                  ),
                }}
                sx={dynamicInputStyle}
              />
            </Box>

            {/* Email */}
            <Box sx={{ textAlign: "left", mb: 3 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1, ml: 0.5 }}>
                <Typography sx={{ fontSize: "12px", fontWeight: 700, color: isDark ? "#94a3b8" : "#475569", textTransform: "uppercase", letterSpacing: "0.2px" }}>
                  Email Address
                </Typography>
                {isEmailVerified && (
                  <Typography sx={{ fontSize: "12px", fontWeight: 700, color: "#10b981", display: "flex", alignItems: "center", gap: 0.5 }}>
                    <CheckCircle size={14} /> Verified
                  </Typography>
                )}
              </Box>
              <TextField
                fullWidth
                placeholder="john@example.com"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                disabled={isEmailVerified}
                autoComplete="email"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start" sx={{ mr: 1.5 }}>
                      <Mail size={18} color={isEmailVerified ? "#10b981" : "#3b82f6"} />
                    </InputAdornment>
                  ),
                  endAdornment: isEmailVerified ? (
                    <InputAdornment position="end">
                      <Button
                        size="small"
                        onClick={() => {
                          setIsEmailVerified(false);
                          setOtpSent(false);
                          setOtp("");
                        }}
                        sx={{ fontSize: "11px", textTransform: "none", color: isDark ? "#93c5fd" : "#2563eb", p: 0.5 }}
                      >
                        Change
                      </Button>
                    </InputAdornment>
                  ) : null
                }}
                sx={dynamicInputStyle}
              />

              {/* OTP Input Card when sent */}
              {otpSent && !isEmailVerified && (
                <Box sx={{
                  mt: 2,
                  p: 2,
                  borderRadius: "10px",
                  bgcolor: isDark ? "rgba(59, 130, 246, 0.08)" : "rgba(59, 130, 246, 0.05)",
                  border: isDark ? "1px solid rgba(59, 130, 246, 0.25)" : "1px solid rgba(59, 130, 246, 0.2)",
                  textAlign: "left"
                }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                    <Typography sx={{ fontSize: "11px", fontWeight: 700, color: isDark ? "#93c5fd" : "#1d4ed8", textTransform: "uppercase" }}>
                      Enter 6-Digit OTP Code
                    </Typography>
                    {otpTimer > 0 ? (
                      <Typography sx={{ fontSize: "11px", fontWeight: 600, color: isDark ? "#94a3b8" : "#64748b" }}>
                        Expires in {otpTimer}s
                      </Typography>
                    ) : (
                      <Typography sx={{ fontSize: "11px", fontWeight: 700, color: "#ef4444" }}>
                        Expired
                      </Typography>
                    )}
                  </Box>

                  <TextField
                    fullWidth
                    placeholder="••••••"
                    value={otp}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setOtp(val);
                      if (otpError) setOtpError("");
                    }}
                    disabled={otpBlocked || otpVerifying}
                    inputProps={{
                      maxLength: 6,
                      style: {
                        textAlign: "center",
                        letterSpacing: "8px",
                        fontSize: "20px",
                        fontWeight: 700,
                        fontFamily: "monospace",
                        padding: "8px 12px"
                      }
                    }}
                    sx={dynamicInputStyle}
                  />

                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1.5 }}>
                    <Button
                      size="small"
                      disabled={otpSending || (otpTimer > 0 && !otpBlocked)}
                      onClick={handleSendOtp}
                      sx={{ fontSize: "12px", textTransform: "none", color: "#3b82f6", p: 0, minWidth: 0 }}
                    >
                      {otpSending ? "Sending..." : "Resend OTP"}
                    </Button>

                    <Button
                      variant="contained"
                      size="small"
                      disabled={otpVerifying || otpBlocked || otp.trim().length !== 6}
                      onClick={handleVerifyOtp}
                      sx={{ fontSize: "12px", textTransform: "none", px: 2, py: 0.5, borderRadius: 1.5 }}
                    >
                      {otpVerifying ? "Verifying..." : "Verify Code"}
                    </Button>
                  </Box>
                </Box>
              )}
            </Box>

            {/* Phone Number with Country Picker */}
            <Box sx={{ textAlign: "left", mb: 3 }}>
              <Typography sx={{ fontSize: "12px", fontWeight: 700, color: isDark ? "#94a3b8" : "#475569", mb: 1, ml: 0.5, textTransform: "uppercase", letterSpacing: "0.2px" }}>
                Phone Number (Optional)
              </Typography>
              <Box sx={{ position: "relative" }}>
                <PhoneInput
                  defaultCountry="us"
                  value={formData.mobileNumber}
                  onChange={handlePhoneChange}
                  inputProps={{
                    style: {
                      width: "100%",
                      padding: "12px 16px",
                      fontSize: "15px",
                      color: isDark ? "#f8fafc" : "#0f172a",
                      backgroundColor: isDark ? "rgba(15, 23, 42, 0.4)" : "rgba(241, 245, 249, 0.6)",
                      border: isDark ? "1px solid rgba(59, 130, 246, 0.2)" : "1px solid rgba(59, 130, 246, 0.15)",
                      borderRadius: "8px",
                      fontFamily: "inherit",
                      outline: "none",
                    }
                  }}
                />
              </Box>
            </Box>

            {/* Password */}
            <Box sx={{ textAlign: "left", mb: 3 }}>
              <Typography sx={{ fontSize: "12px", fontWeight: 700, color: isDark ? "#94a3b8" : "#475569", mb: 1, ml: 0.5, textTransform: "uppercase", letterSpacing: "0.2px" }}>
                Password
              </Typography>
              <TextField
                fullWidth
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                name="password"
                value={formData.password}
                onChange={handleChange}
                autoComplete="new-password"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start" sx={{ mr: 1.5 }}>
                      <Lock size={18} color="#3b82f6" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        sx={{ color: isDark ? "#94a3b8" : "#475569", "&:hover": { bgcolor: "transparent" } }}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
                sx={dynamicInputStyle}
              />
              <Typography sx={{ fontSize: "11px", color: isDark ? "#64748b" : "#94a3b8", mt: 1, ml: 0.5 }}>
                Password must be at least 6 characters
              </Typography>
            </Box>

            {/* Submit / Verify Button */}
            {!isEmailVerified ? (
              <Button
                fullWidth
                variant="contained"
                disabled={
                  otpSending ||
                  otpVerifying ||
                  !formData.email.trim() ||
                  !validateEmail(formData.email).isValid
                }
                onClick={(e) => {
                  e.preventDefault();
                  if (!otpSent) {
                    handleSendOtp();
                  } else if (otp.trim().length === 6 && !otpBlocked) {
                    handleVerifyOtp();
                  } else if (otpTimer === 0 || otpBlocked) {
                    handleSendOtp();
                  }
                }}
                sx={{
                  py: 1.5,
                  fontSize: "15px",
                  letterSpacing: "0.5px",
                  textTransform: "none",
                  borderRadius: 2,
                  mb: 3
                }}
              >
                {otpSending
                  ? "Sending Verification Code..."
                  : otpSent && otp.trim().length === 6
                  ? (otpVerifying ? "Verifying..." : "Verify OTP")
                  : "Verify Email"}
              </Button>
            ) : (
              <Button
                fullWidth
                variant="contained"
                type="submit"
                disabled={loading}
                sx={{ py: 1.5, fontSize: "15px", letterSpacing: "0.5px", textTransform: "none", borderRadius: 2, mb: 3 }}
              >
                {loading ? "Creating Account..." : "Create Account"}
              </Button>
            )}

            {/* Login Link */}
            <Typography sx={{ fontSize: "14px", color: isDark ? "#94a3b8" : "#475569" }}>
              Already have an account?{" "}
              <Link
                to={
                  searchParams.get("redirect")
                    ? `/login?redirect=${encodeURIComponent(searchParams.get("redirect"))}`
                    : "/login"
                }
                style={{ textDecoration: "none" }}
              >
                <span style={{ color: isDark ? "#60a5fa" : "#2563eb", cursor: "pointer", fontWeight: 600 }}>
                  Sign in
                </span>
              </Link>
            </Typography>
            </form>

          {/* Terms */}
          <Typography sx={{ mt: 5, fontSize: "13px", color: isDark ? "#94a3b8" : "#475569" }}>
            By signing up, you agree to our{" "}
            <span style={{ color: isDark ? "#f8fafc" : "#0f172a", cursor: "pointer", fontWeight: 600 }}>
              Terms of Service
            </span>
          </Typography>
        </Paper>
      </Container>

      {/* Snackbar Alert */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: "100%", boxShadow: 3, fontWeight: 600 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Signup;
