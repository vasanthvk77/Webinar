import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Box, Typography, TextField, Button, Paper, InputAdornment, Container, IconButton } from "@mui/material";
import { Mail, Lock, Sun, Moon, Eye, EyeOff } from "lucide-react";
import { login, logActivity } from "../utils/api";
import { setToken, getCurrentUser } from "../utils/auth";
import toast from "react-hot-toast";
import logoLight from "../assets/PNG/ProdesX logo Balanced 05.png";
import logoDark from "../assets/PNG/ProdesX logo Balanced 06.png";

const Login = ({ mode, toggleMode }) => {
    const isDark = mode === 'dark';
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await login(email, password);
            setToken(response.token);
            const user = getCurrentUser();

            // Log user login activity
            if (user) {
                try {
                    await logActivity({
                        action: "LOGIN",
                        module: "AUTH",
                        description: `${user.name} logged in`,
                        changes: null
                    });
                } catch (err) {
                    console.error("Failed to log login activity:", err);
                }
            }

            toast.success(`Welcome back, ${user?.name || 'User'}`);
            navigate("/dashboard");
        } catch (error) {
            toast.error("Invalid credentials or server error");
        } finally {
            setLoading(false);
        }
    };

    const dynamicInputStyle = {
        "& .MuiOutlinedInput-root": {
            color: isDark ? "#f8fafc" : "#0f172a",
            backgroundColor: isDark ? "rgba(15, 23, 42, 0.4)" : "rgba(241, 245, 249, 0.6)",
            "& fieldset": { borderColor: isDark ? "rgba(59, 130, 246, 0.2)" : "rgba(59, 130, 246, 0.15)" },
            "&:hover fieldset": { borderColor: isDark ? "rgba(59, 130, 246, 0.45)" : "rgba(59, 130, 246, 0.3)" },
            "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
            "& .MuiInputBase-input": {
                py: 2,
            }
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
            backgroundImage: isDark ? `
                radial-gradient(at 0% 0%, rgba(59, 130, 246, 0.12) 0px, transparent 50%),
                radial-gradient(at 100% 100%, rgba(37, 99, 235, 0.1) 0px, transparent 50%)
            ` : `
                radial-gradient(at 0% 0%, rgba(59, 130, 246, 0.08) 0px, transparent 50%),
                radial-gradient(at 100% 100%, rgba(37, 99, 235, 0.05) 0px, transparent 50%)
            `
        }}>

            {/* Animated Background Element */}
            <Box sx={{
                position: "absolute",
                top: "20%",
                left: "10%",
                width: "400px",
                height: "400px",
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
                    <Box sx={{ mb: 4, display: "flex", justifyContent: "center" }}>
                        <img
                            src={isDark ? logoDark : logoLight}
                            alt="ProdesX Logo"
                            style={{
                                height: "90px",
                                objectFit: "contain",
                                filter: isDark ? "drop-shadow(0 4px 12px rgba(59, 130, 246, 0.15))" : "none"
                            }}
                        />
                    </Box>

                    <Typography variant="h4" sx={{ color: isDark ? "#ffffff" : "#0f172a", fontWeight: 800, mb: 1, letterSpacing: "-1px" }}>
                        ProdesX CRM
                    </Typography>
                    <Typography variant="body2" sx={{ color: isDark ? "#94a3b8" : "#475569", mb: 5 }}>
                        <b>Sign In</b>
                    </Typography>

                    <form onSubmit={handleSubmit}>
                        <Box sx={{ textAlign: "left", mb: 3 }}>
                            <Typography sx={{ fontSize: "12px", fontWeight: 700, color: isDark ? "#94a3b8" : "#475569", mb: 1, ml: 0.5, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                Email Address
                            </Typography>
                            <TextField
                                fullWidth
                                placeholder="name@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
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

                        <Box sx={{ textAlign: "left", mb: 4 }}>
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                                <Typography sx={{ fontSize: "12px", fontWeight: 700, color: isDark ? "#94a3b8" : "#475569", ml: 0.5, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                    Password
                                </Typography>
                                <Link to="/forget-password" style={{ textDecoration: "none" }}>
                                    <Typography sx={{ fontSize: "12px", fontWeight: 600, color: isDark ? "#60a5fa" : "#2563eb", "&:hover": { textDecoration: "underline" } }}>
                                        Forgot?
                                    </Typography>
                                </Link>
                            </Box>
                            <TextField
                                fullWidth
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
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
                                                sx={{ color: isDark ? "#94a3b8" : "#475569" }}
                                            >
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }}
                                sx={dynamicInputStyle}
                            />
                        </Box>

                        <Button
                            fullWidth
                            variant="contained"
                            type="submit"
                            disabled={loading}
                            sx={{
                                py: 1.5,
                                fontSize: "15px",
                                letterSpacing: "0.5px"
                            }}
                        >
                            {loading ? "Authenticating..." : "Sign in to Account"}
                        </Button>
                    </form>

                    <Typography sx={{ mt: 5, fontSize: "13px", color: isDark ? "#94a3b8" : "#475569" }}>
                        By signing in, you agree to our <span style={{ color: isDark ? "#f8fafc" : "#0f172a", cursor: "pointer", fontWeight: 600 }}>Terms of Service</span>
                    </Typography>
                </Paper>
            </Container>

            <style>
                {`
                    @keyframes pulse {
                        0% { transform: scale(1) translate(0, 0); opacity: 0.5; }
                        100% { transform: scale(1.2) translate(5%, 5%); opacity: 0.8; }
                    }
                    input::-ms-reveal,
                    input::-ms-clear {
                        display: none;
                    }
                    input:-webkit-autofill,
                    input:-webkit-autofill:hover, 
                    input:-webkit-autofill:focus,
                    input:-webkit-autofill:active {
                        -webkit-box-shadow: 0 0 0 1000px ${isDark ? '#131620' : '#ffffff'} inset !important;
                        -webkit-text-fill-color: ${isDark ? '#f8fafc' : '#0f172a'} !important;
                        transition: background-color 5000s ease-in-out 0s;
                    }
                `}
            </style>
        </Box>
    );
};

export default Login;
