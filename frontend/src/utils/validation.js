/**
 * Custom Validation Module
 * Handles email and password validation for login forms
 */

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {object} - { isValid: boolean, error: string }
 */
export const validateEmail = (email) => {
  if (!email || email.trim() === "") {
    return {
      isValid: false,
      error: "Email address is required"
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      isValid: false,
      error: "Please enter a valid email address"
    };
  }

  return {
    isValid: true,
    error: ""
  };
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} - { isValid: boolean, error: string }
 */
export const validatePassword = (password) => {
  if (!password || password.trim() === "") {
    return {
      isValid: false,
      error: "Password is required"
    };
  }

  if (password.length < 6) {
    return {
      isValid: false,
      error: "Password must be at least 6 characters long"
    };
  }

  return {
    isValid: true,
    error: ""
  };
};

/**
 * Validate both email and password
 * @param {string} email - Email to validate
 * @param {string} password - Password to validate
 * @returns {object} - { isValid: boolean, error: string }
 */
export const validateLoginForm = (email, password) => {
  const emailValidation = validateEmail(email);
  if (!emailValidation.isValid) {
    return emailValidation;
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    return passwordValidation;
  }

  return {
    isValid: true,
    error: ""
  };
};

/**
 * Convert UTC timestamp to user's browser local time.
 * Handles UTC strings with or without 'Z' suffix to guarantee
 * proper UTC parsing and converts to browser local timezone.
 *
 * @param {string|Date} utcDateStr - UTC date/time string from database
 * @param {object} [options] - Optional Intl.DateTimeFormat options
 * @returns {string} - Formatted browser local date/time string
 */
export const formatUtcToLocal = (utcDateStr, options = null) => {
  if (!utcDateStr) return '—';

  try {
    let dateInput = utcDateStr;
    if (typeof utcDateStr === 'string') {
      let str = utcDateStr.trim();
      // Normalize SQL datetime string "YYYY-MM-DD HH:mm:ss" to ISO "YYYY-MM-DDTHH:mm:ss"
      if (str.includes(' ') && !str.includes('T')) {
        str = str.replace(' ', 'T');
      }
      // If no timezone indicator ('Z' or offset), append 'Z' so it is strictly parsed as UTC
      if (!str.endsWith('Z') && !str.includes('+') && !/-\d{2}:\d{2}$/.test(str)) {
        str = `${str}Z`;
      }
      dateInput = str;
    }

    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(utcDateStr);

    const defaultOptions = options || {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    };

    return d.toLocaleString([], defaultOptions);
  } catch {
    return String(utcDateStr);
  }
};

/**
 * Convert UTC timestamp to browser local date only (e.g. "Nov 4, 2026")
 */
export const formatUtcToLocalDateOnly = (utcDateStr) => {
  return formatUtcToLocal(utcDateStr, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

/**
 * Convert UTC timestamp to browser local time only (e.g. "01:45 PM")
 */
export const formatUtcToLocalTimeOnly = (utcDateStr) => {
  return formatUtcToLocal(utcDateStr, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Convert UTC timestamp to browser local date as "DD-MM-YYYY" (e.g. "04-11-2026")
 */
export const formatUtcToLocalDateDDMMYYYY = (utcDateStr) => {
  if (!utcDateStr) return '—';
  try {
    let str = String(utcDateStr).trim();
    if (str.includes(' ') && !str.includes('T')) {
      str = str.replace(' ', 'T');
    }
    if (!str.endsWith('Z') && !str.includes('+') && !/-\d{2}:\d{2}$/.test(str)) {
      str = `${str}Z`;
    }
    const d = new Date(str);
    if (isNaN(d.getTime())) return String(utcDateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const y = d.getFullYear();
    return `${day}-${m}-${y}`;
  } catch {
    return String(utcDateStr);
  }
};

/**
 * Convert UTC timestamp to browser local 24-hour time "HH:mm" (for time pickers)
 */
export const formatUtcToLocalTime24 = (utcDateStr) => {
  if (!utcDateStr) return '';
  try {
    let str = String(utcDateStr).trim();
    if (str.includes(' ') && !str.includes('T')) {
      str = str.replace(' ', 'T');
    }
    if (!str.endsWith('Z') && !str.includes('+') && !/-\d{2}:\d{2}$/.test(str)) {
      str = `${str}Z`;
    }
    const d = new Date(str);
    if (isNaN(d.getTime())) return '';
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  } catch {
    return '';
  }
};

/**
 * Convert UTC timestamp to browser local "YYYY-MM-DD" date string (for date pickers)
 */
export const formatUtcToLocalDateInput = (utcDateStr) => {
  if (!utcDateStr) return '';
  try {
    let str = String(utcDateStr).trim();
    if (str.includes(' ') && !str.includes('T')) {
      str = str.replace(' ', 'T');
    }
    if (!str.endsWith('Z') && !str.includes('+') && !/-\d{2}:\d{2}$/.test(str)) {
      str = `${str}Z`;
    }
    const d = new Date(str);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    return '';
  }
};
