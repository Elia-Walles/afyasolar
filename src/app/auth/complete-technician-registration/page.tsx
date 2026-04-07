"use client"

import { Suspense, useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, CheckCircle2, XCircle, Eye, EyeOff } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { PasswordStrengthIndicator } from "@/components/ui/password-strength"
import { validatePassword } from "@/lib/password-validation"
import { AuthLogoBadge } from "@/components/auth/auth-logo-badge"

function CompleteTechnicianRegistrationContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')
  
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
    yearsExperience: '',
    practicingLicense: '',
    shortBio: '',
    regionId: '',
    districtId: '',
  })
  const [regions, setRegions] = useState<Array<{ id: number; name: string }>>([])
  const [districts, setDistricts] = useState<Array<{ id: number; name: string; regionId: number }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingRegions, setIsLoadingRegions] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('No token provided')
    }
    // Load regions
    loadRegions()
  }, [token])

  const loadRegions = async () => {
    try {
      setIsLoadingRegions(true)
      const response = await fetch('/api/regions')
      if (response.ok) {
        const result = await response.json()
        setRegions(result.data || [])
      }
    } catch (error) {
      console.error('Error loading regions:', error)
    } finally {
      setIsLoadingRegions(false)
    }
  }

  const loadDistricts = async (regionId: number) => {
    try {
      const response = await fetch(`/api/districts?regionId=${regionId}`)
      if (response.ok) {
        const result = await response.json()
        setDistricts(result.data || [])
      }
    } catch (error) {
      console.error('Error loading districts:', error)
    }
  }

  const handleRegionChange = (regionId: string) => {
    setFormData({ ...formData, regionId, districtId: '' })
    if (regionId) {
      loadDistricts(parseInt(regionId))
    } else {
      setDistricts([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!token) {
      toast.error('Invalid link')
      return
    }

    // Client-side password validation
    const validation = validatePassword(formData.password, {
      minLength: 12,
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

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (!formData.firstName || !formData.lastName) {
      toast.error('First name and last name are required')
      return
    }

    setIsLoading(true)
    setStatus('idle')

    try {
      const response = await fetch('/api/technicians/complete-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone || undefined,
          yearsExperience: formData.yearsExperience ? parseInt(formData.yearsExperience) : undefined,
          practicingLicense: formData.practicingLicense || undefined,
          shortBio: formData.shortBio || undefined,
          regionId: formData.regionId ? parseInt(formData.regionId) : undefined,
          districtId: formData.districtId ? parseInt(formData.districtId) : undefined,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setStatus('error')
        setMessage(result.error || 'Registration failed')
        toast.error(result.error || 'Registration failed')
        return
      }

      setStatus('success')
      setMessage(result.message || 'Registration complete')
      toast.success('Registration complete. Check your email to verify.')
      
      setTimeout(() => {
        router.push('/auth/signin')
      }, 2000)
    } catch (error) {
      setStatus('error')
      setMessage('An error occurred')
      toast.error('An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AuthLogoBadge className="mb-4" size={80} />
            <CardTitle className="text-lg flex items-center justify-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              Invalid Invitation
            </CardTitle>
            <CardDescription className="text-sm">No token provided</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full bg-green-600 hover:bg-green-700">
              <Link href="/auth/signin">Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AuthLogoBadge className="mb-4" size={80} />
            <CardTitle className="text-lg flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Registration Complete
            </CardTitle>
            <CardDescription className="text-sm">{message}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-green-50 p-3 rounded text-xs text-gray-700">
              Check your email to verify your account.
            </div>
            <Button asChild className="w-full bg-green-600 hover:bg-green-700">
              <Link href="/auth/signin">Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="text-center">
          <AuthLogoBadge className="mb-4" size={80} />
          <CardTitle className="text-lg">Complete Technician Registration</CardTitle>
          <CardDescription className="text-sm">Fill in your details to complete your registration</CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'error' && (
            <div className="mb-4 p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Personal Information */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Personal Information</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName" className="text-sm">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="John"
                    required
                    disabled={isLoading}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName" className="text-sm">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="Doe"
                    required
                    disabled={isLoading}
                    className="text-sm"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="phone" className="text-sm">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+255 700 123 456"
                  disabled={isLoading}
                  className="text-sm"
                />
              </div>
            </div>

            {/* Professional Information */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Professional Information</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="yearsExperience" className="text-sm">Years of Experience</Label>
                  <Input
                    id="yearsExperience"
                    type="number"
                    min="0"
                    value={formData.yearsExperience}
                    onChange={(e) => setFormData({ ...formData, yearsExperience: e.target.value })}
                    placeholder="5"
                    disabled={isLoading}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="practicingLicense" className="text-sm">ERD Certificate</Label>
                  <Input
                    id="practicingLicense"
                    value={formData.practicingLicense}
                    onChange={(e) => setFormData({ ...formData, practicingLicense: e.target.value })}
                    placeholder="ERD certificate number"
                    disabled={isLoading}
                    className="text-sm"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="shortBio" className="text-sm">Short Bio</Label>
                <Textarea
                  id="shortBio"
                  value={formData.shortBio}
                  onChange={(e) => setFormData({ ...formData, shortBio: e.target.value })}
                  placeholder="Brief description of your experience and expertise..."
                  rows={3}
                  disabled={isLoading}
                  className="text-sm"
                />
              </div>
            </div>

            {/* Location */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Location</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="regionId" className="text-sm">Region</Label>
                  <Select
                    value={formData.regionId}
                    onValueChange={handleRegionChange}
                    disabled={isLoading || isLoadingRegions}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      {regions.map((region) => (
                        <SelectItem key={region.id} value={region.id.toString()}>
                          {region.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="districtId" className="text-sm">District</Label>
                  <Select
                    value={formData.districtId}
                    onValueChange={(value) => setFormData({ ...formData, districtId: value })}
                    disabled={isLoading || !formData.regionId}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Select district" />
                    </SelectTrigger>
                    <SelectContent>
                      {districts.map((district) => (
                        <SelectItem key={district.id} value={district.id.toString()}>
                          {district.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Set Password</h3>
              <div>
                <Label htmlFor="password" className="text-sm">Password *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Min 12 characters"
                    required
                    minLength={12}
                    disabled={isLoading}
                    className="text-sm pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-800"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {formData.password && (
                  <PasswordStrengthIndicator password={formData.password} className="mt-2" />
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Must include uppercase, lowercase, number, and special character
                </p>
              </div>
              <div>
                <Label htmlFor="confirmPassword" className="text-sm">Confirm Password *</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="Confirm password"
                    required
                    disabled={isLoading}
                    className="text-sm pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-800"
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={isLoading || !formData.password || !formData.confirmPassword || !formData.firstName || !formData.lastName} 
              className="w-full bg-green-600 hover:bg-green-700 text-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Completing Registration...
                </>
              ) : (
                'Complete Registration'
              )}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link 
              href="/auth/signin" 
              className="text-xs text-gray-600 hover:text-gray-900 hover:underline"
            >
              Already have an account? Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function CompleteTechnicianRegistrationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-sm">Loading...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    }>
      <CompleteTechnicianRegistrationContent />
    </Suspense>
  )
}

