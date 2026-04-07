/**
 * Environment variable validation
 * Validates all required environment variables lazily (only when accessed)
 * This allows the build process to complete without requiring env vars
 */

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue
  
  // During build time, return defaults instead of throwing errors
  // This allows Next.js build to complete without requiring env vars
  // Runtime validation will happen when the app actually runs
  if (!value) {
    // Check if we're in build phase (Next.js sets this during build)
    const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' ||
                        process.env.NEXT_PHASE === 'phase-development-build' ||
                        (typeof process.env.VERCEL === 'undefined' && !process.env.VERCEL_ENV)
    
    if (isBuildPhase) {
      return defaultValue || ''
    }
    
    throw new Error(`Missing required environment variable: ${key}`)
  }
  
  return value
}

function getEnvVarOptional(key: string, defaultValue?: string): string | undefined {
  return process.env[key] || defaultValue
}

// Check if we're in build phase
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' || 
                     process.env.NEXT_PHASE === 'phase-development-build'

export const env = {
  // Database
  get DB_HOST() { return getEnvVar('DB_HOST') },
  get DB_PORT() { return parseInt(getEnvVar('DB_PORT', '4000')) },
  get DB_USER() { return getEnvVar('DB_USER') },
  get DB_PASSWORD() { return getEnvVar('DB_PASSWORD') },
  get DB_NAME() { return getEnvVar('DB_NAME', 'afya_solar') },
  get DB_SSL() { return getEnvVarOptional('DB_SSL', 'true') === 'true' },
  get DB_CA_PATH() { return getEnvVarOptional('DB_CA_PATH') },
  
  // NextAuth
  get NEXTAUTH_SECRET() { return getEnvVar('NEXTAUTH_SECRET') },
  get NEXTAUTH_URL() { 
    // Priority: 1. Explicit NEXTAUTH_URL, 2. Vercel production (use custom domain), 3. Localhost for dev
    if (process.env.NEXTAUTH_URL) {
      return process.env.NEXTAUTH_URL
    }
    // If running on Vercel (production), use the custom domain
    if (process.env.VERCEL || process.env.VERCEL_ENV === 'production') {
      return 'https://afyasolar.ubuntuafyalink.co.tz'
    }
    // Use localhost for local development
    return 'http://localhost:3000'
  },
  
  // Node Environment
  get NODE_ENV() { return getEnvVarOptional('NODE_ENV', 'development') as 'development' | 'production' | 'test' },
  
  // Optional: Email service (for future email verification)
  get SMTP_HOST() { return getEnvVarOptional('SMTP_HOST') },
  get SMTP_PORT() { return getEnvVarOptional('SMTP_PORT') },
  get SMTP_USER() { return getEnvVarOptional('SMTP_USER') },
  get SMTP_PASSWORD() { return getEnvVarOptional('SMTP_PASSWORD') },
  
  // Optional: Rate limiting
  get RATE_LIMIT_ENABLED() { return getEnvVarOptional('RATE_LIMIT_ENABLED', 'true') === 'true' },
  
  // Cloudinary
  get CLOUDINARY_CLOUD_NAME() { return getEnvVar('CLOUDINARY_CLOUD_NAME') },
  get CLOUDINARY_API_KEY() { return getEnvVar('CLOUDINARY_API_KEY') },
  get CLOUDINARY_API_SECRET() { return getEnvVar('CLOUDINARY_API_SECRET') },

  // AI (optional)
  get GOOGLE_AI_API_KEY() { return getEnvVarOptional('GOOGLE_AI_API_KEY') },
  get GOOGLE_AI_MODEL_NAME() { return getEnvVarOptional('GOOGLE_AI_MODEL_NAME', 'gemini-1.5-flash') },
  get GOOGLE_AI_SYSTEM_PROMPT() { return getEnvVarOptional('GOOGLE_AI_SYSTEM_PROMPT') },
} as const

