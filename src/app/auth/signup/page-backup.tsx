"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Building2, User, MapPin, Phone, CreditCard, CheckCircle2, ChevronRight, ChevronLeft, AlertCircle, Mail, Lock, Eye, EyeOff, ArrowLeft, Sparkles, Star, Zap, Edit2, Shield, Clock } from "lucide-react"
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
  { number: 1, title: 'Account', icon: Mail, description: 'Email, phone & password' },
  { number: 2, title: 'Verify Email', icon: Shield, description: 'Verify your email' },
  { number: 3, title: 'Facility Info', icon: Building2, description: 'Facility details' },
  { number: 4, title: 'Review', icon: CheckCircle2, description: 'Review and submit' },
]

const STORAGE_KEY = 'facility_signup_state'

interface SignupState {
  currentStep: Step
  email: string
  emailVerified: boolean
  verificationTimer: number | null
  timeRemaining: number
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
  const [isVerifying, setIsVerifying] = useState(false)
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [emailVerified, setEmailVerified] = useState(initialState?.emailVerified || false)
  const [verificationCode, setVerificationCode] = useState('')
  const [editingField, setEditingField] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [verificationTimer, setVerificationTimer] = useState<number | null>(initialState?.verificationTimer || null)
  const [timeRemaining, setTimeRemaining] = useState<number>(initialState?.timeRemaining || 0)
  const [passwordValidationErrors, setPasswordValidationErrors] = useState<string[]>([])
  const verificationAttempted = useRef<string>('')
  const emailRef = useRef<string>(initialState?.email || '')
  const codeReadyRef = useRef<boolean>(false) // Track if code is ready for verification
  const [regions, setRegions] = useState<Array<{ id: number; name: string }>>([])
  const [districts, setDistricts] = useState<Array<{ id: number; name: string; regionId: number }>>([])
  const [isLoadingRegions, setIsLoadingRegions] = useState(false)
  const [selectedRegionId, setSelectedRegionId] = useState<string>('')
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('')

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
    mode: 'onSubmit',
    defaultValues: {
      email: "",
      name: "",
      password: "",
      facilityInfo: {
        name: "",
        address: "",
        city: "",
        region: "",
        phone: "+255 ",
        email: "",
        category: "Dispensary",
        paymentModel: "payg",
      },
    },
  })

  const watchedValues = watch()

  // Auto-save form state to localStorage changes (for validation)
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

  // Restore verification timer on mount if available
  useEffect(() => {
    if (initialState?.verificationTimer && initialState.timeRemaining > 0) {
      const now = Date.now()
      const elapsed = Math.floor((now - initialState.verificationTimer) / 1000)
      const remaining = Math.max(0, initialState.timeRemaining - elapsed)
      
      if (remaining > 0) {
        setTimeRemaining(remaining)
        // Calculate new timer expiration
        setVerificationTimer(now + (remaining * 1000))
      } else {
        // Timer expired, clear it
        setVerificationTimer(null)
        setTimeRemaining(0)
      }
    }
  }, []) // Only run once on mount

  // Save state to localStorage whenever relevant values change
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const email = watchedValues.email || emailRef.current
    if (email && currentStep >= 2) {
      const state: SignupState = {
        currentStep,
        email,
        emailVerified,
        verificationTimer,
        timeRemaining,
        timestamp: Date.now(),
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch (error) {
        console.error('Error saving signup state to localStorage:', error)
      }
    }
  }, [currentStep, watchedValues.email, emailVerified, verificationTimer, timeRemaining])

  // Store email in ref for stable reference
  useEffect(() => {
    if (watchedValues.email) {
      emailRef.current = watchedValues.email
    }
  }, [watchedValues.email])

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

  // Timer for verification code expiration (5 minutes)
  useEffect(() => {
    if (currentStep === 2 && timeRemaining > 0) {
      const interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(interval)
            setVerificationTimer(null)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [currentStep, timeRemaining])

  // Auto-verify when 6 digits are entered (disabled by default, enable if needed)
  // Set to false to disable auto-verification and require manual button click
  const ENABLE_AUTO_VERIFY = false
  
  useEffect(() => {
    if (!ENABLE_AUTO_VERIFY) return // Skip auto-verification if disabled
    
    // Only auto-verify if all conditions are met
    if (
      currentStep === 2 && 
      verificationCode.length === 6 && 
      !isVerifying && 
      !emailVerified &&
      verificationAttempted.current !== verificationCode &&
      codeReadyRef.current && // Code must be ready
      timeRemaining > 0
    ) {
      // Ensure we have the email
      const emailToUse = emailRef.current || watchedValues.email
      if (!emailToUse) {
        console.warn('[Auto-Verify] Email not available')
        return
      }

      // Mark as attempted to prevent duplicate calls
      verificationAttempted.current = verificationCode
      
      // Use a longer delay to ensure code is fully stored and ready
      const timeoutId = setTimeout(async () => {
        // Re-check all conditions before proceeding
        if (isVerifying || emailVerified || verificationCode.length !== 6 || !codeReadyRef.current) {
          console.log('[Auto-Verify] Conditions changed, aborting')
          verificationAttempted.current = '' // Reset
          return
        }

        const normalizedEmail = emailToUse.toLowerCase().trim()
        const normalizedCode = verificationCode.trim()

        console.log('[Auto-Verify] Starting verification for:', normalizedEmail, 'Code:', normalizedCode)

        setIsVerifying(true)
        try {
          const response = await fetch('/api/auth/verify-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              email: normalizedEmail,
              code: normalizedCode
            }),
          })

          const result = await response.json()

          if (!response.ok) {
            console.error('[Auto-Verify] Failed:', result.error, 'Response:', result)
            // Don't show error toast for auto-verify failures - let user click button
            verificationAttempted.current = '' // Reset to allow retry
            setIsVerifying(false)
            return
          }

          console.log('[Auto-Verify] Success!')
          setEmailVerified(true)
          setVerificationTimer(null)
          setTimeRemaining(0)
          toast.success('Email verified successfully!')
          setCurrentStep(3)
          
          // Update localStorage
          if (typeof window !== 'undefined') {
            try {
              const email = emailRef.current || watchedValues.email
              if (email) {
                const state: SignupState = {
                  currentStep: 3,
                  email,
                  emailVerified: true,
                  verificationTimer: null,
                  timeRemaining: 0,
                  timestamp: Date.now(),
                }
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
              }
            } catch (error) {
              console.error('Error saving signup state:', error)
            }
          }
        } catch (error) {
          console.error('[Auto-Verify] Error:', error)
          // Don't show error toast for auto-verify failures
          verificationAttempted.current = '' // Reset to allow retry
        } finally {
          setIsVerifying(false)
        }
      }, 1500) // 1.5 second delay to ensure code is stored

      return () => clearTimeout(timeoutId)
    }
  }, [verificationCode, currentStep, isVerifying, emailVerified, timeRemaining, watchedValues.email])

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
      return await trigger(['email', 'password']) && password === confirmPassword && isPasswordValid()
    } else if (currentStep === 2) {
      return emailVerified
    } else if (currentStep === 3) {
      return await trigger(['facilityInfo.name', 'facilityInfo.address', 'facilityInfo.city', 'facilityInfo.region'])
    }
    return true
  }

  const handleSendVerificationCode = async () => {
    const email = watchedValues.email
    if (!email) {
      toast.error('Please enter your email first')
      return
    }

    // Validate password before proceeding
    if (!password) {
      toast.error('Please enter a password')
      setIsSendingCode(false)
      return
    }

    // Validate password match
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      setIsSendingCode(false)
      return
    }

    // Validate password strength
    const validation = validatePassword(password, {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
      requireSpecial: true,
      minStrength: 2,
    })

    if (!validation.isValid) {
      setPasswordValidationErrors(validation.errors)
      toast.error(validation.errors[0] || 'Password does not meet requirements')
      setIsSendingCode(false)
      return
    }

    // Clear validation errors if password is valid
    setPasswordValidationErrors([])

    setIsSendingCode(true)
    try {
      const response = await fetch('/api/auth/send-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      })

      const result = await response.json()

      if (!response.ok) {
        toast.error(result.error || 'Failed to send verification code')
        return
      }

      toast.success('Verification code sent to your email')
      setVerificationCode('') // Reset code
      verificationAttempted.current = '' // Reset verification attempt
      codeReadyRef.current = false // Code not ready yet
      const timerExpiry = Date.now() + 5 * 60 * 1000 // 5 minutes from now
      setVerificationTimer(timerExpiry)
      setTimeRemaining(5 * 60) // 5 minutes in seconds
      
      // Ensure emailRef is set before moving to step 2
      const normalizedEmail = email.toLowerCase().trim()
      emailRef.current = normalizedEmail
      
      // Wait longer to ensure code is fully stored in backend before allowing auto-verification
      // This prevents race conditions where auto-verify runs before code is stored
      await new Promise(resolve => setTimeout(resolve, 1000))
      codeReadyRef.current = true // Code is now ready for verification
      console.log('[Send Code] Code is now ready for verification')
      
      setCurrentStep(2)
      
      // Save state to localStorage
      if (typeof window !== 'undefined') {
        try {
          const state: SignupState = {
            currentStep: 2,
            email: normalizedEmail,
            emailVerified: false,
            verificationTimer: timerExpiry,
            timeRemaining: 5 * 60,
            timestamp: Date.now(),
          }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
        } catch (error) {
          console.error('Error saving signup state:', error)
        }
      }
    } catch (error) {
      console.error('Send code error:', error)
      toast.error('An error occurred. Please try again.')
    } finally {
      setIsSendingCode(false)
    }
  }

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('Please enter a valid 6-digit code')
      return
    }

    if (timeRemaining <= 0) {
      toast.error('Verification code has expired. Please request a new one.')
      return
    }

    if (verificationAttempted.current === verificationCode && isVerifying) {
      return // Already attempting to verify this code
    }

    const emailToUse = emailRef.current || watchedValues.email
    if (!emailToUse) {
      toast.error('Email not found. Please go back and re-enter your email.')
      return
    }

    verificationAttempted.current = verificationCode
    setIsVerifying(true)
    try {
      const normalizedEmail = emailToUse.toLowerCase().trim()
      const normalizedCode = verificationCode.trim()

      console.log('[Manual Verify] Verifying code for:', normalizedEmail, 'Code:', normalizedCode)

      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: normalizedEmail,
          code: normalizedCode
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('[Manual Verify] Failed:', result.error)
        toast.error(result.error || 'Invalid verification code')
        verificationAttempted.current = '' // Reset to allow retry
        return
      }

      console.log('[Manual Verify] Success!')
      setEmailVerified(true)
      setVerificationTimer(null)
      setTimeRemaining(0)
      toast.success('Email verified successfully!')
      setCurrentStep(3)
      
      // Update localStorage
      if (typeof window !== 'undefined') {
        try {
          const email = emailRef.current || watchedValues.email
          if (email) {
            const state: SignupState = {
              currentStep: 3,
              email,
              emailVerified: true,
              verificationTimer: null,
              timeRemaining: 0,
              timestamp: Date.now(),
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
          }
        } catch (error) {
          console.error('Error saving signup state:', error)
        }
      }
    } catch (error) {
      console.error('[Manual Verify] Error:', error)
      toast.error('An error occurred. Please try again.')
      verificationAttempted.current = '' // Reset to allow retry
    } finally {
      setIsVerifying(false)
    }
  }

  const handleNext = async () => {
    if (currentStep === 1) {
      // Validate step 1 fields
      const isValid = await trigger(['email', 'password'])
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

      // Don't proceed - user needs to verify email first
      return
    }

    const isValid = await validateCurrentStep()
    if (!isValid) {
      toast.error('Please complete all required fields')
      return
    }

    if (currentStep < 4) {
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
              emailVerified,
              verificationTimer,
              timeRemaining,
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
      if (currentStep === 2) {
        // Reset verification state when going back from verification step
        setVerificationCode('')
        setVerificationTimer(null)
        setTimeRemaining(0)
        verificationAttempted.current = ''
        codeReadyRef.current = false
      }
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
              emailVerified: prevStep === 2 ? false : emailVerified,
              verificationTimer: prevStep === 2 ? null : verificationTimer,
              timeRemaining: prevStep === 2 ? 0 : timeRemaining,
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
    console.log('Form submission data:', {
      email: data.email,
      facilityName: data.facilityInfo?.name,
      hasFacilityInfo: !!data.facilityInfo,
      allKeys: Object.keys(data)
    })
    
    if (!emailVerified) {
      toast.error('Please verify your email first')
      return
    }

    // Ensure name is set from facility name (required by schema)
    const finalData = {
      ...data,
      name: data.name || data.facilityInfo?.name || '',
    }

    // Validate all required fields
    if (!finalData.email || !finalData.password || !finalData.facilityInfo) {
      toast.error('Please complete all required fields')
      return
    }

    if (!finalData.name || finalData.name.length < 2) {
      toast.error('Facility name is required')
      return
    }

    if (!finalData.facilityInfo.name || !finalData.facilityInfo.address || !finalData.facilityInfo.city || 
        !finalData.facilityInfo.region || !finalData.facilityInfo.phone) {
      toast.error('Please complete all facility information fields')
      return
    }

    setIsLoading(true)
    try {
      // Set name to facility name (required by schema)
      const normalizedEmail = finalData.email.toLowerCase().trim()
      const payload = {
        email: normalizedEmail,
        name: finalData.name, // Use facility name as user name
        password: finalData.password,
        facilityInfo: {
          name: finalData.facilityInfo.name,
          address: finalData.facilityInfo.address,
          city: finalData.facilityInfo.city,
          region: finalData.facilityInfo.region,
          phone: finalData.facilityInfo.phone,
          // Don't include email in facilityInfo - it's optional and causes validation issues
          // The API will use the user email as facility email
        },
      }

      console.log('Sending registration request:', { ...payload, password: '***' })

      // The /api/users endpoint handles facility creation automatically
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json()
      console.log('Registration response:', { status: response.status, result })

      if (!response.ok) {
        const errorMessage = result.message || result.error || 'Failed to create account'
        if (result.details && Array.isArray(result.details)) {
          const detailMessages = result.details.map((d: any) => `${d.field}: ${d.message}`).join(', ')
          toast.error(detailMessages || errorMessage)
        } else {
          toast.error(errorMessage)
        }
        setIsLoading(false)
        return
      }

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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 min-h-[400px] animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-6 p-6 bg-gradient-to-br from-white via-emerald-50/20 to-white rounded-2xl border border-emerald-100/60 shadow-xl hover:shadow-2xl transition-all duration-300 backdrop-blur-sm">
              <div className="space-y-4">
                <div className="flex items-center gap-3 pb-2 border-b border-emerald-100/50">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg">
                    <Mail className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-sm font-bold text-gray-900">Email Address</Label>
                    <p className="text-xs text-gray-500">We'll send a verification code</p>
                  </div>
                </div>
                <div className="relative group">
                  <Input
                    id="email"
                    type="email"
                    placeholder="facility@example.com"
                    {...register("email", {
                      required: 'Email is required',
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: 'Please enter a valid email address'
                      }
                    })}
                    disabled={isLoading}
                    className="h-12 pl-12 text-base border-2 border-gray-200/80 bg-gradient-to-r from-white to-emerald-50/20 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 focus:bg-white shadow-sm hover:shadow-md transition-all duration-300 font-medium rounded-xl"
                  />
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600 group-focus-within:text-emerald-700 transition-all duration-300" />
                </div>
                {errors.email && (
                  <p className="text-sm text-red-600 mt-2 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 pb-2 border-b border-emerald-100/50">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg">
                    <Phone className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <Label htmlFor="phone" className="text-sm font-bold text-gray-900">Phone Number</Label>
                    <p className="text-xs text-gray-500">For contact and verification</p>
                  </div>
                </div>
                <div className="relative group">
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+255 712 345 678"
                    {...register("facilityInfo.phone", {
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
                      
                      setValue('facilityInfo.phone', value, { shouldValidate: true })
                    }}
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                      const prefix = "+255 "
                      const input = e.currentTarget
                      const cursorPosition = input.selectionStart || 0
                      const currentPhone = watchedValues.facilityInfo?.phone || prefix
                      
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
                      const currentPhone = watchedValues.facilityInfo?.phone || ''
                      // If phone is empty or doesn't start with prefix, set it
                      if (!currentPhone.startsWith(prefix)) {
                        setValue('facilityInfo.phone', prefix, { shouldValidate: true })
                      }
                      // Move cursor to end after prefix
                      setTimeout(() => {
                        const phone = watchedValues.facilityInfo?.phone || prefix
                        e.target.setSelectionRange(phone.length, phone.length)
                      }, 0)
                    }}
                    disabled={isLoading}
                    className="h-10 sm:h-11 text-sm border border-green-200/80 bg-white focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:bg-white shadow-sm hover:shadow-md transition-all"
                  />
                </div>
                {errors.facilityInfo?.phone && (
                  <p className="text-sm text-red-600 mt-1.5 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {errors.facilityInfo.phone.message}
                  </p>
                )}
                <p className="text-xs text-green-700/80 mt-1">
                  Enter the 9-digit phone number (numbers only)
                </p>
              </div>
            </div>

            <div className="space-y-4 sm:space-y-5 p-4 sm:p-5 bg-gradient-to-br from-white via-emerald-50/30 to-white rounded-xl border-2 border-emerald-100/60 shadow-lg hover:shadow-xl transition-all duration-300 backdrop-blur-sm">
              <div className="space-y-2 sm:space-y-2.5">
                <Label htmlFor="password" className="text-xs sm:text-sm font-bold text-green-900 flex items-center gap-2 sm:gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-md">
                    <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  </div>
                  <span>Password</span>
                </Label>
                <div className="relative group">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 8 characters"
                    {...register("password")}
                    onChange={(e) => {
                      const newPassword = e.target.value
                      setPassword(newPassword)
                      setValue('password', newPassword)
                      
                      // Real-time password validation
                      if (newPassword.length > 0) {
                        const validation = validatePassword(newPassword, {
                          minLength: 8,
                          requireUppercase: true,
                          requireLowercase: true,
                          requireNumber: true,
                          requireSpecial: true,
                          minStrength: 2,
                        })
                        setPasswordValidationErrors(validation.isValid ? [] : validation.errors)
                      } else {
                        setPasswordValidationErrors([])
                      }
                    }}
                    disabled={isLoading}
                    className="h-11 sm:h-12 pl-12 sm:pl-14 pr-12 sm:pr-14 text-sm border-2 border-green-200/80 bg-gradient-to-r from-white to-emerald-50/30 focus:border-green-500 focus:ring-2 focus:ring-green-500/30 focus:bg-white shadow-md hover:shadow-lg transition-all duration-200 font-medium"
                    minLength={8}
                  />
                  <Lock className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-green-600 group-focus-within:text-green-700 transition-all duration-200" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 text-green-600 hover:text-green-700 transition-all duration-200 hover:scale-110 active:scale-95"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" />
                    ) : (
                      <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                  </button>
                </div>
                {password && (
                  <PasswordStrengthIndicator password={password} className="mt-3" />
                )}
                {errors.password && (
                  <p className="text-sm text-red-600 mt-2 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {errors.password.message}
                  </p>
                )}
                {passwordValidationErrors.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {passwordValidationErrors.map((error, index) => (
                      <p key={index} className="text-sm text-red-600 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {error}
                      </p>
                    ))}
                  </div>
                )}
                <p className="text-xs text-green-700/80 mt-2 font-medium">
                  Min 8 chars: uppercase, lowercase, number, special char
                </p>
              </div>

              <div className="space-y-2 sm:space-y-2.5">
                <Label htmlFor="confirmPassword" className="text-xs sm:text-sm font-bold text-green-900 flex items-center gap-2 sm:gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-md">
                    <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  </div>
                  <span>Confirm Password</span>
                </Label>
                <div className="relative group">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    className="h-11 sm:h-12 pl-12 sm:pl-14 pr-12 sm:pr-14 text-sm border-2 border-green-200/80 bg-gradient-to-r from-white to-green-50/30 focus:border-green-500 focus:ring-2 focus:ring-green-500/30 focus:bg-white shadow-md hover:shadow-lg transition-all duration-200 font-medium"
                  />
                  <Lock className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-green-600 group-focus-within:text-green-700 transition-all duration-200" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 text-green-600 hover:text-green-700 transition-all duration-200 hover:scale-110 active:scale-95"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" />
                    ) : (
                      <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-sm text-red-600 mt-2 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    Passwords do not match
                  </p>
                )}
                {confirmPassword && password === confirmPassword && password.length > 0 && (
                  <p className="text-sm text-green-600 mt-2 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    Passwords match
                  </p>
                )}
              </div>
            </div>
          </div>
        )

      case 2:
        const formatTime = (seconds: number) => {
          const mins = Math.floor(seconds / 60)
          const secs = seconds % 60
          return `${mins}:${secs.toString().padStart(2, '0')}`
        }

        return (
          <div className="max-w-md mx-auto min-h-[280px] flex items-center justify-center">
            <div className="p-5 sm:p-6 bg-gradient-to-br from-green-50/60 to-emerald-50/60 border border-green-200/80 rounded-xl shadow-sm w-full">
              <div className="text-center mb-5">
                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md">
                  <Shield className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-bold text-green-900 mb-2">Verify Your Email</h3>
                <p className="text-sm text-gray-600 mb-1">
                  We've sent a 6-digit verification code to
                </p>
                <p className="text-sm font-semibold text-green-700 break-all px-2">{watchedValues.email}</p>
                
                {/* Timer Display */}
                {timeRemaining > 0 && (
                  <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 border border-green-300 rounded-full">
                    <span className="text-xs font-semibold text-green-700">Code expires in:</span>
                    <span className={`text-sm font-bold ${timeRemaining < 60 ? 'text-red-600' : 'text-green-700'}`}>
                      {formatTime(timeRemaining)}
                    </span>
                  </div>
                )}
                {timeRemaining === 0 && verificationTimer !== null && (
                  <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-red-100 border border-red-300 rounded-full">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span className="text-xs font-semibold text-red-700">Code expired</span>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="verificationCode" className="text-sm font-semibold text-green-800 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-green-600" />
                    Verification Code
                  </Label>
                  <Input
                    id="verificationCode"
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={verificationCode}
                    onChange={(e) => {
                      const newCode = e.target.value.replace(/\D/g, '').slice(0, 6)
                      setVerificationCode(newCode)
                    }}
                    disabled={isVerifying || timeRemaining === 0}
                    className="h-12 text-center text-2xl font-bold tracking-widest border border-green-200/80 bg-white focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:bg-white shadow-sm"
                    maxLength={6}
                    autoComplete="one-time-code"
                  />
                  {timeRemaining === 0 && (
                    <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1.5">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      Code expired. Please request a new one.
                    </p>
                  )}
                </div>

                <Button
                  type="button"
                  onClick={handleVerifyCode}
                  disabled={isVerifying || verificationCode.length !== 6 || timeRemaining === 0}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 h-11 text-sm text-white font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      Verify Email
                      <CheckCircle2 className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleSendVerificationCode}
                    disabled={isSendingCode}
                    className="text-sm text-green-600 hover:text-green-700 font-semibold transition-colors underline disabled:opacity-50"
                  >
                    {isSendingCode ? 'Sending...' : 'Resend Code'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )

      case 3:
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
                  <Label htmlFor="phone" className="text-xs font-semibold text-green-800 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-green-600" />
                    Phone Number
                  </Label>
                  <div className="relative group">
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+255 712 345 678"
                      {...register("facilityInfo.phone", {
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
                        
                        setValue('facilityInfo.phone', value, { shouldValidate: true })
                      }}
                      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                        const prefix = "+255 "
                        const input = e.currentTarget
                        const cursorPosition = input.selectionStart || 0
                        const currentPhone = watchedValues.facilityInfo?.phone || prefix
                        
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
                        const currentPhone = watchedValues.facilityInfo?.phone || ''
                        // If phone is empty or doesn't start with prefix, set it
                        if (!currentPhone.startsWith(prefix)) {
                          setValue('facilityInfo.phone', prefix, { shouldValidate: true })
                        }
                        // Move cursor to end after prefix
                        setTimeout(() => {
                          const phone = watchedValues.facilityInfo?.phone || prefix
                          e.target.setSelectionRange(phone.length, phone.length)
                        }, 0)
                      }}
                      disabled={isLoading}
                      className="h-9 w-[180px] text-sm border border-green-200/80 bg-white focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:bg-white shadow-sm hover:shadow-md transition-all"
                    />
                  </div>
                  {errors.facilityInfo?.phone && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {errors.facilityInfo.phone.message}
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
                    Address <span className="text-gray-500 font-normal">(Optional)</span>
                  </Label>
                  <div className="relative group">
                    <Input
                      id="address"
                      type="text"
                      placeholder="P.O BOX 1234 (Optional)"
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
              <h3 className="text-xs font-semibold text-green-900 border-b border-green-200 pb-1.5">GPS Location (Optional)</h3>
              <LocationPicker
                onLocationChange={(lat, lng) => {
                  setValue('facilityInfo.latitude', lat)
                  setValue('facilityInfo.longitude', lng)
                }}
                initialLatitude={watchedValues.facilityInfo?.latitude}
                initialLongitude={watchedValues.facilityInfo?.longitude}
                disabled={isLoading}
              />
            </div>
          </div>
        )

      case 4:
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
                  {renderEditableField("Phone", watchedValues.facilityInfo?.phone || '', 'facilityInfo.phone')}
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
          </>
        )

      default:
        return null
    }
  }

  const currentStepData = steps.find(s => s.number === currentStep)

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50/30 via-white to-green-50/20 relative overflow-hidden">
      {/* Animated background gradients */}
      <div 
        className="fixed inset-0 -z-10 opacity-40"
        style={{
          background: `radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(34, 197, 94, 0.25) 0%, transparent 50%)`,
        }}
      />
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-green-200/50 to-emerald-200/40 rounded-full blur-3xl -z-10 animate-pulse" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-green-200/40 to-emerald-100/50 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-green-100/30 to-emerald-100/30 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDelay: '0.5s' }} />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-6xl relative z-10">
        {/* Compact Header */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-4">
            <Link 
              href="/auth/signin" 
              className="inline-flex items-center gap-2 text-xs sm:text-sm text-green-700 hover:text-green-600 font-semibold transition-all group px-3 py-1.5 rounded-lg hover:bg-green-50/70 backdrop-blur-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:-translate-x-1 transition-transform" />
              <span>Back to Sign In</span>
            </Link>
            
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/50 text-green-700 rounded-full text-xs font-bold shadow-md backdrop-blur-sm">
              <Sparkles className="w-3 h-3 animate-pulse" />
              <span className="hidden sm:inline">Join 500+ Facilities</span>
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 mb-4">
            <div className="relative flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-emerald-200 bg-white shadow-lg">
              <Image
                src="/images/services/logo.png"
                alt="Ubuntu Afya Link logo"
                fill
                className="object-contain p-2"
                priority
              />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-900 mb-0.5">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 via-green-500 to-emerald-600">
                  Facility Registration
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 font-medium">
                Step {currentStep} of {steps.length} • {currentStepData?.title}
              </p>
            </div>
          </div>
        </div>

        {/* Progress Indicator - Top */}
        <div className="mb-6 sm:mb-8">
          <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-xl overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-green-50" />
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 via-emerald-500 to-green-500 opacity-20" />
            <CardContent className="p-4 sm:p-6 relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-semibold text-gray-700">Registration Progress</span>
                </div>
                <div className="text-sm font-medium text-gray-500">
                  {Math.round((currentStep / steps.length) * 100)}% Complete
                </div>
              </div>
              
              <div className="flex items-center justify-start gap-2 sm:gap-4 overflow-x-auto scrollbar-hide pr-4 sm:pr-6">
                {steps.map((step, index) => {
                  const StepIcon = step.icon
                  const isActive = step.number === currentStep
                  const isCompleted = step.number < currentStep
                  const isLast = index === steps.length - 1
                  const progress = ((index + 1) / steps.length) * 100
                  
                  return (
                    <div key={step.number} className={`flex items-center flex-shrink-0 ${isLast ? 'mr-2 sm:mr-0' : ''}`}>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className={`
                          relative group transition-all duration-300 transform
                          ${isActive ? 'scale-110' : 'scale-100 hover:scale-105'}
                        `}>
                          <div className={`
                            absolute inset-0 rounded-full blur-md transition-all duration-300
                            ${isActive ? 'bg-gradient-to-r from-green-400 to-emerald-400 opacity-40' : ''}
                            ${isCompleted ? 'bg-gradient-to-r from-green-300 to-emerald-300 opacity-30' : ''}
                          `} />
                          <div className={`
                            relative w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-300
                            ${isActive ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg ring-4 ring-green-100' : ''}
                            ${isCompleted ? 'bg-gradient-to-br from-green-400 to-emerald-500 text-white shadow-md' : 'bg-gray-100 text-gray-400'}
                            ${!isActive && !isCompleted ? 'hover:bg-gray-200' : ''}
                          `}>
                            {isCompleted ? (
                              <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 animate-in fade-in zoom-in duration-300" />
                            ) : (
                              <StepIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                            )}
                          </div>
                          {isActive && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-ping" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <p className={`
                            font-bold text-xs sm:text-sm whitespace-nowrap transition-all duration-300
                            ${isActive ? 'text-green-900' : isCompleted ? 'text-green-700' : 'text-gray-500'}
                          `}>
                            {step.title}
                          </p>
                          <p className={`
                            text-xs whitespace-nowrap hidden sm:block transition-all duration-300
                            ${isActive ? 'text-green-600 font-medium' : 'text-gray-400'}
                          `}>
                            {step.description}
                          </p>
                        </div>
                      </div>
                      {!isLast && (
                        <div className="hidden sm:block flex-1 mx-2">
                          <div className="relative h-0.5 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={`
                                absolute top-0 left-0 h-full bg-gradient-to-r from-green-400 to-emerald-400 rounded-full transition-all duration-500
                                ${isCompleted ? 'w-full' : 'w-0'}
                              `}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Form Area */}
        <div className="flex">
          <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-xl overflow-hidden w-full flex flex-col relative">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-green-50 opacity-50" />
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 via-emerald-500 to-green-500 opacity-30" />
            
            {/* Step Header */}
            <div className="relative z-10 px-6 py-4 border-b border-gray-100/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold shadow-lg">
                    {currentStep}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{currentStepData?.title}</h2>
                    <p className="text-sm text-gray-600">{currentStepData?.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock className="w-4 h-4" />
                  <span>~2 min</span>
                </div>
              </div>
            </div>
            
            <CardContent className="p-6 sm:p-8 relative z-10 flex flex-col flex-1 min-h-0">
                <form 
                  onSubmit={handleSubmit(
                    async (data) => {
                      // Ensure name is set from facility name before submission
                      if (!data.name && data.facilityInfo?.name) {
                        setValue('name', data.facilityInfo.name, { shouldValidate: true })
                        // Wait a bit for validation to update
                        await new Promise(resolve => setTimeout(resolve, 50))
                        // Re-trigger validation for name field
                        await trigger('name')
                      }
                      return onSubmit(data)
                    },
                    (errors) => {
                      console.log('Form validation errors:', errors)
                      
                      // Collect all error messages
                      const errorMessages: string[] = []
                      
                      // Helper to extract error messages from nested errors
                      const collectErrors = (error: any, path: string = ''): void => {
                        if (error?.message) {
                          const fieldPath = path ? `${path}: ${error.message}` : error.message
                          errorMessages.push(fieldPath)
                        } else if (typeof error === 'object' && error !== null) {
                          Object.keys(error).forEach((key) => {
                            const newPath = path ? `${path}.${key}` : key
                            collectErrors(error[key], newPath)
                          })
                        }
                      }
                      
                      collectErrors(errors)
                      
                      // Show all errors or a generic message
                      if (errorMessages.length > 0) {
                        const errorText = errorMessages.length === 1 
                          ? errorMessages[0]
                          : `${errorMessages.length} validation errors: ${errorMessages.slice(0, 3).join(', ')}${errorMessages.length > 3 ? '...' : ''}`
                        toast.error(errorText)
                      } else {
                        toast.error('Please fix the errors in the form')
                      }
                    }
                  )} 
                  className="space-y-4 sm:space-y-5 flex flex-col flex-1 min-h-0"
                >
                  {/* Step Content */}
                  <div className="flex-1 min-h-0">
                    {renderStepContent()}
                  </div>

                  {/* Navigation Buttons */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between pt-4 border-t border-green-200/60 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleBack}
                      disabled={currentStep === 1 || isLoading || isVerifying}
                      className="h-11 px-6 text-sm font-bold border-2 border-green-400 bg-white hover:bg-green-50 hover:border-green-600 text-green-700 transition-all shadow-md hover:shadow-lg w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400"
                    >
                      <ChevronLeft className="w-5 h-5 mr-2" />
                      Back
                    </Button>

                    {currentStep === 1 ? (
                      <Button
                        type="button"
                        onClick={handleSendVerificationCode}
                        disabled={
                          isLoading || 
                          isSendingCode || 
                          !watchedValues.email || 
                          !password || 
                          password !== confirmPassword ||
                          !isPasswordValid()
                        }
                        className="group bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 h-10 px-6 text-sm text-white font-semibold shadow-md hover:shadow-lg transition-all w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSendingCode ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Sending Code...
                          </>
                        ) : (
                          <>
                            Verify Email
                            <Shield className="w-4 h-4 ml-2" />
                          </>
                        )}
                      </Button>
                    ) : currentStep === 2 ? (
                      <Button
                        type="button"
                        onClick={handleVerifyCode}
                        disabled={isVerifying || verificationCode.length !== 6}
                        className="group bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 h-10 px-6 text-sm text-white font-semibold shadow-md hover:shadow-lg transition-all w-full sm:w-auto"
                      >
                        {isVerifying ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          <>
                            Continue
                            <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                          </>
                        )}
                      </Button>
                    ) : currentStep < 4 ? (
                      <Button
                        type="button"
                        onClick={handleNext}
                        disabled={isLoading}
                        className="group bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 h-10 px-6 text-sm text-white font-semibold shadow-md hover:shadow-lg transition-all w-full sm:w-auto"
                      >
                        Next
                        <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        disabled={isLoading || editingField !== null}
                        className="group bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 h-10 px-6 text-sm text-white font-semibold shadow-md hover:shadow-lg transition-all w-full sm:w-auto"
                      >
              {isLoading ? (
                <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Creating Account...
                </>
              ) : (
                          <>
                            Create Account
                            <CheckCircle2 className="w-4 h-4 ml-2" />
                          </>
              )}
            </Button>
                    )}
                  </div>
                </form>

                <div className="mt-4 sm:mt-5 pt-4 sm:pt-5 border-t border-green-200/60 text-center space-y-2">
                  <p className="text-xs sm:text-sm text-gray-700">
                    Already have an account?{" "}
                    <Link 
                      href="/auth/signin" 
                      className="text-green-600 hover:text-green-700 font-semibold transition-colors underline underline-offset-2"
                    >
                      Sign in
                    </Link>
                  </p>
                  <p className="text-[11px] sm:text-xs text-gray-600">
                    By creating an account, you agree to our{" "}
                    <Link
                      href="/terms"
                      className="text-green-600 hover:text-green-700 font-semibold underline underline-offset-2"
                    >
                      Terms &amp; Conditions
                    </Link>
                    {" "}and{" "}
                    <Link
                      href="/privacy-policy"
                      className="text-green-600 hover:text-green-700 font-semibold underline underline-offset-2"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </p>
                </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

