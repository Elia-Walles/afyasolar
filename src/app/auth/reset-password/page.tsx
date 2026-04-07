"use client"

import { Suspense, useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, AlertCircle, ArrowLeft, Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react"
import { z } from "zod"
import { toast } from "sonner"
import Link from "next/link"
import { PasswordStrengthIndicator } from "@/components/ui/password-strength"
import { validatePassword } from "@/lib/password-validation"
import { AuthLogoBadge } from "@/components/auth/auth-logo-badge"

const resetPasswordSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [isLoading, setIsLoading] = useState(false)
  const [isValidating, setIsValidating] = useState(true)
  const [isValid, setIsValid] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
  })

  const password = watch('password')

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setIsValidating(false)
        setIsValid(false)
        return
      }

      try {
        const response = await fetch(`/api/auth/reset-password?token=${token}`)
        const result = await response.json()
        setIsValid(result.valid === true)
      } catch (error) {
        setIsValid(false)
      } finally {
        setIsValidating(false)
      }
    }

    validateToken()
  }, [token])

  const onSubmit = async (data: ResetPasswordForm) => {
    if (!token) {
      toast.error('Invalid reset token')
      return
    }

    // Validate password strength
    const passwordValidation = validatePassword(data.password, {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
      requireSpecial: true,
      minStrength: 2,
    })

    if (!passwordValidation.isValid) {
      toast.error(passwordValidation.errors[0] || 'Password does not meet requirements')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: data.password }),
      })

      const result = await response.json()

      if (response.ok) {
        setIsSuccess(true)
        toast.success('Password reset successfully!')
        setTimeout(() => {
          router.push('/auth/signin')
        }, 2000)
      } else {
        toast.error(result.error || 'An error occurred. Please try again.')
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50/50 via-green-50/30 to-emerald-50/40 p-4">
        <Card className="w-full max-w-sm border border-green-200/60 shadow-xl bg-white/90 backdrop-blur-sm">
          <CardHeader className="text-center">
            <AuthLogoBadge className="mb-4" priority size={90} />
            <CardTitle className="text-xl text-green-800">Validating token...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (!isValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50/50 via-green-50/30 to-emerald-50/40 p-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-green-200/50 to-emerald-200/50 rounded-full blur-3xl -z-10 animate-pulse" />
        
        <div className="w-full max-w-sm relative z-10">
          <Card className="border border-red-200/60 shadow-xl bg-white/90 backdrop-blur-sm">
            <CardHeader className="text-center pb-5">
              <AuthLogoBadge className="mb-4" size={90} />
              <CardTitle className="text-2xl font-bold text-gray-900 mb-1.5 flex items-center justify-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                Invalid or Expired Link
              </CardTitle>
              <CardDescription className="text-sm text-gray-600">
                This password reset link is invalid or has expired
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-600 text-center">
                  Password reset links expire after 1 hour. Please request a new one.
                </p>
                <Button
                  onClick={() => router.push('/auth/forgot-password')}
                  className="w-full h-11 text-sm bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold shadow-md hover:shadow-lg transition-all"
                >
                  Request New Reset Link
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push('/auth/signin')}
                  className="w-full h-11 text-sm"
                >
                  Back to Sign In
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50/50 via-green-50/30 to-emerald-50/40 p-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-green-200/50 to-emerald-200/50 rounded-full blur-3xl -z-10 animate-pulse" />
        
        <div className="w-full max-w-sm relative z-10">
          <Card className="border border-green-200/60 shadow-xl bg-white/90 backdrop-blur-sm">
            <CardHeader className="text-center pb-5">
              <AuthLogoBadge className="mb-4" size={90} />
              <CardTitle className="text-2xl font-bold text-gray-900 mb-1.5 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Password Reset Successful!
              </CardTitle>
              <CardDescription className="text-sm text-gray-600">
                Your password has been reset successfully
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 text-center mb-4">
                Redirecting to sign in page...
              </p>
              <Button
                onClick={() => router.push('/auth/signin')}
                className="w-full h-11 text-sm bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold shadow-md hover:shadow-lg transition-all"
              >
                Go to Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50/50 via-green-50/30 to-emerald-50/40 p-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-green-200/50 to-emerald-200/50 rounded-full blur-3xl -z-10 animate-pulse" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-green-200/40 to-emerald-200/40 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDelay: '1s' }} />
      
      <div className="w-full max-w-sm relative z-10">
        <Link 
          href="/auth/signin" 
          className="inline-flex items-center gap-2 text-sm text-green-700 hover:text-green-800 font-medium mb-6 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to sign in</span>
        </Link>

        <Card className="border border-green-200/60 shadow-xl bg-white/90 backdrop-blur-sm">
          <CardHeader className="text-center pb-5">
            <AuthLogoBadge className="mb-4" size={90} />
            <CardTitle className="text-2xl font-bold text-gray-900 mb-1.5">
              Reset Password
            </CardTitle>
            <CardDescription className="text-sm text-gray-600">
              Enter your new password below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold text-green-800 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-green-600" />
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your new password"
                    {...register("password")}
                    disabled={isLoading}
                    className="h-11 pl-10 pr-10 border border-green-200/60 bg-green-50/30 focus:border-green-500 focus:ring-green-500/30 focus:bg-green-50/50 transition-all text-sm"
                  />
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 hover:text-green-700 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {password && <PasswordStrengthIndicator password={password} />}
                {errors.password && (
                  <p className="text-sm text-red-600 mt-1.5 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-semibold text-green-800 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-green-600" />
                  Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your new password"
                    {...register("confirmPassword")}
                    disabled={isLoading}
                    className="h-11 pl-10 pr-10 border border-green-200/60 bg-green-50/30 focus:border-green-500 focus:ring-green-500/30 focus:bg-green-50/50 transition-all text-sm"
                  />
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 hover:text-green-700 transition-colors"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-sm text-red-600 mt-1.5 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full h-11 text-sm bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold shadow-md hover:shadow-lg transition-all" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </form>

            <div className="mt-5 pt-5 border-t border-green-200/60">
              <p className="text-center text-xs text-green-800">
                Remember your password?{" "}
                <Link 
                  href="/auth/signin" 
                  className="text-green-600 hover:text-green-700 font-bold transition-colors underline underline-offset-2"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50/50 via-green-50/30 to-emerald-50/40 p-4">
        <Card className="w-full max-w-sm border border-green-200/60 shadow-xl bg-white/90 backdrop-blur-sm">
          <CardHeader className="text-center">
            <AuthLogoBadge className="mb-4" size={90} />
            <CardTitle className="text-xl text-green-800">Loading...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}

