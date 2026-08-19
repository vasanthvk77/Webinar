import axios from 'axios';

// Base URL comes from .env file — never hardcoded
// In .env: VITE_API_BASE_URL=https://localhost:7001
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Automatically attach the JWT token to every request if one is stored
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth service with all authentication endpoints
export const authService = {
  // POST /api/auth/register
  // Sends { firstName, lastName, email, password, countryCode, mobileNumber }
  // Returns { success, message, user, token }
  register: (firstName, lastName, email, password, countryCode, mobileNumber) =>
    api.post('/api/auth/register', {
      firstName,
      lastName,
      email,
      password,
      countryCode,
      mobileNumber
    }),

  // POST /api/auth/login
  // Sends { email, password }
  // Returns { success, message, user, token }
  login: (email, password) =>
    api.post('/api/auth/login', { email, password }),

  // POST /api/auth/google
  // Sends { token } - Google ID token from frontend
  // Returns { success, message, user, token }
  googleLogin: (googleToken) =>
    api.post('/api/auth/google', { token: googleToken })
};

export default api;

