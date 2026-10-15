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
