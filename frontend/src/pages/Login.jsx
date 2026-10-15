import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Box, Typography, TextField, Button,
  Paper, InputAdornment, Container, IconButton, Divider
} from "@mui/material";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { authService, tabService } from "../services/api";
import { validateEmail, validatePassword, validateLoginForm } from "../utils/validation";
import { useAuth }   from "../context/AuthContext";
import { colors }    from "../utils/theme";
import logo from "../assets/logo1.png";

// ─────────────────────────────────────────────────────────
// Static tab lists for roles that need no DB lookup:
//   Super Admin (1) → all admin routes (unrestricted)
//   Student     (3) → all student routes (no access control)
//
// Admin (2) → always fetches from GET /api/tabs
//             so UserTabAccess overrides are respected.
// ─────────────────────────────────────────────────────────
const SUPER_ADMIN_ROUTES = [
  '/admin/dashboard',
  '/admin/webinars', '/admin/registrations', '/admin/payments',
  '/admin/participants', '/admin/recordings', '/admin/accounts',
  '/admin/access',
  '/admin/certifications', '/admin/categories', '/admin/webinar-types', '/admin/reminders',
  '/admin/notifications', '/admin/email-templates', '/admin/sms-templates', '/admin/whatsapp-templates',
];

const STUDENT_ROUTES = [
  '/dashboard', '/dashboard/profile', '/dashboard/upcoming',
  '/dashboard/registered', '/dashboard/completed', '/dashboard/certificates',
  '/dashboard/recordings', '/dashboard/payments', '/dashboard/notifications',
];

function getHomeRoute(roleId) {
  return roleId === 3 ? '/dashboard' : '/admin/dashboard';
}

// ─────────────────────────────────────────────────────────
// Minimal user shape stored in AuthContext / localStorage.
// We only keep what the sidebar and guards need:
//   id, firstName, roleId, roleName
// Full profile is available via JWT claims on the backend.
// ─────────────────────────────────────────────────────────
function toMinimalUser(userData) {
  return {
    id:        userData.id,
    firstName: userData.firstName,
    lastName:  userData.lastName,
    email:     userData.email,
    roleId:    userData.roleId,
    roleName:  userData.roleName,
  };
}

// -------------------------------------------------------
// Input field styles — sourced from colors object
// -------------------------------------------------------
const inputStyle = {
  "& .MuiOutlinedInput-root": {
    color: colors.textPrimary,
    backgroundColor: colors.surfaceAlt,
    "& fieldset": {
      borderColor: colors.border,
      borderRadius: "8px",
    },
    "&:hover fieldset": {
      borderColor: colors.primaryMuted,
    },
    "&.Mui-focused fieldset": {
      borderColor: colors.accent,
      borderRadius: "8px",
    },
    "& .MuiInputBase-input": { py: 2 },
  },
  "& .MuiInputBase-input::placeholder": {
    color: colors.textMuted,
    opacity: 1,
  },
};

