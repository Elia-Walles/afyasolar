import { z } from 'zod'

/**
 * Simplified facility registration schema
 */
export const facilityRegistrationSchema = z.object({
  // Account Information
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required').min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
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

  // Facility Information
  facilityName: z.string().min(2, 'Facility name must be at least 2 characters'),
  address: z.string().optional(),
  city: z.string().min(2, 'City must be at least 2 characters'),
  region: z.string().min(2, 'Region must be at least 2 characters'),
  regionId: z.number().optional(),
  districtId: z.number().optional(),
  category: z.enum([
    'Pharmacy', 
    'DMDL', 
    'Dispensary', 
    'Laboratory', 
    'Polyclinic', 
    'Specialized Polyclinic', 
    'Health Center', 
    'Hospital', 
    'District Hospital', 
    'Regional Hospital'
  ]).default('Dispensary'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),

  // Terms & Conditions
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: 'You must accept the Terms & Conditions to continue',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export type FacilityRegistrationForm = z.infer<typeof facilityRegistrationSchema>
