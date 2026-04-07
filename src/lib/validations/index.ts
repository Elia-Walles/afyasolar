import { z } from 'zod'

/**
 * User registration schema
 */
// Public signup schema (facility only) - Email verification version
export const publicRegisterSchema = z.object({
  email: z.string().min(1, 'Email address is required').email('Invalid email address'), // Email required for email verification
  phone: z.string().min(1, 'Phone number is required').refine(
    (value) => {
      const digitsOnly = value.replace(/\D/g, '')
      // Accept both formats: "+255 712 345 678" (12 digits) or "255712345678" (12 digits)
      return digitsOnly.startsWith('255') && digitsOnly.length === 12
    },
    {
      message: 'Phone number must start with +255 and have 9 digits after (e.g., +255 712 345 678)'
    }
  ), // Phone required
  name: z.string().min(1, 'Name is required').min(2, 'Name must be at least 2 characters'),
  password: z.string().min(1, 'Password is required').min(8, 'Password must be at least 8 characters'),
  // Facility information (always required for public signup)
  facilityInfo: z.object({
    name: z.string().min(2, 'Facility name must be at least 2 characters'),
    address: z.string().optional(),
    city: z.string().min(2, 'City must be at least 2 characters'),
    region: z.string().min(2, 'Region must be at least 2 characters'),
    regionId: z.number().optional(),
    districtId: z.number().optional(),
    phone: z.string().min(1, 'Phone number is required').refine(
      (value) => {
        const digitsOnly = value.replace(/\D/g, '')
        // Accept both formats: "+255 712 345 678" (12 digits) or "255712345678" (12 digits)
        return digitsOnly.startsWith('255') && digitsOnly.length === 12
      },
      {
        message: 'Phone number must start with +255 and have 9 digits after (e.g., +255 712 345 678)'
      }
    ),
    email: z.string().email('Invalid email address').optional(), // Email optional for facility contact
    category: z.enum(['Pharmacy', 'DMDL', 'Dispensary', 'Laboratory', 'Polyclinic', 'Specialized Polyclinic', 'Health Center', 'Hospital', 'District Hospital', 'Regional Hospital']).default('Dispensary'),
    latitude: z.number().min(-90).max(90).optional(), // Latitude must be between -90 and 90
    longitude: z.number().min(-180).max(180).optional(), // Longitude must be between -180 and 180
    paymentModel: z.enum(['payg', 'installment', 'subscription']).optional(),
  }),
})

// Admin user creation schema (allows all roles)
export const registerSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  name: z.string().min(1, 'Name is required').min(2, 'Name must be at least 2 characters'),
  password: z.string().min(1, 'Password is required').min(8, 'Password must be at least 8 characters'),
  role: z.enum(['facility', 'admin', 'technician', 'onboarding', 'investor']).default('facility'),
  facilityId: z.string().optional(),
})

/**
 * User login schema
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

/**
 * Device claiming schema
 */
export const deviceClaimSchema = z.object({
  serialPrefix: z.string().length(3, 'Serial prefix must be 3 characters'),
  serialSuffix: z.string().length(5, 'Serial suffix must be 5 characters'),
  deviceType: z.enum(['eyedro', 'afyasolar', 'generic']),
})

/**
 * Payment schema
 */
export const paymentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  method: z.enum(['mpesa', 'airtel', 'mixx', 'bank', 'card', 'wallet']), // mixx = Mixx by Yas (formerly Tigo Pesa)
  facilityId: z.string().uuid('Invalid facility ID'),
})

/**
 * Facility creation schema
 */
export const facilitySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  address: z.string().optional(),
  city: z.string().optional(), // Optional - can be derived from district
  region: z.string().min(2, 'Region must be at least 2 characters'),
  regionId: z.number().optional(),
  districtId: z.number().optional(),
  latitude: z.number().min(-90).max(90).optional(), // Latitude must be between -90 and 90
  longitude: z.number().min(-180).max(180).optional(), // Longitude must be between -180 and 180
  phone: z.string().min(1, 'Phone number is required').refine(
    (value) => {
      const digitsOnly = value.replace(/\D/g, '')
      // Must start with 255 and have 9 more digits (total 12 digits)
      return digitsOnly.startsWith('255') && digitsOnly.length === 12
    },
    {
      message: 'Phone number must start with +255 and have 9 digits after (e.g., +255 712 345 678)'
    }
  ),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  paymentModel: z.enum(['payg', 'installment', 'subscription']).optional(),
})

/**
 * Service job schema
 */
export const serviceJobSchema = z.object({
  facilityId: z.string().uuid('Invalid facility ID'),
  technicianId: z.string().uuid('Invalid technician ID').optional(),
  type: z.enum(['installation', 'maintenance', 'repair', 'inspection']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  scheduledDate: z.string().datetime().optional(),
})

/**
 * Energy data schema
 */
export const energyDataSchema = z.object({
  deviceId: z.string().uuid('Invalid device ID'),
  voltage: z.number().positive('Voltage must be positive'),
  current: z.number().positive('Current must be positive'),
  power: z.number().positive('Power must be positive'),
  energy: z.number().positive('Energy must be positive'),
  creditBalance: z.number().min(0, 'Credit balance cannot be negative'),
  batteryLevel: z.number().min(0).max(100).optional(),
  solarGeneration: z.number().min(0).optional(),
  gridStatus: z.enum(['connected', 'disconnected', 'warning']).default('connected'),
  criticalLoad: z.boolean().default(false),
})