const Login = () => {
  const navigate  = useNavigate();
  const { login } = useAuth();

  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const [emailError, setEmailError]     = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [step, setStep]                 = useState("providers");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setEmailError(""); setPasswordError("");

    const validation = validateLoginForm(email, password);
    if (!validation.isValid) {
      if (validateEmail(email).error)       setEmailError(validateEmail(email).error);
      if (validatePassword(password).error) setPasswordError(validatePassword(password).error);
      return;
    }

    setLoading(true);
    try {
      const response = await authService.login(email, password);
      if (response.data.success) {
        const { user: userData, token } = response.data;
        const minUser = toMinimalUser(userData);

        // Store token first so the tab-fetch request can attach it
        localStorage.setItem('token', token);

        let tabs;
        if (userData.roleId === 1) {
          tabs = SUPER_ADMIN_ROUTES;
        } else if (userData.roleId === 3) {
          tabs = STUDENT_ROUTES;
        } else {
          // Admin (roleId=2) — fetch real permissions from DB
          try {
            const tabRes = await tabService.getMyTabs();
            tabs = tabRes.data.success ? tabRes.data.routes : STUDENT_ROUTES;
          } catch {
            tabs = [];
          }
        }

        login(minUser, token, tabs);
        toast.success(`Welcome back, ${userData.firstName}`);
        navigate(getHomeRoute(userData.roleId), { replace: true });
      } else {
        setError(response.data.message || "Login failed");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Invalid credentials or server error");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError("");
    setLoading(true);
    try {
      const response = await authService.googleLogin(credentialResponse.credential);
      if (response.data.success) {
        const { user: userData, token } = response.data;
        const minUser = toMinimalUser(userData);

        localStorage.setItem('token', token);

        let tabs;
        if (userData.roleId === 1) {
          tabs = SUPER_ADMIN_ROUTES;
        } else if (userData.roleId === 3) {
          tabs = STUDENT_ROUTES;
        } else {
          try {
            const tabRes = await tabService.getMyTabs();
            tabs = tabRes.data.success ? tabRes.data.routes : [];
          } catch {
            tabs = [];
          }
        }

        login(minUser, token, tabs);
        toast.success(`Welcome, ${userData.firstName}!`);
        navigate(getHomeRoute(userData.roleId), { replace: true });
      } else {
        setError(response.data.message || "Google login failed");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Google authentication failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (window.google && step === "providers") {
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: handleGoogleSuccess,
      });
      window.google.accounts.id.renderButton(
        document.getElementById("google_signin_button"),
        { theme: "light", size: "large", width: "100%", text: "continue_with" }
      );
    }
  }, [step]);

  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        bgcolor: colors.bg,
        position: "relative",
        overflow: "hidden",
        // Subtle brand-colored radial glow using primary + accent
        backgroundImage: `
          radial-gradient(at 0% 0%,   rgba(30,41,59,0.06)   0px, transparent 50%),
          radial-gradient(at 100% 100%, rgba(234,179,8,0.08) 0px, transparent 50%)
        `,
      }}
    >
      {/* Background blob — accent color */}
      <Box
        sx={{
          position: "absolute",
          top: "20%", left: "10%",
          width: "400px", height: "400px",
          background: `linear-gradient(135deg, rgba(234,179,8,0.08) 0%, rgba(30,41,59,0.06) 100%)`,
          filter: "blur(100px)",
          borderRadius: "50%",
          animation: "pulse 10s infinite alternate",
          pointerEvents: "none",
        }}
      />

      <Container maxWidth="sm" sx={{ display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1 }}>
        <Paper
          elevation={0}
          sx={{
            p: 5, width: "100%", maxWidth: 440,
            bgcolor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 3,
            boxShadow: `0 20px 40px rgba(30,41,59,0.08)`,
            textAlign: "center",
          }}
        >
          {/* Logo */}
          <Box sx={{ mb: 4, display: "flex", justifyContent: "center" }}>
            <img src={logo} alt="Logo" style={{ height: "140px", objectFit: "contain" }} />
          </Box>

          {/* Back button */}
          {step === "credentials" && (
            <Box sx={{ mb: 3, ml: -2 }}>
              <Button
                onClick={() => setStep("providers")}
                sx={{
                  textTransform: "none",
                  color: colors.accent,
                  fontSize: "14px", fontWeight: 600, p: 0,
                  "&:hover": { textDecoration: "underline", bgcolor: "transparent" },
                }}
              >
                ← Back
              </Button>
            </Box>
          )}

          {/* Title */}
          <Typography
            variant="h4"
            sx={{ color: colors.primary, fontSize: "25px", fontWeight: 700, mb: 1, letterSpacing: "-0.5px" }}
          >
            {step === "providers" ? "Log in to Webinar" : "Email & Password"}
          </Typography>
          <Typography sx={{ color: colors.textSecondary, mb: 5, fontWeight: 500, fontSize: "14px" }}>
            {step === "providers" ? "Choose login method" : "Enter your credentials"}
          </Typography>

          {/* ── PROVIDERS STEP ── */}
          {step === "providers" && (
            <>
              <Box id="google_signin_button" sx={{ display: "flex", justifyContent: "center", mb: 2 }} />

              <Divider sx={{ my: 3, borderColor: colors.borderMid, color: colors.textMuted, fontSize: "13px" }}>
                Or
              </Divider>

              <Button
                fullWidth
                variant="contained"
                onClick={() => setStep("credentials")}
                sx={{
                  py: 1.5, fontSize: "15px", borderRadius: 2,
                  bgcolor: colors.primary, color: colors.textOnDark,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 1.5,
                  "&:hover": { bgcolor: colors.primaryLight },
                }}
              >
                <Mail size={18} />
                Continue with Email
              </Button>

              <Typography sx={{ mt: 5, fontSize: "14px", color: colors.textSecondary }}>
                Don't have an account?{" "}
                <Link to="/signup" style={{ textDecoration: "none" }}>
                  <span style={{ color: colors.accent, fontWeight: 700, cursor: "pointer" }}>
                    Sign up
                  </span>
                </Link>
              </Typography>
            </>
          )}

          {/* ── CREDENTIALS STEP ── */}
          {step === "credentials" && (
            <form onSubmit={handleSubmit}>
              {/* Email field */}
              <Box sx={{ textAlign: "left", mb: 3 }}>
                <Typography sx={{ fontSize: "12px", fontWeight: 700, color: colors.textSecondary, mb: 1, ml: 0.5, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Email Address
                </Typography>
                <TextField
                  fullWidth
                  placeholder="admin@webinar.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                  error={!!emailError}
                  helperText={emailError}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 1.5 }}>
                        <Mail size={18} color={colors.accent} />
                      </InputAdornment>
                    ),
                  }}
                  sx={inputStyle}
                />
              </Box>

              {/* Password field */}
              <Box sx={{ textAlign: "left", mb: 4 }}>
                <Typography sx={{ fontSize: "12px", fontWeight: 700, color: colors.textSecondary, mb: 1, ml: 0.5, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Password
                </Typography>
                <TextField
                  fullWidth
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  error={!!passwordError}
                  helperText={passwordError}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 1.5 }}>
                        <Lock size={18} color={colors.accent} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          tabIndex={-1}
                          sx={{ color: colors.textMuted, "&:hover": { bgcolor: "transparent" } }}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={inputStyle}
                />
              </Box>

              {/* Error */}
              {error && (
                <Typography sx={{ mb: 2, fontSize: "13px", color: colors.error, textAlign: "left" }}>
                  {error}
                </Typography>
              )}

              {/* Submit */}
              <Button
                fullWidth
                variant="contained"
                type="submit"
                disabled={loading}
                sx={{
                  py: 1.5, fontSize: "15px", borderRadius: 2,
                  bgcolor: colors.accent, color: colors.textOnAccent,
                  fontWeight: 700,
                  "&:hover": { bgcolor: colors.accentDark },
                  "&:disabled": { bgcolor: colors.accentLight, color: colors.primaryMuted },
                }}
              >
                {loading ? "Authenticating..." : "Sign in to Account"}
              </Button>
            </form>
          )}
        </Paper>
      </Container>
    </Box>
  );
};

export default Login;
