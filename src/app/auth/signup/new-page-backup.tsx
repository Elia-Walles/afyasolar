"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Mail, Lock, Building2, MapPin, Phone, CheckCircle2, ChevronRight, ChevronLeft, AlertCircle } from "lucide-react"
import { publicRegisterSchema } from "@/lib/validations"
import type { z } from "zod"
import { toast } from "sonner"
import Link from "next/link"

type RegisterForm = z.infer<typeof publicRegisterSchema>

type Step = 1 | 2 | 3 | 4

const steps = [
  { number: 1, title: 'Account', description: 'Email & password' },
  { number: 2, title: 'Verify Email', description: 'Check your inbox' },
  { number: 3, title: 'Facility Info', description: 'Facility details' },
  { number: 4, title: 'Review', description: 'Review & submit' },
]

export default function FacilitySignUpPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [isLoading, setIsLoading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [emailVerified, setEmailVerified] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

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
      name: '',
      email: '',
      password: '',
      facilityInfo: {
        name: '',
        address: '',
        phone: '+255 ',
        city: '',
        region: '',
        regionId: undefined,
        districtId: undefined,
      },
    },
  })

  const watchedValues = watch()

  const validateStep = async (step: Step): Promise<boolean> => {
    switch (step) {
      case 1:
        const emailValid = await trigger('email')
        const passwordValid = await trigger('password')
        return emailValid && passwordValid && password === confirmPassword && password.length >= 8
      case 2:
        return emailVerified
      case 3:
        return await trigger(['facilityInfo.name', 'facilityInfo.city', 'facilityInfo.region', 'facilityInfo.phone'])
      default:
        return true
    }
  }

  const handleSendVerificationCode = async () => {
    if (!watchedValues.email) {
      toast.error('Please enter your email first')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    setIsSendingCode(true)
    try {
      const response = await fetch('/api/auth/send-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: watchedValues.email?.toLowerCase().trim() || '' }),
      })

      if (!response.ok) {
        const result = await response.json()
        toast.error(result.error || 'Failed to send verification code')
        return
      }

      toast.success('Verification code sent to your email')
      setVerificationCode('')
      setCurrentStep(2)
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

    setIsVerifying(true)
    try {
      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: watchedValues.email?.toLowerCase().trim() || '',
          code: verificationCode.trim()
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        toast.error(result.error || 'Invalid verification code')
        return
      }

      setEmailVerified(true)
      toast.success('Email verified successfully!')
      setCurrentStep(3)
    } catch (error) {
      console.error('Verify code error:', error)
      toast.error('An error occurred. Please try again.')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleNext = async () => {
    const isValid = await validateStep(currentStep)
    if (!isValid) {
      toast.error('Please complete all required fields')
      return
    }

    if (currentStep < 4) {
      setCurrentStep((currentStep + 1) as Step)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step)
    }
  }

  const onSubmit = async (data: RegisterForm) => {
    console.log('=== REGISTRATION SUBMISSION STARTED ===')
    console.log('Form data:', data)
    console.log('Email verified:', emailVerified)
    console.log('Current step:', currentStep)

    if (!emailVerified) {
      toast.error('Please verify your email first')
      return
    }

    // Ensure name is set from facility name
    const finalData = {
      ...data,
      name: data.facilityInfo?.name || data.name,
      password: password, // Use local password state
    }

    console.log('Final data for submission:', { ...finalData, password: '***' })

    setIsLoading(true)
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(finalData),
      })

      console.log('API Response status:', response.status)

      const result = await response.json()
      console.log('API Response:', result)

      if (!response.ok) {
        const errorMessage = result.message || result.error || 'Failed to create account'
        toast.error(errorMessage)
        return
      }

      console.log('=== REGISTRATION SUCCESSFUL ===')
      toast.success('Account created successfully! Please sign in to continue.')
      
      setTimeout(() => {
        router.push('/auth/signin')
      }, 2000)
    } catch (error) {
      console.error('Submit error:', error)
      toast.error('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="facility@example.com"
                  {...register("email")}
                  disabled={isLoading}
                  className="pl-10"
                />
              </div>
              {errors.email && (
                <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password (min 8 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  <Lock className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  className="pl-10"
                />
              </div>
              {password !== confirmPassword && (
                <p className="text-sm text-red-600 mt-1">Passwords do not match</p>
              )}
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6 text-center">
            <div className="bg-blue-50 p-6 rounded-lg">
              <Mail className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Check your email</h3>
              <p className="text-gray-600 mb-4">
                We sent a 6-digit verification code to<br />
                <span className="font-medium">{watchedValues.email}</span>
              </p>
            </div>

            <div>
              <Label htmlFor="verificationCode" className="text-sm font-medium">Verification Code</Label>
              <Input
                id="verificationCode"
                type="text"
                placeholder="Enter 6-digit code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={isVerifying}
                className="text-center text-lg tracking-widest"
                maxLength={6}
              />
            </div>

            <Button
              type="button"
              onClick={handleVerifyCode}
              disabled={isVerifying || verificationCode.length !== 6}
              className="w-full"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Email'
              )}
            </Button>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <Label htmlFor="facilityName" className="text-sm font-medium">Facility Name</Label>
              <div className="relative mt-1">
                <Building2 className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="facilityName"
                  type="text"
                  placeholder="Enter facility name"
                  {...register("facilityInfo.name")}
                  disabled={isLoading}
                  className="pl-10"
                />
              </div>
              {errors.facilityInfo?.name && (
                <p className="text-sm text-red-600 mt-1">{errors.facilityInfo.name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="facilityPhone" className="text-sm font-medium">Phone Number</Label>
              <div className="relative mt-1">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="facilityPhone"
                  type="tel"
                  placeholder="+255 712 345 678"
                  {...register("facilityInfo.phone")}
                  disabled={isLoading}
                  className="pl-10"
                />
              </div>
              {errors.facilityInfo?.phone && (
                <p className="text-sm text-red-600 mt-1">{errors.facilityInfo.phone.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="facilityCity" className="text-sm font-medium">City</Label>
              <div className="relative mt-1">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="facilityCity"
                  type="text"
                  placeholder="Enter city"
                  {...register("facilityInfo.city")}
                  disabled={isLoading}
                  className="pl-10"
                />
              </div>
              {errors.facilityInfo?.city && (
                <p className="text-sm text-red-600 mt-1">{errors.facilityInfo.city.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="facilityRegion" className="text-sm font-medium">Region</Label>
              <Input
                id="facilityRegion"
                type="text"
                placeholder="Enter region"
                {...register("facilityInfo.region")}
                disabled={isLoading}
              />
              {errors.facilityInfo?.region && (
                <p className="text-sm text-red-600 mt-1">{errors.facilityInfo.region.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="facilityAddress" className="text-sm font-medium">Address (Optional)</Label>
              <Input
                id="facilityAddress"
                type="text"
                placeholder="Enter address (optional)"
                {...register("facilityInfo.address")}
                disabled={isLoading}
              />
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div className="bg-green-50 p-6 rounded-lg">
              <CheckCircle2 className="h-8 w-8 text-green-600 mb-4" />
              <h3 className="text-lg font-semibold mb-4">Review Your Information</h3>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">Email:</span>
                  <span>{watchedValues.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Facility Name:</span>
                  <span>{watchedValues.facilityInfo?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Phone:</span>
                  <span>{watchedValues.facilityInfo?.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">City:</span>
                  <span>{watchedValues.facilityInfo?.city}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Region:</span>
                  <span>{watchedValues.facilityInfo?.region}</span>
                </div>
                {watchedValues.facilityInfo?.address && (
                  <div className="flex justify-between">
                    <span className="font-medium">Address:</span>
                    <span>{watchedValues.facilityInfo.address}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-sm text-yellow-800">
                By clicking "Create Account", you agree to create a facility account with the information above.
              </p>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Create Facility Account</h1>
            <p className="text-sm text-gray-600 mt-2">
              Step {currentStep} of {steps.length}: {steps[currentStep - 1].title}
            </p>
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {renderStepContent()}

            <div className="flex justify-between">
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={isLoading}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              )}

              <div className="ml-auto">
                {currentStep === 1 ? (
                  <Button
                    type="button"
                    onClick={handleSendVerificationCode}
                    disabled={isSendingCode || !watchedValues.email || !password || password !== confirmPassword}
                  >
                    {isSendingCode ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending Code...
                      </>
                    ) : (
                      'Send Verification Code'
                    )}
                  </Button>
                ) : currentStep < 4 ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={isLoading}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </Button>
                )}
              </div>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link href="/auth/signin" className="text-blue-600 hover:text-blue-500">
                Sign in
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
