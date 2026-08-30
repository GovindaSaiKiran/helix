/**
 * Password Security & Validation Utilities
 * Enforces strong password criteria for student accounts.
 */

export interface PasswordRules {
  minLength: boolean;      // >= 8 characters
  hasUppercase: boolean;   // At least 1 uppercase (A-Z)
  hasLowercase: boolean;   // At least 1 lowercase (a-z)
  hasNumber: boolean;      // At least 1 number (0-9)
  hasSpecialChar: boolean; // At least 1 special symbol (!@#$%^&*...)
}

export interface PasswordValidationResult {
  isValid: boolean;
  score: number; // 0 to 5
  strength: 'weak' | 'fair' | 'good' | 'strong';
  rules: PasswordRules;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidationResult {
  const minLength = (password || '').length >= 8;
  const hasUppercase = /[A-Z]/.test(password || '');
  const hasLowercase = /[a-z]/.test(password || '');
  const hasNumber = /[0-9]/.test(password || '');
  const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password || '');

  const rules: PasswordRules = {
    minLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecialChar,
  };

  const score = [minLength, hasUppercase, hasLowercase, hasNumber, hasSpecialChar].filter(Boolean).length;

  const errors: string[] = [];
  if (!minLength) errors.push('At least 8 characters');
  if (!hasUppercase) errors.push('At least one uppercase letter (A-Z)');
  if (!hasLowercase) errors.push('At least one lowercase letter (a-z)');
  if (!hasNumber) errors.push('At least one number (0-9)');
  if (!hasSpecialChar) errors.push('At least one special symbol (!@#$%^&*)');

  let strength: 'weak' | 'fair' | 'good' | 'strong' = 'weak';
  if (score >= 5) {
    strength = 'strong';
  } else if (score === 4) {
    strength = 'good';
  } else if (score >= 2) {
    strength = 'fair';
  }

  return {
    isValid: score === 5,
    score,
    strength,
    rules,
    errors,
  };
}

export function getStrengthColor(strength: 'weak' | 'fair' | 'good' | 'strong'): {
  color: string;
  bgColor: string;
  label: string;
} {
  switch (strength) {
    case 'strong':
      return { color: 'text-emerald-600', bgColor: 'bg-emerald-500', label: 'Strong' };
    case 'good':
      return { color: 'text-blue-600', bgColor: 'bg-blue-500', label: 'Good' };
    case 'fair':
      return { color: 'text-amber-600', bgColor: 'bg-amber-500', label: 'Fair' };
    case 'weak':
    default:
      return { color: 'text-rose-600', bgColor: 'bg-rose-500', label: 'Weak' };
  }
}
