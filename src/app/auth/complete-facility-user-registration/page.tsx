"use client"

import { Suspense, useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, CheckCircle2, XCircle, Building2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { PasswordStrengthIndicator } from "@/components/ui/password-strength"
import { validatePassword } from "@/lib/password-validation"
import { AuthLogoBadge } from "@/components/auth/auth-logo-badge"

function CompleteFacilityUserRegistrationContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')
  
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [userInfo, setUserInfo] = useState<{ name: string; facilityName: string; role: string } | null>(null)

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('No token provided')
      return
    }

    // Fetch user info to display in the form
    const fetchUserInfo = async () => {
      try {
        const response = await fetch(`/api/users/get-invitation-info?token=${token}`)
        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            setUserInfo(result.data)
          }
        }
      } catch (error) {
        console.error('Error fetching user info:', error)
      }
    }

    fetchUserInfo()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!token) {
      toast.error('Invalid link')
      return
    }

    // Client-side password validation
    const validation = validatePassword(password, {
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

    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setIsLoading(true)
    setStatus('idle')

    try {
      const response = await fetch('/api/users/complete-facility-user-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password,
          confirmPassword,
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
      toast.success('Registration complete! Redirecting to your dashboard...')
      
      // Redirect to facility dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard/facility')
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
              Redirecting you to your facility dashboard...
            </div>
            <Button asChild className="w-full bg-green-600 hover:bg-green-700">
              <Link href="/dashboard/facility">Go to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <AuthLogoBadge className="mb-4" size={80} />
          <CardTitle className="text-lg">Complete Your Registration</CardTitle>
          {userInfo && (
            <CardDescription className="text-sm">
              Join <strong>{userInfo.facilityName}</strong> as a <strong>{userInfo.role}</strong>
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {userInfo && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-blue-800">
                <Building2 className="w-4 h-4" />
                <span>
                  <strong>{userInfo.name}</strong> • {userInfo.facilityName} • {userInfo.role}
                </span>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label htmlFor="password" className="text-sm">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 12 characters"
                required
                minLength={12}
                disabled={isLoading}
                className="text-sm"
              />
              {password && (
                <PasswordStrengthIndicator password={password} className="mt-2" />
              )}
              <p className="text-xs text-gray-500 mt-1">
                Must include uppercase, lowercase, number, and special character
              </p>
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="text-sm">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                required
                disabled={isLoading}
                className="text-sm"
              />
            </div>

            <Button 
              type="submit" 
              disabled={isLoading || !password || !confirmPassword} 
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

          <div className="mt-3 text-center">
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

export default function CompleteFacilityUserRegistrationPage() {
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
      <CompleteFacilityUserRegistrationContent />
    </Suspense>
  )
}
