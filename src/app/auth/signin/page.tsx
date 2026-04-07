"use client"

import { Suspense, useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, AlertCircle, Eye, EyeOff, Mail, Lock, Sun } from "lucide-react"
import { loginSchema } from "@/lib/validations"
import type { z } from "zod"
import { toast } from "sonner"
import Link from "next/link"
import Image from "next/image"

type LoginForm = z.infer<typeof loginSchema>

function SignInContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const callbackUrl = searchParams.get("callbackUrl") || "/"

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (result?.error) {
        if (result.error.includes("ACCOUNT_LOCKED")) {
          const minutes = result.error.split(":")[1] || "30"
          toast.error(`Account locked. Try again in ${minutes} minutes.`)
          return
        }

        if (result.error === "CredentialsSignin" || result.error.includes("EMAIL_NOT_VERIFIED")) {
          const errorResponse = await fetch("/api/auth/check-verification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: data.email }),
          })

          if (errorResponse.ok) {
            const errorData = await errorResponse.json()
            if (errorData.requiresVerification) {
              toast.error("Verify your email first")
              router.push(`/auth/verify-email?email=${encodeURIComponent(data.email)}`)
              return
            }
          }
        }
        toast.error("Invalid email or password")
      } else if (result?.ok) {
        toast.success("Signed in successfully")
        setIsRedirecting(true)
        setTimeout(async () => {
          try {
            const sessionResponse = await fetch("/api/auth/session")
            if (sessionResponse.ok) {
              const session = await sessionResponse.json()
              const userRole = session?.user?.role

              const email = session?.user?.email?.toLowerCase()
              if (email === "services@ubuntuafyalink.co.tz") {
                window.location.href = "/dashboard/management-panel"
                return
              }
              if (userRole === "investor") {
                window.location.href = "/dashboard/investor"
              } else if (userRole === "technician") {
                window.location.href = "/dashboard/technician"
              } else if (userRole === "admin") {
                window.location.href = "/dashboard/admin"
              } else if (userRole === "facility") {
                window.location.href = "/"
              } else {
                window.location.href = callbackUrl
              }
            } else {
              window.location.href = callbackUrl
            }
          } catch {
            window.location.href = callbackUrl
          }
        }, 100)
      }
    } catch {
      toast.error("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50/50 via-green-50/30 to-emerald-50/40 p-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-green-200/50 to-emerald-200/50 rounded-full blur-3xl -z-10 animate-pulse" />
      <div
        className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-green-200/40 to-emerald-200/40 rounded-full blur-3xl -z-10 animate-pulse"
        style={{ animationDelay: "1s" }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-r from-green-100/30 to-emerald-100/30 rounded-full blur-3xl -z-10 animate-pulse"
        style={{ animationDelay: "0.5s" }}
      />

      {isRedirecting && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-green-600" />
            <p className="text-sm text-gray-700 font-medium">Opening Afya Solar…</p>
          </div>
        </div>
      )}

      <div className="w-full max-w-sm relative z-10">
        <Card className="border border-green-200/60 shadow-xl bg-white/90 backdrop-blur-sm">
          <CardHeader className="text-center pb-5">
            <div className="relative mx-auto mb-4 w-20 h-20 flex-shrink-0 rounded-full overflow-hidden border-2 border-emerald-200 bg-white shadow-lg">
              <Image
                src="/images/services/logo.png"
                alt="Afya Solar"
                fill
                className="object-contain p-2"
                priority
              />
            </div>
            <div className="flex items-center justify-center gap-2 text-green-800 mb-1">
              <Sun className="w-5 h-5 text-green-600" aria-hidden />
              <span className="text-xs font-semibold uppercase tracking-wide">Afya Solar</span>
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900 mb-1.5">Sign in</CardTitle>
            <CardDescription className="text-sm text-gray-600">
              Solar energy dashboards and monitoring for your healthcare facility
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold text-green-800 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-green-600" />
                  Email address
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    {...register("email")}
                    disabled={isLoading || isRedirecting}
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

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold text-green-800 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-green-600" />
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    {...register("password")}
                    disabled={isLoading || isRedirecting}
                    className="h-11 pl-10 pr-10 border border-green-200/60 bg-green-50/30 focus:border-green-500 focus:ring-green-500/30 focus:bg-green-50/50 transition-all text-sm"
                  />
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 hover:text-green-700 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-red-600 mt-1.5 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between text-sm">
                <Link href="/auth/forgot-password" className="text-green-600 hover:text-green-700 font-medium transition-colors">
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-sm bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold shadow-md hover:shadow-lg transition-all"
                disabled={isLoading || isRedirecting}
              >
                {isLoading || isRedirecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isRedirecting ? "Redirecting…" : "Signing in…"}
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>

            <div className="mt-5 pt-5 border-t border-green-200/60 space-y-2">
              <p className="text-center text-xs text-green-800">
                Need an account?{" "}
                <Link
                  href="/auth/signup"
                  className="text-green-600 hover:text-green-700 font-bold underline underline-offset-2"
                >
                  Register your facility
                </Link>
              </p>
              <p className="text-center text-[11px] text-gray-600">
                By signing in, you agree to our{" "}
                <Link href="/terms" className="text-green-600 hover:text-green-700 font-semibold underline underline-offset-2">
                  Terms &amp; Conditions
                </Link>{" "}
                and{" "}
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
  )
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50/50 via-green-50/30 to-emerald-50/40 p-4">
          <Card className="w-full max-w-sm border border-green-200/60 shadow-xl bg-white/90 backdrop-blur-sm">
            <CardHeader className="text-center">
              <div className="relative mx-auto mb-4 w-20 h-20 flex-shrink-0 rounded-full overflow-hidden border-2 border-emerald-200 bg-white shadow-lg">
                <Image src="/images/services/logo.png" alt="Afya Solar" fill className="object-contain p-2" priority />
              </div>
              <CardTitle className="text-xl text-green-800">Loading…</CardTitle>
            </CardHeader>
          </Card>
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  )
}
