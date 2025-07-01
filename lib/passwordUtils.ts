// lib/passwordUtils.ts
// Utility for password complexity validation

// Password policy types
export type PasswordPolicy = 'basic' | 'medium' | 'strong' | 'very-strong';

/**
 * Gets the current password policy from localStorage or uses the default
 */
export function getCurrentPasswordPolicy(): PasswordPolicy {
  if (typeof window === 'undefined') return 'strong';
  
  const savedPolicy = localStorage.getItem('password_policy') as PasswordPolicy;
  if (savedPolicy && ['basic', 'medium', 'strong', 'very-strong'].includes(savedPolicy)) {
    return savedPolicy;
  }
  
  return 'strong'; // Default policy
}

/**
 * Checks if a password meets complexity requirements based on the policy
 * Returns true if valid, false otherwise.
 */
export function isPasswordComplex(password: string, policy?: PasswordPolicy): boolean {
  // Use provided policy or get from localStorage
  const effectivePolicy = policy || getCurrentPasswordPolicy();
  
  switch (effectivePolicy) {
    case 'basic':
      // At least 8 characters
      return password.length >= 8;
    
    case 'medium':
      // At least 8 characters and 1 number
      return password.length >= 8 && /[0-9]/.test(password);
    
    case 'strong':
      // At least 8 characters, 1 number, and 1 special character
      return (
        password.length >= 8 &&
        /[0-9]/.test(password) &&
        /[^A-Za-z0-9]/.test(password)
      );
    
    case 'very-strong':
      // At least 12 characters, uppercase, lowercase, number, and special character
      return (
        password.length >= 12 &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /[0-9]/.test(password) &&
        /[^A-Za-z0-9]/.test(password)
      );
    
    default:
      return isPasswordComplex(password, 'strong');
  }
}

/**
 * Returns a human-readable message for password requirements based on policy.
 */
export function passwordComplexityMessage(policy?: PasswordPolicy): string {
  // Use provided policy or get from localStorage
  const effectivePolicy = policy || getCurrentPasswordPolicy();
  
  switch (effectivePolicy) {
    case 'basic':
      return 'Password must be at least 8 characters long.';
    
    case 'medium':
      return 'Password must be at least 8 characters long and include at least one number.';
    
    case 'strong':
      return 'Password must be at least 8 characters long and include at least one number and one special character.';
    
    case 'very-strong':
  return 'Password must be at least 12 characters long and include uppercase, lowercase, number, and special character.';
    
    default:
      return passwordComplexityMessage('strong');
  }
} 