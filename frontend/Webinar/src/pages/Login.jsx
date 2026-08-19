import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Box, Typography, TextField, Button,
  Paper, InputAdornment, Container, IconButton, Divider
} from "@mui/material";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { authService } from "../services/api";
import { validateEmail, validatePassword, validateLoginForm } from "../utils/validation";
import logo from "../assets/logo1.png";

const Login = ({ mode, toggleMode }) => {
  const isDark = mode === "dark";
  const navigate = useNavigate();

  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const [emailError, setEmailError]     = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [step, setStep]                 = useState("providers"); // "providers" or "credentials"

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setEmailError("");
    setPasswordError("");
    
    // Validate form using custom validation
    const validation = validateLoginForm(email, password);
    if (!validation.isValid) {
      if (validateEmail(email).error) setEmailError(validateEmail(email).error);
      if (validatePassword(password).error) setPasswordError(validatePassword(password).error);
      return;
    }
    
    setLoading(true);
    try {
      const response = await authService.login(email, password);
      
      if (response.data.success) {
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user));
        localStorage.setItem("firstName", response.data.user.firstName);
        
        toast.success(`Welcome back, ${response.data.user.firstName}`);
        navigate("/dashboard");
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
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user));
        localStorage.setItem("firstName", response.data.user.firstName);
        
        toast.success(`Welcome, ${response.data.user.firstName}!`);
        navigate("/dashboard");
      } else {
        setError(response.data.message || "Google login failed");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Google authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError("Google authentication failed. Please try again.");
  };

  useEffect(() => {
    if (window.google && step === "providers") {
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: handleGoogleSuccess,
      });
      window.google.accounts.id.renderButton(
        document.getElementById("google_signin_button"),
        {
          theme: isDark ? "dark" : "light",
          size: "large",
          width: "100%",
          text: "continue_with"
        }
      );
    }
  }, [step, isDark]);

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
          maxWidth: 440,
          bgcolor: isDark ? "rgba(19, 22, 32, 0.65)" : "rgba(255, 255, 255, 0.8)",
          backdropFilter: "blur(20px)",
          border: isDark ? "1px solid rgba(59, 130, 246, 0.15)" : "1px solid rgba(59, 130, 246, 0.12)",
          borderRadius: 3,
          boxShadow: isDark ? "0 20px 40px rgba(0, 0, 0, 0.4)" : "0 20px 40px rgba(59, 130, 246, 0.08)",
          textAlign: "center"
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

          {/* Back button for credentials step */}
          {step === "credentials" && (
            <Box sx={{ mb: 3, ml: -2 }}>
              <Button
                onClick={() => setStep("providers")}
                sx={{
                  textTransform: "none",
                  color: isDark ? "#60a5fa" : "#2563eb",
                  fontSize: "14px",
                  fontWeight: 500,
                  p: 0,
                  "&:hover": { textDecoration: "underline" }
                }}
              >
                ← Back
              </Button>
            </Box>
          )}

          {/* Title */}
          <Typography variant="h4" sx={{ color: isDark ? "#ffffff" : "#0f172a", fontSize: "25px", fontWeight: 600, mb: 1, letterSpacing: "-1px" }}>
            {step === "providers" ? "Log in to Webinar" : "Email & Password"}
          </Typography>
          <Typography variant="body2" sx={{ color: isDark ? "#94a3b8" : "#475569", mb: 5 }}>
            <b>{step === "providers" ? "Choose login method" : "Enter your credentials"}</b>
          </Typography>

          {/* PROVIDERS STEP */}
          {step === "providers" && (
            <>
              {/* Google Button */}
              <Box
                id="google_signin_button"
                sx={{ display: "flex", justifyContent: "center", mb: 2 }}
              />

              <Divider sx={{ my: 3, color: isDark ? "#334155" : "#cbd5e1" }}>Or</Divider>

              {/* Email Button */}
              <Button
                fullWidth
                variant="contained"
                onClick={() => setStep("credentials")}
                sx={{
                  py: 1.5,
                  fontSize: "15px",
                  letterSpacing: "0.5px",
                  textTransform: "none",
                  borderRadius: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1.5
                }}
              >
                <Mail size={18} />
                Continue with Email
              </Button>

              {/* Sign Up Link */}
              <Typography sx={{ mt: 5, fontSize: "14px", color: isDark ? "#94a3b8" : "#475569" }}>
                Don't have an account?{" "}
                <Link to="/signup" style={{ textDecoration: "none" }}>
                  <span style={{ color: isDark ? "#60a5fa" : "#2563eb", cursor: "pointer", fontWeight: 600, "&:hover": { textDecoration: "underline" } }}>
                    Sign up
                  </span>
                </Link>
              </Typography>
            </>
          )}

          {/* CREDENTIALS STEP */}
          {step === "credentials" && (
            <form onSubmit={handleSubmit}>

            {/* Email */}
            <Box sx={{ textAlign: "left", mb: 3 }}>
              <Typography sx={{ fontSize: "12px", fontWeight: 700, color: isDark ? "#94a3b8" : "#475569", mb: 1, ml: 0.5, textTransform: "uppercase", letterSpacing: "0.5px" }}>
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
                      <Mail size={18} color="#3b82f6" />
                    </InputAdornment>
                  ),
                }}
                sx={dynamicInputStyle}
              />
            </Box>

            {/* Password */}
            <Box sx={{ textAlign: "left", mb: 4 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography sx={{ fontSize: "12px", fontWeight: 700, color: isDark ? "#94a3b8" : "#475569", ml: 0.5, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Password
                </Typography>
              </Box>
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
            </Box>

            {/* Error message */}
            {error && (
              <Typography sx={{ mb: 2, fontSize: "13px", color: "#ef4444", textAlign: "left" }}>
                {error}
              </Typography>
            )}

            {/* Submit */}
            <Button
              fullWidth
              variant="contained"
              type="submit"
              disabled={loading}
              sx={{ py: 1.5, fontSize: "15px", letterSpacing: "0.5px", textTransform: "none", borderRadius: 2 }}
            >
              {loading ? "Authenticating..." : "Sign in to Account"}
            </Button>

            </form>
          )}

          {/* Terms - always visible */}
          {/* <Typography sx={{ mt: 5, fontSize: "13px", color: isDark ? "#94a3b8" : "#475569" }}>
          

            By signing in, you agree to our{" "}
            <span style={{ color: isDark ? "#f8fafc" : "#0f172a", cursor: "pointer", fontWeight: 600 }}>
              Terms of Service
            </span>
          </Typography> */}


        </Paper>
      </Container>
    </Box>
  );
};

export default Login;
