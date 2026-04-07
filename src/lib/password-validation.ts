import zxcvbn from 'zxcvbn'

export interface PasswordStrength {
  score: number // 0-4
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Good' | 'Strong'
  color: 'destructive' | 'orange' | 'yellow' | 'blue' | 'green'
  feedback: string[]
}

export interface PasswordValidationResult {
  isValid: boolean
  errors: string[]
  strength?: PasswordStrength
}

/**
 * Validate password with strength checking
 */
export function validatePassword(
  password: string,
  options: {
    minLength?: number
    requireUppercase?: boolean
    requireLowercase?: boolean
    requireNumber?: boolean
    requireSpecial?: boolean
    minStrength?: number // 0-4
    userInputs?: string[] // Additional inputs to check against (email, name, etc.)
  } = {}
): PasswordValidationResult {
  const {
    minLength = 12,
    requireUppercase = true,
    requireLowercase = true,
    requireNumber = true,
    requireSpecial = true,
    minStrength = 2,
    userInputs = [],
  } = options

  const errors: string[] = []

  // Basic length check
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters`)
  }

  // Complexity checks
  if (requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  if (requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  if (requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  if (requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }

  // Check strength using zxcvbn
  const strengthResult = zxcvbn(password, userInputs)
  const strength: PasswordStrength = {
    score: strengthResult.score,
    label: ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'][strengthResult.score] as PasswordStrength['label'],
    color: ['destructive', 'orange', 'yellow', 'blue', 'green'][strengthResult.score] as PasswordStrength['color'],
    feedback: strengthResult.feedback.suggestions || [],
  }

  // Check minimum strength
  if (strengthResult.score < minStrength) {
    errors.push(`Password is too weak. ${strengthResult.feedback.warning || 'Please choose a stronger password.'}`)
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength,
  }
}

/**
 * Get password strength for UI display
 */
export function getPasswordStrength(password: string, userInputs: string[] = []): PasswordStrength {
  if (!password) {
    return {
      score: 0,
      label: 'Very Weak',
      color: 'destructive',
      feedback: [],
    }
  }

  const result = zxcvbn(password, userInputs)
  return {
    score: result.score,
    label: ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'][result.score] as PasswordStrength['label'],
    color: ['destructive', 'orange', 'yellow', 'blue', 'green'][result.score] as PasswordStrength['color'],
    feedback: result.feedback.suggestions || [],
  }
}

