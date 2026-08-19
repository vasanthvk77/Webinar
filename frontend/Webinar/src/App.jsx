import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { createTheme, ThemeProvider, CssBaseline } from '@mui/material';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Signup from './pages/Signup';

function isLoggedIn() {
  return Boolean(localStorage.getItem('token'));
}

function PrivateRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const [mode, setMode] = useState('light');

  const theme = createTheme({ palette: { mode } });

  const toggleMode = () => setMode(m => m === 'light' ? 'dark' : 'light');

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Toaster position="top-right" reverseOrder={false} />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login mode={mode} toggleMode={toggleMode} />} />
          <Route path="/signup" element={<Signup mode={mode} />} />

          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
                  <h2>Dashboard</h2>
                  <p>Welcome, {localStorage.getItem('firstName')}!</p>
                  <button onClick={() => { localStorage.clear(); window.location.href = '/login'; }}>
                    Logout
                  </button>
                </div>
              </PrivateRoute>
            }
          />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
