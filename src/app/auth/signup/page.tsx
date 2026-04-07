"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Building2, User, MapPin, Phone, CreditCard, CheckCircle2, ChevronRight, ChevronLeft, AlertCircle, Mail, Lock, Eye, EyeOff, ArrowLeft, Sparkles, Star, Zap, Edit2, Shield } from "lucide-react"
import { publicRegisterSchema } from "@/lib/validations"
import type { z } from "zod"
import { toast } from "sonner"
import Link from "next/link"
import Image from "next/image"
import { PasswordStrengthIndicator } from "@/components/ui/password-strength"
import { validatePassword } from "@/lib/password-validation"
import { LocationPicker } from "@/components/ui/location-picker"

type RegisterForm = z.infer<typeof publicRegisterSchema>

type Step = 1 | 2 | 3 | 4 | 5

const steps = [
  { number: 1, title: 'Account', icon: Mail, description: 'Email & password' },
  { number: 2, title: 'Facility Info', icon: Building2, description: 'Facility details' },
  { number: 3, title: 'Review', icon: CheckCircle2, description: 'Review and submit' },
]

const STORAGE_KEY = 'facility_signup_state'

interface SignupState {
  currentStep: Step
  email: string
  timestamp: number
}

export default function SignUpPage() {
  const router = useRouter()
  
  // Initialize state from localStorage if available
  const getInitialState = (): SignupState | null => {
    if (typeof window === 'undefined') return null
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const state: SignupState = JSON.parse(stored)
        // Check if state is still valid (not older than 1 hour)
        const oneHour = 60 * 60 * 1000
        if (Date.now() - state.timestamp < oneHour) {
          return state
        } else {
          // Clear expired state
          localStorage.removeItem(STORAGE_KEY)
        }
      }
    } catch (error) {
      console.error('Error reading signup state from localStorage:', error)
    }
    return null
  }

  const initialState = getInitialState()
  const [currentStep, setCurrentStep] = useState<Step>(initialState?.currentStep || 1)
  const [isLoading, setIsLoading] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [passwordValidationErrors, setPasswordValidationErrors] = useState<string[]>([])
  const emailRef = useRef<string>(initialState?.email || '')
  const [regions, setRegions] = useState<Array<{ id: number; name: string }>>([])
  const [districts, setDistricts] = useState<Array<{ id: number; name: string; regionId: number }>>([])
  const [isLoadingRegions, setIsLoadingRegions] = useState(false)
  const [selectedRegionId, setSelectedRegionId] = useState<string>('')
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [phoneDuplicate, setPhoneDuplicate] = useState(false)
  const [emailDuplicate, setEmailDuplicate] = useState(false)
  const [duplicateDetails, setDuplicateDetails] = useState<any>(null)
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false)

  // Mouse tracking for parallax effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    watch,
    setValue,
    trigger,
  } = useForm<RegisterForm>({
    resolver: zodResolver(publicRegisterSchema),
    mode: 'onChange', // Change to onChange for real-time validation
    defaultValues: {
      name: '', // Will be set to facility name later
      email: '',
      phone: '+255 ', // Phone required
      password: '', // Add password to form default values
      facilityInfo: {
        name: '',
        address: '', // Optional - no default value
        phone: '+255 ',
        city: '',
        region: '',
        regionId: undefined,
        districtId: undefined,
        email: '', // Email for facility info (will be synced from main email)
      },
    },
  })

  // Debug: Log form errors
  const watchedValues = watch()


  // Update name field when facility name changes (for validation)
  // This ensures the name field is always synced with facility name
  useEffect(() => {
    if (watchedValues.facilityInfo?.name && watchedValues.facilityInfo.name.length >= 2) {
      setValue('name', watchedValues.facilityInfo.name, { shouldValidate: true, shouldDirty: true })
    }
  }, [watchedValues.facilityInfo?.name, setValue])

  // Restore email from localStorage if available
  useEffect(() => {
    if (initialState?.email && !watchedValues.email) {
      setValue('email', initialState.email)
      emailRef.current = initialState.email
    }
  }, []) // Only run once on mount

  // Save state to localStorage whenever relevant values change
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const email = watchedValues.email || emailRef.current
    if (email && currentStep >= 1) {
      const state: SignupState = {
        currentStep,
        email,
        timestamp: Date.now(),
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch (error) {
        console.error('Error saving signup state to localStorage:', error)
      }
    }
  }, [currentStep, watchedValues.email])

  // Sync facilityInfo email when main email changes
  useEffect(() => {
    if (watchedValues.email) {
      setValue('facilityInfo.email', watchedValues.email)
    }
  }, [watchedValues.email, setValue])

  // Sync facilityInfo phone with main phone when it changes
  useEffect(() => {
    if (watchedValues.phone && watchedValues.phone !== '+255 ') {
      setValue('facilityInfo.phone', watchedValues.phone, { shouldValidate: true })
    }
  }, [watchedValues.phone, setValue])

  // Load regions on component mount
  useEffect(() => {
    loadRegions()
  }, [])
  
  // Retry loading regions if still empty after initial load
  useEffect(() => {
    if (regions.length === 0 && !isLoadingRegions && currentStep >= 3) {
      console.log('[Signup] No regions found, retrying...')
      const retryTimer = setTimeout(() => {
        loadRegions()
      }, 1000)
      return () => clearTimeout(retryTimer)
    }
  }, [currentStep, regions.length, isLoadingRegions])

  // Sync region/district state with form values when step 3 is shown
  useEffect(() => {
    if (currentStep === 3 && regions.length > 0) {
      const formRegionId = watchedValues.facilityInfo?.regionId
      const formDistrictId = watchedValues.facilityInfo?.districtId
      const formRegion = watchedValues.facilityInfo?.region
      
      // If form has a region ID, sync it with state
      if (formRegionId) {
        const regionIdStr = formRegionId.toString()
        if (selectedRegionId !== regionIdStr) {
          setSelectedRegionId(regionIdStr)
          // Load districts for this region
          loadDistricts(formRegionId)
        }
      } else if (formRegion && regions.length > 0) {
        // If form has region name but no ID, try to find matching region
        const matchingRegion = regions.find(r => r.name === formRegion)
        if (matchingRegion) {
          const regionIdStr = matchingRegion.id.toString()
          setSelectedRegionId(regionIdStr)
          setValue('facilityInfo.regionId', matchingRegion.id)
          loadDistricts(matchingRegion.id)
        }
      }
      
      // If form has a district ID and districts are loaded, sync it
      if (formDistrictId && districts.length > 0) {
        const districtIdStr = formDistrictId.toString()
        if (selectedDistrictId !== districtIdStr) {
          setSelectedDistrictId(districtIdStr)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, regions.length, watchedValues.facilityInfo?.regionId, watchedValues.facilityInfo?.districtId])

  // Debounce timer refs for duplicate checking
  const phoneCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const emailCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Check for duplicate phone/email
  const checkDuplicates = async (phone?: string, email?: string) => {
    if (!phone && !email) return
    
    setIsCheckingDuplicates(true)
    try {
      const params = new URLSearchParams()
      if (phone) params.append('phone', phone.replace(/\s/g, ''))
      if (email) params.append('email', email.toLowerCase().trim())
      
      const response = await fetch(`/api/auth/check-duplicates?${params}`)
      const result = await response.json()
      
      if (response.ok) {
        setPhoneDuplicate(result.duplicates.phone)
        setEmailDuplicate(result.duplicates.email)
        setDuplicateDetails(result.duplicates)
        
        // Show toast notification if duplicates found
        if (result.duplicates.phone || result.duplicates.email) {
          const messages = []
          if (result.duplicates.phone && result.duplicates.phoneIn) {
            messages.push(`Phone already exists: ${result.duplicates.phoneIn.join(', ')}`)
          }
          if (result.duplicates.email && result.duplicates.emailIn) {
            messages.push(`Email already exists: ${result.duplicates.emailIn.join(', ')}`)
          }
          toast.error(messages.join(' | '))
        }
      }
    } catch (error) {
      console.error('Error checking duplicates:', error)
    } finally {
      setIsCheckingDuplicates(false)
    }
  }

  const loadRegions = async () => {
    try {
      setIsLoadingRegions(true)
      console.log('[Signup] Loading regions from /api/regions...')
      const response = await fetch('/api/regions', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      })
      
      console.log('[Signup] Response status:', response.status, response.statusText)
      
      if (response.ok) {
        const result = await response.json()
        console.log('[Signup] API response:', result)
        const regionsData = result.data || []
        console.log('[Signup] Regions data:', regionsData)
        setRegions(regionsData)
        console.log('[Signup] Regions state updated, count:', regionsData.length)
        if (regionsData.length === 0) {
          console.warn('[Signup] No regions found in database. Please run the seed script to populate regions.')
          toast.error('No regions available. Please contact support.')
        } else {
          console.log('[Signup] Successfully loaded', regionsData.length, 'regions')
        }
      } else {
        const errorText = await response.text()
        console.error('[Signup] Failed to load regions:', response.status, response.statusText, errorText)
        toast.error('Failed to load regions. Please refresh the page.')
      }
    } catch (error) {
      console.error('[Signup] Error loading regions:', error)
      toast.error('Error loading regions. Please check your connection and try again.')
    } finally {
      setIsLoadingRegions(false)
    }
  }

  const loadDistricts = async (regionId: number) => {
    try {
      setDistricts([]) // Clear previous districts
      const response = await fetch(`/api/districts?regionId=${regionId}`)
      if (response.ok) {
        const result = await response.json()
        const districtsData = result.data || []
        setDistricts(districtsData)
        console.log('Districts loaded for region', regionId, ':', districtsData.length)
      } else {
        console.error('Failed to load districts:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Error loading districts:', error)
    }
  }

  const handleRegionChange = (regionId: string) => {
    setSelectedRegionId(regionId)
    setSelectedDistrictId('')
    setDistricts([])
    
    // Update form value with region name and ID
    const selectedRegion = regions.find(r => r.id.toString() === regionId)
    if (selectedRegion) {
      setValue('facilityInfo.region', selectedRegion.name)
      setValue('facilityInfo.regionId', parseInt(regionId))
    }
    
    // Clear district/city
    setValue('facilityInfo.city', '')
    setValue('facilityInfo.districtId', undefined)
    
    if (regionId) {
      loadDistricts(parseInt(regionId))
    }
  }

  const handleDistrictChange = (districtId: string) => {
    setSelectedDistrictId(districtId)
    
    // Update form value with district name (stored in city field) and ID
    const selectedDistrict = districts.find(d => d.id.toString() === districtId)
    if (selectedDistrict) {
      setValue('facilityInfo.city', selectedDistrict.name)
      setValue('facilityInfo.districtId', parseInt(districtId))
    }
  }

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value
    
    // Address is optional - allow empty value
    if (!value || value.trim() === '') {
      setValue('facilityInfo.address', '', { shouldValidate: true })
      return
    }
    
    // If user starts typing, optionally add "P.O BOX " prefix if they don't have it
    const prefix = "P.O BOX "
    
    // If value doesn't start with prefix and user is typing, allow free-form input
    // Only auto-format if they're clearly trying to enter a PO BOX number
    if (!value.startsWith(prefix) && /^\d/.test(value.trim())) {
      // If they start with a number, assume they want PO BOX format
      const numbers = value.replace(/\D/g, '')
      if (numbers) {
        value = prefix + numbers
      }
    } else if (value.startsWith(prefix)) {
      // If it starts with prefix, extract only numbers from the part after the prefix
      const afterPrefix = value.substring(prefix.length)
      const numbers = afterPrefix.replace(/\D/g, '')
      value = prefix + numbers
    }
    
    setValue('facilityInfo.address', value, { shouldValidate: true })
  }

  const handleAddressKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const prefix = "P.O BOX "
    const input = e.currentTarget
    const cursorPosition = input.selectionStart || 0
    const currentAddress = watchedValues.facilityInfo?.address || prefix
    
    // Prevent deletion of the prefix
    if (cursorPosition <= prefix.length) {
      // Allow backspace/delete only if there's content after the prefix
      if ((e.key === 'Backspace' || e.key === 'Delete') && currentAddress.length > prefix.length) {
        // Allow the deletion but it will be handled by onChange
        return
      }
      // Prevent cursor from going before the prefix
      if (e.key === 'ArrowLeft' || e.key === 'Home') {
        e.preventDefault()
        input.setSelectionRange(prefix.length, prefix.length)
      }
    }
    
    // Prevent typing non-numeric characters after the prefix
    if (cursorPosition >= prefix.length) {
      if (e.key.length === 1 && !/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
        e.preventDefault()
      }
    }
  }

  const handleAddressFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Address is optional - no auto-formatting on focus
    // User can type freely or leave empty
  }


  // Helper function to check if password meets requirements
  const isPasswordValid = (): boolean => {
    if (!password || password.length === 0) return false
    if (password !== confirmPassword) return false
    
    const validation = validatePassword(password, {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
      requireSpecial: true,
      minStrength: 2,
    })
    
    return validation.isValid
  }

  const validateCurrentStep = async (): Promise<boolean> => {
    if (currentStep === 1) {
      // Check for duplicates before proceeding
      if (phoneDuplicate) {
        toast.error('Please use a different phone number. This number already exists.')
        return false
      }
      if (emailDuplicate) {
        toast.error('Please use a different email address. This email already exists.')
        return false
      }
      
      // Check for duplicates before proceeding
      if (phoneDuplicate) {
        toast.error('Please use a different phone number. This number already exists.')
        return false
      }
      if (emailDuplicate) {
        toast.error('Please use a different email address. This email already exists.')
        return false
      }
      
      return await trigger(['email', 'phone', 'password']) && password === confirmPassword && isPasswordValid()
    } else if (currentStep === 2) {
      return await trigger(['facilityInfo.name', 'facilityInfo.city', 'facilityInfo.region'])
    }
    return true
  }


  const handleNext = async () => {
    if (currentStep === 1) {
      // Check for duplicates before proceeding
      if (phoneDuplicate) {
        toast.error('Please use a different phone number. This number already exists.')
        return
      }
      if (emailDuplicate) {
        toast.error('Please use a different email address. This email already exists.')
        return
      }

      // Validate step 1 fields
      const isValid = await trigger(['email', 'phone', 'password'])
      if (!isValid) {
        toast.error('Please fill all required fields')
        return
      }

      // Validate password match
      if (password !== confirmPassword) {
        toast.error('Passwords do not match')
        return
      }

      // Validate password strength
      if (password) {
        const validation = validatePassword(password, {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumber: true,
          requireSpecial: true,
          minStrength: 2,
        })
        if (!validation.isValid) {
          toast.error(validation.errors[0] || 'Password too weak')
          return
        }
      }

      // All validations passed, proceed to facility info
      setCurrentStep(2)
      return
    }

    const isValid = await validateCurrentStep()
    if (!isValid) {
      toast.error('Please complete all required fields')
      return
    }

    if (currentStep < 3) {
      const nextStep = (currentStep + 1) as Step
      setCurrentStep(nextStep)
      
      // Update localStorage (the useEffect will also handle this, but we do it explicitly here)
      if (typeof window !== 'undefined') {
        try {
          const email = emailRef.current || watchedValues.email
          if (email) {
            const state: SignupState = {
              currentStep: nextStep,
              email,
              timestamp: Date.now(),
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
          }
        } catch (error) {
          console.error('Error saving signup state:', error)
        }
      }
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      const prevStep = (currentStep - 1) as Step
      setCurrentStep(prevStep)
      
      // Update localStorage
      if (typeof window !== 'undefined') {
        try {
          const email = emailRef.current || watchedValues.email
          if (email) {
            const state: SignupState = {
              currentStep: prevStep,
              email,
              timestamp: Date.now(),
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
          }
        } catch (error) {
          console.error('Error saving signup state:', error)
        }
      }
    }
  }

  const onSubmit = async (data: RegisterForm) => {
    // Reset editing field to ensure button is clickable
    setEditingField(null)
    
    // Final duplicate check before submission
    if (phoneDuplicate) {
      toast.error('Cannot create account. This phone number already exists in our system.')
      return
    }
    if (emailDuplicate) {
      toast.error('Cannot create account. This email address already exists in our system.')
      return
    }
    
    // Check if terms are accepted
    if (!acceptedTerms) {
      toast.error('You must accept the terms and conditions to create an account')
      return
    }
    
    // Ensure name field is set from facility name before validation
    if (!data.name || data.name.length < 2) {
      if (data.facilityInfo?.name && data.facilityInfo.name.length >= 2) {
        data.name = data.facilityInfo.name
      } else {
        toast.error('Facility name is required')
        return
      }
    }
    

    // Ensure name is set from facility name (required by schema)
    // Use password from form data (now properly registered)
    const finalData = {
      ...data,
      name: data.name || data.facilityInfo?.name || '',
      password: data.password, // Now use form data password
      acceptTerms: acceptedTerms, // Include terms acceptance
    }

    // Validate all required fields (password is now from form data)
    if (!finalData.phone || !finalData.password || !finalData.facilityInfo) {
      toast.error('Please complete all required fields')
      return
    }

    if (!finalData.name || finalData.name.length < 2) {
      toast.error('Facility name is required')
      return
    }

    // Note: address is now optional, so don't require it
    if (!finalData.facilityInfo.name || !finalData.facilityInfo.city || !finalData.facilityInfo.region) {
      toast.error('Please complete all required facility information fields')
      return
    }

    setIsLoading(true)
    try {
      // Set name to facility name (required by schema)
      const normalizedPhone = finalData.phone.replace(/\s/g, '')
      
      const payload = {
        phone: normalizedPhone,
        name: finalData.name, // Use facility name as user name
        password: finalData.password, // This now uses password from local state
        ...(finalData.email && { email: finalData.email }), // Only include email if provided
        facilityInfo: {
          name: finalData.facilityInfo.name,
          address: finalData.facilityInfo.address || '', // Address is optional
          city: finalData.facilityInfo.city,
          region: finalData.facilityInfo.region,
          phone: normalizedPhone, // Use main phone number for facility phone as well
          // Include optional fields if provided
          ...(finalData.facilityInfo.category && { category: finalData.facilityInfo.category }),
          ...(finalData.facilityInfo.regionId && { regionId: finalData.facilityInfo.regionId }),
          ...(finalData.facilityInfo.districtId && { districtId: finalData.facilityInfo.districtId }),
          ...(finalData.facilityInfo.latitude !== undefined && { latitude: finalData.facilityInfo.latitude }),
          ...(finalData.facilityInfo.longitude !== undefined && { longitude: finalData.facilityInfo.longitude }),
          // Include email in facilityInfo if provided
          ...(finalData.email && { email: finalData.email }),
        },
      }

      console.log('Sending registration request:', { ...payload, password: '***' })

      // The /api/users endpoint handles facility creation automatically
      console.log('Making API call to /api/users')
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      console.log('API response received:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      })

      const result = await response.json()
      console.log('Registration response body:', result)

      if (!response.ok) {
        const errorMessage = result.message || result.error || 'Failed to create account'
        console.error('Registration failed:', errorMessage)
        if (result.details && Array.isArray(result.details)) {
          const detailMessages = result.details.map((d: any) => `${d.field}: ${d.message}`).join(', ')
          toast.error(detailMessages || errorMessage)
        } else {
          toast.error(errorMessage)
        }
        setIsLoading(false)
        return
      }

      console.log('Registration successful!')
      // Clear localStorage on successful registration
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY)
      }
      
      toast.success('Account created successfully! Please sign in to continue.')
      setTimeout(() => {
        router.push('/auth/signin')
      }, 1500)
    } catch (error) {
      console.error('Submit error:', error)
      toast.error('An error occurred. Please try again.')
      setIsLoading(false)
    }
  }


  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 min-h-[280px] animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Left Column - Contact Information */}
            <div className="space-y-3 p-3 bg-gradient-to-br from-white via-emerald-50/20 to-white rounded-lg border border-emerald-100/60 shadow-md hover:shadow-lg transition-all duration-300 backdrop-blur-sm">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 pb-1 border-b border-emerald-100/50">
                  <div className="w-7 h-7 rounded-md bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-sm">
                    <Phone className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <Label htmlFor="phone" className="text-sm font-bold text-gray-900">Phone Number <span className="text-red-500">*</span></Label>
                    <p className="text-xs text-gray-500">Required for facility contact</p>
                  </div>
                </div>
                <div className="relative group">
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+255 712 345 678"
                    {...register("phone", {
                      required: 'Phone number is required',
                      validate: (value) => {
                        if (!value || value.length <= "+255 ".length) {
                          return 'Please enter a phone number'
                        }
                        const afterPrefix = value.substring("+255 ".length)
                        const digitsOnly = afterPrefix.replace(/\D/g, '')
                        if (digitsOnly.length !== 9) {
                          return 'Phone number must have exactly 9 digits after +255 (e.g., +255 712 345 678)'
                        }
                        return true
                      }
                    })}
                    onChange={(e) => {
                      let value = e.target.value
                      
                      // Ensure "+255 " prefix is always present
                      const prefix = "+255 "
                      
                      // If user tries to delete the prefix, prevent it
                      if (!value.startsWith(prefix)) {
                        // If value is shorter than prefix, restore prefix
                        if (value.length < prefix.length) {
                          value = prefix
                        } else {
                          // If user typed something else, extract only numbers and add prefix
                          const digitsOnly = value.replace(/\D/g, '')
                          // If starts with 0, remove it and use remaining digits
                          if (digitsOnly.startsWith('0') && digitsOnly.length > 1) {
                            const remainingDigits = digitsOnly.substring(1)
                            value = prefix + (remainingDigits.length <= 9 ? remainingDigits : remainingDigits.substring(0, 9))
                          } else if (digitsOnly.startsWith('255') && digitsOnly.length > 3) {
                            // If starts with 255, use digits after 255
                            const after255 = digitsOnly.substring(3)
                            value = prefix + (after255.length <= 9 ? after255 : after255.substring(0, 9))
                          } else {
                            // Use all digits, limit to 9
                            value = prefix + (digitsOnly.length <= 9 ? digitsOnly : digitsOnly.substring(0, 9))
                          }
                        }
                      } else {
                        // Extract only numbers from the part after the prefix
                        const afterPrefix = value.substring(prefix.length)
                        const digitsOnly = afterPrefix.replace(/\D/g, '')
                        // Limit to 9 digits
                        value = prefix + (digitsOnly.length <= 9 ? digitsOnly : digitsOnly.substring(0, 9))
                      }
                      
                      setValue('phone', value, { shouldValidate: true })
                      // Also sync to facilityInfo.phone
                      setValue('facilityInfo.phone', value, { shouldValidate: true })
                      
                      // Check duplicates if phone is complete (debounced)
                      const afterPrefix = value.substring(prefix.length)
                      const digitsOnly = afterPrefix.replace(/\D/g, '')
                      if (digitsOnly.length === 9) {
                        const normalizedPhone = value.replace(/\s/g, '')
                        // Clear previous timeout
                        if (phoneCheckTimeoutRef.current) {
                          clearTimeout(phoneCheckTimeoutRef.current)
                        }
                        // Debounce duplicate check
                        phoneCheckTimeoutRef.current = setTimeout(() => {
                          checkDuplicates(normalizedPhone, undefined)
                        }, 500)
                      } else {
                        // Clear duplicate status if phone is incomplete
                        setPhoneDuplicate(false)
                        if (phoneCheckTimeoutRef.current) {
                          clearTimeout(phoneCheckTimeoutRef.current)
                        }
                      }
                    }}
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                      const prefix = "+255 "
                      const input = e.currentTarget
                      const cursorPosition = input.selectionStart || 0
                      const currentPhone = watchedValues.phone || prefix
                      
                      // Prevent deletion of the prefix
                      if (cursorPosition <= prefix.length) {
                        // Allow backspace/delete only if there's content after the prefix
                        if ((e.key === 'Backspace' || e.key === 'Delete') && currentPhone.length > prefix.length) {
                          // Allow the deletion but it will be handled by onChange
                          return
                        }
                        // Prevent cursor from going before the prefix
                        if (e.key === 'ArrowLeft' || e.key === 'Home') {
                          e.preventDefault()
                          input.setSelectionRange(prefix.length, prefix.length)
                        }
                      }
                      
                      // Prevent typing non-numeric characters after the prefix
                      if (cursorPosition >= prefix.length) {
                        if (e.key.length === 1 && !/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                          e.preventDefault()
                        }
                      }
                    }}
                    onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
                      const prefix = "+255 "
                      const currentPhone = watchedValues.phone || ''
                      // If phone is empty or doesn't start with prefix, set it
                      if (!currentPhone.startsWith(prefix)) {
                        setValue('phone', prefix, { shouldValidate: true })
                      }
                      // Move cursor to end after prefix
                      setTimeout(() => {
                        const phone = watchedValues.phone || prefix
                        e.target.setSelectionRange(phone.length, phone.length)
                      }, 0)
                    }}
                    disabled={isLoading}
                    className={`h-8 sm:h-9 pl-10 text-sm border-2 ${phoneDuplicate ? 'border-red-300 bg-red-50' : 'border-gray-200/80 bg-gradient-to-r from-white to-emerald-50/20'} focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white shadow-sm hover:shadow-md transition-all duration-300 font-medium rounded-lg`}
                  />
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600 group-focus-within:text-emerald-700 transition-all duration-300" />
                  {phoneDuplicate && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    </div>
                  )}
                </div>
                {errors.phone && (
                  <p className="text-sm text-red-600 mt-2 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {errors.phone.message}
                  </p>
                )}
                {phoneDuplicate && (
                  <p className="text-sm text-red-600 mt-2 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    Phone number already exists. Please use a different number.
                  </p>
                )}
                <p className="text-xs text-emerald-700/80 mt-1">
                  Enter the 9-digit phone number (numbers only)
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 pb-2 border-b border-emerald-100/50">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg">
                    <Mail className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-sm font-bold text-gray-900">Email Address <span className="text-red-500">*</span></Label>
                    <p className="text-xs text-gray-500">Required for account creation</p>
                  </div>
                </div>
                <div className="relative group">
                  <Input
                    id="email"
                    type="email"
                    placeholder="facility@example.com"
                    {...register("email", {
                      onChange: (e) => {
                        const email = e.target.value.trim()
                        if (email && email.includes('@') && email.includes('.')) {
                          // Clear previous timeout
                          if (emailCheckTimeoutRef.current) {
                            clearTimeout(emailCheckTimeoutRef.current)
                          }
                          // Debounce duplicate check for email
                          emailCheckTimeoutRef.current = setTimeout(() => {
                            checkDuplicates(undefined, email)
                          }, 500)
                        } else {
                          // Clear duplicate status if email is incomplete
                          setEmailDuplicate(false)
                          if (emailCheckTimeoutRef.current) {
                            clearTimeout(emailCheckTimeoutRef.current)
                          }
                        }
                      }
                    })}
                    disabled={isLoading}
                    className={`h-8 sm:h-9 pl-10 text-sm border ${emailDuplicate ? 'border-red-300 bg-red-50' : 'border-green-200/80 bg-white'} focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:bg-white shadow-sm hover:shadow-md transition-all`}
                  />
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600 group-focus-within:text-green-700 transition-all" />
                  {emailDuplicate && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    </div>
                  )}
                </div>
                {errors.email && (
                  <p className="text-sm text-red-600 mt-1.5 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {errors.email.message}
                  </p>
                )}
                <p className="text-xs text-green-700/80 mt-1">
                  This email will be used for your account
                </p>
              </div>
            </div>

            {/* Right Column - Password Section */}
            <div className="space-y-3 p-3 bg-gradient-to-br from-white via-blue-50/20 to-white rounded-lg border border-blue-100/60 shadow-md hover:shadow-lg transition-all duration-300 backdrop-blur-sm">
              <div className="space-y-4">
                <div className="flex items-center gap-3 pb-2 border-b border-blue-100/50">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                    <Lock className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <Label htmlFor="password" className="text-sm font-bold text-gray-900">Password</Label>
                    <p className="text-xs text-gray-500">Create a strong password</p>
                  </div>
                </div>
                <div className="relative group">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    {...register("password", {
                      onChange: (e) => setPassword(e.target.value)
                    })}
                    value={password}
                    disabled={isLoading}
                    className="h-8 sm:h-9 pl-10 pr-10 text-sm border-2 border-gray-200/80 bg-gradient-to-r from-white to-blue-50/20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white shadow-sm hover:shadow-md transition-all duration-300 font-medium rounded-lg"
                  />
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-600 group-focus-within:text-blue-700 transition-all duration-300" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {password && <PasswordStrengthIndicator password={password} />}
                {passwordValidationErrors.length > 0 && (
                  <div className="space-y-1">
                    {passwordValidationErrors.map((error, index) => (
                      <p key={index} className="text-sm text-red-600 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {error}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 pb-2 border-b border-blue-100/50">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                    <Lock className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword" className="text-sm font-bold text-gray-900">Confirm Password</Label>
                    <p className="text-xs text-gray-500">Re-enter your password</p>
                  </div>
                </div>
                <div className="relative group">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    className="h-8 sm:h-9 pl-10 pr-10 text-sm border-2 border-gray-200/80 bg-gradient-to-r from-white to-blue-50/20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white shadow-sm hover:shadow-md transition-all duration-300 font-medium rounded-lg"
                  />
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-600 group-focus-within:text-blue-700 transition-all duration-300" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-sm text-red-600 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    Passwords do not match
                  </p>
                )}
              </div>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-4 min-h-[280px]">
            {/* Basic Information Section */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-green-900 border-b border-green-200 pb-1.5">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="facilityName" className="text-xs font-semibold text-green-800 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-green-600" />
                    Facility Name
                  </Label>
                  <div className="relative group">
                    <Input
                      id="facilityName"
                      type="text"
                      placeholder="Health Center Name"
                      {...register("facilityInfo.name")}
                      disabled={isLoading}
                      className="h-9 text-sm border border-green-200/80 bg-white focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:bg-white shadow-sm hover:shadow-md transition-all"
                    />
                  </div>
                  {errors.facilityInfo?.name && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {errors.facilityInfo.name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="category" className="text-xs font-semibold text-green-800 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-green-600" />
                    Facility Category
                  </Label>
                  <Select
                    value={watchedValues.facilityInfo?.category || 'Dispensary'}
                    onValueChange={(value: "Dispensary" | "Pharmacy" | "DMDL" | "Laboratory" | "Polyclinic" | "Specialized Polyclinic" | "Health Center" | "Hospital" | "District Hospital" | "Regional Hospital") => 
                      setValue('facilityInfo.category', value, { shouldValidate: true })}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="h-9 text-sm border border-green-200/80 bg-white focus:border-green-500 focus:ring-2 focus:ring-green-500/20 shadow-sm hover:shadow-md transition-all">
                      <SelectValue placeholder="Select facility category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Dispensary">Dispensary</SelectItem>
                      <SelectItem value="Health Center">Health Center</SelectItem>
                      <SelectItem value="Hospital">Hospital</SelectItem>
                      <SelectItem value="District Hospital">District Hospital</SelectItem>
                      <SelectItem value="Regional Hospital">Regional Hospital</SelectItem>
                      <SelectItem value="Pharmacy">Pharmacy</SelectItem>
                      <SelectItem value="Laboratory">Laboratory</SelectItem>
                      <SelectItem value="Polyclinic">Polyclinic</SelectItem>
                      <SelectItem value="Specialized Polyclinic">Specialized Polyclinic</SelectItem>
                      <SelectItem value="DMDL">DMDL</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.facilityInfo?.category && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {errors.facilityInfo.category.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Location Information Section */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-green-900 border-b border-green-200 pb-1.5">Location Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="address" className="text-xs font-semibold text-green-800 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-green-600" />
                    P.O BOX Address
                  </Label>
                  <div className="relative group">
                    <Input
                      id="address"
                      type="text"
                      placeholder="P.O BOX 1234"
                      {...register("facilityInfo.address")}
                      onChange={(e) => {
                        handleAddressChange(e)
                      }}
                      onKeyDown={handleAddressKeyDown}
                      onFocus={handleAddressFocus}
                      disabled={isLoading}
                      className="h-9 w-[160px] text-sm border border-green-200/80 bg-white focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:bg-white shadow-sm hover:shadow-md transition-all"
                    />
                  </div>
                  {errors.facilityInfo?.address && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {errors.facilityInfo.address.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="region" className="text-xs font-semibold text-green-800 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-green-600" />
                    Region
                  </Label>
                  <Select
                    value={selectedRegionId}
                    onValueChange={handleRegionChange}
                    disabled={isLoading || isLoadingRegions}
                  >
                    <SelectTrigger className="h-9 text-sm border border-green-200/80 bg-white focus:border-green-500 focus:ring-2 focus:ring-green-500/20 shadow-sm hover:shadow-md transition-all">
                      <SelectValue placeholder={isLoadingRegions ? "Loading regions..." : "Select region"} />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingRegions ? (
                        <div className="p-2 text-center text-sm text-gray-500">
                          <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                        </div>
                      ) : regions.length === 0 ? (
                        <div className="p-2 text-center text-sm text-gray-500">
                          No regions available
                        </div>
                      ) : (
                        regions.map((region) => (
                          <SelectItem key={region.id} value={region.id.toString()}>
                            {region.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {errors.facilityInfo?.region && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {errors.facilityInfo.region.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="district" className="text-xs font-semibold text-green-800 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-green-600" />
                    District
                  </Label>
                  <Select
                    value={selectedDistrictId}
                    onValueChange={handleDistrictChange}
                    disabled={isLoading || !selectedRegionId}
                  >
                    <SelectTrigger className="h-9 text-sm border border-green-200/80 bg-white focus:border-green-500 focus:ring-2 focus:ring-green-500/20 shadow-sm hover:shadow-md transition-all">
                      <SelectValue placeholder={!selectedRegionId ? "Select region first" : districts.length === 0 ? "No districts available" : "Select district"} />
                    </SelectTrigger>
                    <SelectContent>
                      {districts.length === 0 ? (
                        <div className="p-2 text-center text-sm text-gray-500">
                          {!selectedRegionId ? "Please select a region first" : "No districts available"}
                        </div>
                      ) : (
                        districts.map((district) => (
                          <SelectItem key={district.id} value={district.id.toString()}>
                            {district.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {errors.facilityInfo?.districtId && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {errors.facilityInfo.districtId.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Location Coordinates Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-green-900 border-b border-green-200 pb-1.5">GPS Location</h3>
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                  Recommended
                </Badge>
              </div>
              <p className="text-xs text-gray-600 -mt-2">
                Provide GPS coordinates to enable map display and location services. Click "Use Current Location" for automatic detection.
              </p>
              <LocationPicker
                onLocationChange={(lat, lng) => {
                  setValue('facilityInfo.latitude', lat)
                  setValue('facilityInfo.longitude', lng)
                  console.log('[Signup] GPS coordinates captured:', { latitude: lat, longitude: lng })
                }}
                initialLatitude={watchedValues.facilityInfo?.latitude}
                initialLongitude={watchedValues.facilityInfo?.longitude}
                disabled={isLoading}
              />
            </div>
          </div>
        )

      case 3:
        const renderEditableField = (label: string, value: string, fieldKey: string, isEmail = false) => {
          const isEditing = editingField === fieldKey
          return (
            <div className="flex justify-between items-start gap-3 p-2.5 bg-white/50 rounded-md">
              <span className="text-green-700 font-medium text-xs flex-shrink-0">{label}:</span>
              {isEditing ? (
                <div className="flex-1 flex items-center gap-2">
                  <Input
                    type={isEmail ? "email" : "text"}
                    value={value}
                    onChange={(e) => {
                      if (fieldKey.includes('.')) {
                        const [parent, child] = fieldKey.split('.')
                        setValue(`${parent}.${child}` as any, e.target.value)
                      } else {
                        setValue(fieldKey as any, e.target.value)
                      }
                    }}
                    className="h-8 text-xs flex-1"
                    autoFocus
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setEditingField(null)}
                    className="h-8 px-2 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-end gap-2">
                  <span className="text-gray-900 font-semibold text-xs sm:text-sm text-right break-words flex-1">
                    {value || 'N/A'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingField(fieldKey)}
                    className="text-green-600 hover:text-green-700 transition-colors"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )
        }

        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 min-h-[280px]">
              <div className="p-4 sm:p-5 bg-gradient-to-br from-green-50/60 to-emerald-50/60 border border-green-200/80 rounded-xl shadow-sm hover:shadow-md transition-all">
                <h3 className="text-sm font-bold text-green-900 mb-4 flex items-center gap-2">
                  <div className="w-7 h-7 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center shadow-sm">
                    <Mail className="w-3.5 h-3.5 text-white" />
                  </div>
                  Account Information
                </h3>
                <div className="space-y-2.5 text-sm">
                  {renderEditableField("Email", watchedValues.email || '', 'email', true)}
                  {renderEditableField("Phone", watchedValues.phone || '', 'phone', true)}
                </div>
              </div>

              <div className="p-4 sm:p-5 bg-gradient-to-br from-green-50/80 to-emerald-50/80 border-2 border-green-200/60 rounded-lg shadow-md hover:shadow-lg transition-all backdrop-blur-sm">
                <h3 className="text-sm sm:text-base font-bold text-green-900 mb-3 sm:mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center shadow-sm"> 
                    <Building2 className="w-4 h-4 text-white" />
                  </div>
                  Facility Information
                </h3>
                <div className="space-y-2.5 text-sm">
                  {renderEditableField("Name", watchedValues.facilityInfo?.name || '', 'facilityInfo.name')}
                  {renderEditableField("Address", watchedValues.facilityInfo?.address || '', 'facilityInfo.address')}
                  {renderEditableField("City", watchedValues.facilityInfo?.city || '', 'facilityInfo.city')}
                  {renderEditableField("Region", watchedValues.facilityInfo?.region || '', 'facilityInfo.region')}
                </div>
              </div>
            </div>

            {/* Terms and Conditions Section */}
            <div className="mt-6 p-4 bg-gradient-to-br from-green-50/80 to-emerald-50/80 border border-green-200/80 rounded-xl shadow-sm">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="terms"
                    checked={acceptedTerms}
                    onCheckedChange={(checked) => setAcceptedTerms(checked as boolean)}
                    disabled={isLoading}
                    className="mt-0.5 border-green-300 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                  />
                  <div className="flex-1">
                    <Label htmlFor="terms" className="text-sm font-semibold text-green-900 cursor-pointer hover:text-green-800">
                      I agree to the Terms and Conditions
                    </Label>
                    <p className="text-xs text-green-800 mt-1">
                      By creating an account, you agree to our{' '}
                      <Link
                        href="/terms"
                        target="_blank"
                        className="text-green-600 hover:text-green-700 font-semibold underline underline-offset-2"
                      >
                        Terms of Service
                      </Link>{' '}
                      and{' '}
                      <Link
                        href="/privacy-policy"
                        target="_blank"
                        className="text-green-600 hover:text-green-700 font-semibold underline underline-offset-2"
                      >
                        Privacy Policy
                      </Link>
                      . You must accept these terms to complete your registration.
                    </p>
                  </div>
                </div>
                {!acceptedTerms && (
                  <p className="text-xs text-green-600 flex items-center gap-2 ml-7">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    You must accept the terms and conditions to create an account
                  </p>
                )}
              </div>
            </div>
          </>
        )

      default:
        return null
    }
  }

  const currentStepData = steps.find(s => s.number === currentStep)

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 relative overflow-hidden">
      {/* Enhanced animated background gradients */}
      <div 
        className="fixed inset-0 -z-10 opacity-60"
        style={{
          background: `radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.10) 40%, transparent 70%)`,
        }}
      />
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />
      
      {/* Multiple animated gradient orbs */}
      <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-gradient-to-br from-emerald-300/30 via-teal-200/20 to-green-300/25 rounded-full blur-3xl -z-10 animate-pulse" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-teal-200/25 via-emerald-100/30 to-green-200/20 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDelay: '1.5s' }} />
      <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-gradient-to-r from-green-100/40 to-emerald-100/35 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDelay: '0.8s' }} />
      <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-gradient-to-l from-teal-100/30 to-green-100/25 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDelay: '2s' }} />
      
      {/* Subtle floating particles effect */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-10 left-10 w-2 h-2 bg-emerald-400/20 rounded-full animate-bounce" style={{ animationDelay: '0s', animationDuration: '3s' }} />
        <div className="absolute top-20 right-20 w-3 h-3 bg-green-400/15 rounded-full animate-bounce" style={{ animationDelay: '1s', animationDuration: '4s' }} />
        <div className="absolute bottom-20 left-20 w-2 h-2 bg-teal-400/20 rounded-full animate-bounce" style={{ animationDelay: '2s', animationDuration: '3.5s' }} />
        <div className="absolute bottom-10 right-10 w-4 h-4 bg-emerald-300/10 rounded-full animate-bounce" style={{ animationDelay: '1.5s', animationDuration: '5s' }} />
      </div>
      
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-2 sm:py-3 max-w-5xl relative z-10">
        {/* Enhanced Header */}
        <div className="mb-3 sm:mb-4">
          <div className="flex items-center justify-between mb-3">
            <Link 
              href="/auth/signin" 
              className="inline-flex items-center gap-2 text-xs sm:text-sm text-emerald-700 hover:text-emerald-600 font-semibold transition-all group px-2.5 py-1 rounded-lg hover:bg-emerald-50/80 backdrop-blur-sm border border-emerald-200/50 shadow-sm hover:shadow-md"
            >
              <ArrowLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover:-translate-x-1 transition-transform" />
              <span>Back to Sign In</span>
            </Link>
            
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-gradient-to-r from-emerald-50/90 to-teal-50/90 border border-emerald-200/60 text-emerald-700 rounded-full text-xs font-bold shadow-lg backdrop-blur-md">
              <Sparkles className="w-2.5 h-2.5 animate-pulse" />
              <span className="hidden sm:inline">Join 500+ Facilities</span>
              <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 mb-3">
            <div className="relative flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg overflow-hidden border-2 border-emerald-300/60 bg-gradient-to-br from-emerald-50 to-teal-50 shadow-md">
              <Image
                src="/images/services/logo.png"
                alt="Ubuntu Afya Link logo"
                fill
                className="object-contain p-1.5"
                priority
              />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl md:text-2xl font-black text-gray-900 mb-0.5 leading-tight">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-500 to-green-600 drop-shadow-sm">
                  Facility Registration
                </span>
              </h1>
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-gradient-to-r from-emerald-100/80 to-teal-100/80 rounded-full border border-emerald-200/50">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-xs font-bold text-emerald-700">
                    Step {currentStep} of {steps.length}
                  </span>
                </div>
                <span className="text-xs text-gray-600 font-medium">
                  • {currentStepData?.title}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Progress Indicator */}
        <div className="mb-3 sm:mb-4">
          <Card className="border-0 shadow-xl bg-white/98 backdrop-blur-2xl overflow-hidden relative rounded-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 via-white/90 to-teal-50/50" />
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-emerald-500/20 via-teal-500/30 to-emerald-500/20" />
            <CardContent className="p-3 sm:p-4 relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 animate-pulse shadow-lg shadow-emerald-500/30" />
                  <span className="text-xs font-bold text-gray-800 tracking-wide">Registration Progress</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">
                    {Math.round((currentStep / steps.length) * 100)}%
                  </div>
                  <span className="text-xs font-medium text-gray-500">Complete</span>
                </div>
              </div>
              
              <div className="flex items-center justify-start gap-1.5 sm:gap-3 overflow-x-auto scrollbar-hide pr-2 sm:pr-3">
                {steps.map((step, index) => {
                  const StepIcon = step.icon
                  const isActive = step.number === currentStep
                  const isCompleted = step.number < currentStep
                  const isLast = index === steps.length - 1
                  const progress = ((index + 1) / steps.length) * 100
                  
                  return (
                    <div key={step.number} className={`flex items-center flex-shrink-0 ${isLast ? 'mr-1 sm:mr-0' : ''}`}>
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <div className={`
                          relative w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-all duration-500 transform
                          ${isActive 
                            ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/40 scale-105 ring-2 ring-emerald-500/20' 
                            : isCompleted 
                            ? 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-md scale-100' 
                            : 'bg-gray-100/80 border-2 border-gray-200/60 scale-100'
                          }
                        `}>
                          {isCompleted ? (
                            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white drop-shadow-sm" />
                          ) : (
                            <StepIcon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-colors ${
                              isActive ? 'text-white drop-shadow-sm' : 'text-gray-400'
                            }`} />
                          )}
                          
                          {/* Active step pulse effect */}
                          {isActive && (
                            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 animate-ping opacity-20" />
                          )}
                        </div>
                        
                        <div className="hidden sm:block">
                          <div className={`text-xs font-bold transition-colors ${
                            isActive ? 'text-emerald-700' : isCompleted ? 'text-emerald-600' : 'text-gray-500'
                          }`}>
                            {step.title}
                          </div>
                          <div className={`text-xs font-medium transition-colors ${
                            isActive ? 'text-emerald-600' : isCompleted ? 'text-emerald-500' : 'text-gray-400'
                          }`}>
                            {step.description}
                          </div>
                        </div>
                      </div>
                      
                      {/* Connector line */}
                      {!isLast && (
                        <div className="hidden sm:block w-6 h-0.5 bg-gradient-to-r from-emerald-200 to-teal-200 rounded-full mx-1" />
                      )}
                    </div>
                  )
                })}
              </div>
              
              {/* Progress bar */}
              <div className="mt-3 relative h-1 bg-gray-100/60 rounded-full overflow-hidden">
                <div 
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-700 ease-out shadow-lg shadow-emerald-500/30"
                  style={{ width: `${(currentStep / steps.length) * 100}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Main Content Card */}
        <Card className="border-0 shadow-xl bg-white/98 backdrop-blur-2xl overflow-hidden relative rounded-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/30 via-white/95 to-teal-50/30" />
          <CardContent className="p-3 sm:p-4 relative z-10">
            <form onSubmit={handleSubmit(async (data) => {
              await onSubmit(data)
            }, (errors) => {
              console.error('Form validation failed:', errors)
            })} className="space-y-3 sm:space-y-4">
              {/* Step Content */}
              <div className="flex-1 min-h-0">
                {renderStepContent()}
              </div>

              {/* Enhanced Navigation Buttons */}
              <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-emerald-100/50">
                <div>
                  {currentStep > 1 && (
                    <Button
                      type="button"
                      onClick={handleBack}
                      disabled={isLoading}
                      className="group bg-white/80 hover:bg-gray-50 border-2 border-emerald-200/60 text-emerald-700 hover:text-emerald-600 h-8 px-4 text-sm font-bold shadow-sm hover:shadow-md transition-all rounded-lg backdrop-blur-sm"
                    >
                      <ChevronLeft className="w-3.5 h-3.5 mr-1.5 group-hover:-translate-x-1 transition-transform" />
                      Previous
                    </Button>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {currentStep < 3 ? (
                    <Button
                      type="button"
                      onClick={handleNext}
                      disabled={isLoading}
                      className="group bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 h-8 px-5 text-sm text-white font-bold shadow-md hover:shadow-lg transition-all rounded-lg"
                    >
                      Next
                      <ChevronRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={
                        isLoading || 
                        !acceptedTerms || 
                        phoneDuplicate || 
                        emailDuplicate
                      }
                      className="group bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 h-8 px-5 text-sm text-white font-bold shadow-md hover:shadow-lg transition-all rounded-lg disabled:opacity-50"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          Creating Account...
                        </>
                      ) : (
                        <>
                          Create Account
                          <CheckCircle2 className="w-3.5 h-3.5 ml-1.5" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Enhanced Footer */}
        <div className="mt-3 sm:mt-4 text-center space-y-2">
          <div className="flex items-center justify-center gap-3 text-xs text-gray-600">
            <Link 
              href="/auth/signin" 
              className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-semibold transition-colors group"
            >
              <ArrowLeft className="w-2.5 h-2.5 group-hover:-translate-x-1 transition-transform" />
              Already have an account?
            </Link>
            <span className="text-gray-400">•</span>
            <div className="flex items-center gap-2">
              <Link
                href="/terms"
                className="text-emerald-600 hover:text-emerald-700 font-semibold transition-colors underline underline-offset-2"
              >
                Terms
              </Link>
              <Link
                href="/privacy-policy"
                className="text-emerald-600 hover:text-emerald-700 font-semibold transition-colors underline underline-offset-2"
              >
                Privacy
              </Link>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-1 px-2 py-1 bg-gradient-to-r from-emerald-50/80 to-teal-50/80 border border-emerald-200/50 rounded-full text-xs font-medium text-emerald-700 backdrop-blur-sm">
            <Shield className="w-2 h-2" />
            <span>Secure & HIPAA Compliant</span>
            <Lock className="w-2 h-2" />
          </div>
        </div>
      </div>
    </div>
  )
}
                              
                                                                                                                                                                                      
