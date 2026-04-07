"use client"

import { Suspense, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, AlertCircle, ArrowLeft, Mail, CheckCircle2 } from "lucide-react"
import { z } from "zod"
import { toast } from "sonner"
import Link from "next/link"
import { AuthLogoBadge } from "@/components/auth/auth-logo-badge"

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>

function ForgotPasswordContent() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const onSubmit = async (data: ForgotPasswordForm) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      })

      const result = await response.json()

      if (response.ok) {
        setIsSuccess(true)
        toast.success(result.message || 'Password reset link sent!')
      } else {
        toast.error(result.error || 'An error occurred. Please try again.')
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
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
              <AuthLogoBadge className="mb-4" priority size={90} />
              <CardTitle className="text-2xl font-bold text-gray-900 mb-1.5 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Check Your Email
              </CardTitle>
              <CardDescription className="text-sm text-gray-600">
                We've sent a password reset link to your email address
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-600 text-center">
                  If an account with that email exists, you will receive a password reset link shortly.
                </p>
                <p className="text-xs text-gray-500 text-center">
                  The link will expire in 1 hour. Please check your spam folder if you don't see it.
                </p>
                <Button
                  onClick={() => router.push('/auth/signin')}
                  className="w-full h-11 text-sm bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold shadow-md hover:shadow-lg transition-all"
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
            <AuthLogoBadge className="mb-4" priority size={90} />
            <CardTitle className="text-2xl font-bold text-gray-900 mb-1.5">
              Forgot Password?
            </CardTitle>
            <CardDescription className="text-sm text-gray-600">
              Enter your email address and we'll send you a link to reset your password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold text-green-800 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-green-600" />
                  Email Address
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    {...register("email")}
                    disabled={isLoading}
                    className="h-11 pl-10 border border-green-200/60 bg-green-50/30 focus:border-green-500 focus:ring-green-500/30 focus:bg-green-50/50 transition-all text-sm"
                  />
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" />
                </div>
                {errors.email && (
                  <p className="text-sm text-red-600 mt-1.5 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {errors.email.message}
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
                    Sending...
                  </>
                ) : (
                  "Send Reset Link"
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

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50/50 via-green-50/30 to-emerald-50/40 p-4">
        <Card className="w-full max-w-sm border border-green-200/60 shadow-xl bg-white/90 backdrop-blur-sm">
          <CardHeader className="text-center">
            <AuthLogoBadge className="mb-4" priority size={90} />
            <CardTitle className="text-xl text-green-800">Loading...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    }>
      <ForgotPasswordContent />
    </Suspense>
  )
}

