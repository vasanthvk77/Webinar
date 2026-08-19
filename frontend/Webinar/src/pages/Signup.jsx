import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Box, Typography, TextField, Button,
  Paper, InputAdornment, Container, IconButton, Divider
} from "@mui/material";
import { Mail, Lock, Eye, EyeOff, User, Phone } from "lucide-react";
import toast from "react-hot-toast";
import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";
import { authService } from "../services/api";
import { validateEmail, validatePassword } from "../utils/validation";
import logo from "../assets/logo1.png";

const Signup = ({ mode }) => {
  const isDark = mode === "dark";
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    countryCode: "+1",
    mobileNumber: ""
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validate
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.isValid) {
      setError(emailValidation.error);
      return;
    }

    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.error);
      return;
    }

    if (!formData.firstName.trim()) {
      setError("First name is required");
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
        toast.success("Registration successful!");
        navigate("/dashboard");
      } else {
        setError(response.data.message || "Registration failed");
      }
    } catch (err) {
      setError(err.response?.data?.message || "An error occurred during registration");
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
        setError(response.data.message || "Google signup failed");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Google authentication failed");
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
              <Typography sx={{ fontSize: "12px", fontWeight: 700, color: isDark ? "#94a3b8" : "#475569", mb: 1, ml: 0.5, textTransform: "uppercase", letterSpacing: "0.2px" }}>
                Email Address
              </Typography>
              <TextField
                fullWidth
                placeholder="john@example.com"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
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

            {/* Error message */}
            {error && (
              <Typography sx={{ mb: 3, fontSize: "13px", color: "#ef4444", textAlign: "left" }}>
                ✕ {error}
              </Typography>
            )}

            {/* Submit Button */}
            <Button
              fullWidth
              variant="contained"
              type="submit"
              disabled={loading}
              sx={{ py: 1.5, fontSize: "15px", letterSpacing: "0.5px", textTransform: "none", borderRadius: 2, mb: 3 }}
            >
              {loading ? "Creating Account..." : "Create Account"}
            </Button>

            {/* Login Link */}
            <Typography sx={{ fontSize: "14px", color: isDark ? "#94a3b8" : "#475569" }}>
              Already have an account?{" "}
              <Link to="/login" style={{ textDecoration: "none" }}>
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
    </Box>
  );
};

export default Signup;
