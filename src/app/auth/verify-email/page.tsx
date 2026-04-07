"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle, Loader2, Mail, AlertCircle } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { AuthLogoBadge } from "@/components/auth/auth-logo-badge"

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')
  const email = searchParams.get('email')
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'idle'>('loading')
  const [message, setMessage] = useState<string>('')
  const [resending, setResending] = useState(false)

  useEffect(() => {
    if (token) {
      verifyEmail(token)
    } else {
      setStatus('idle')
      setMessage('No verification token provided.')
    }
  }, [token])

  const verifyEmail = async (verificationToken: string) => {
    try {
      const response = await fetch(`/api/auth/verify-email?token=${verificationToken}`)
      const data = await response.json()

      if (response.ok) {
        setStatus('success')
        setMessage(data.message || 'Email verified successfully!')
        toast.success('Email verified successfully!')
        // Redirect to sign in after 3 seconds
        setTimeout(() => {
          router.push('/auth/signin')
        }, 3000)
      } else {
        setStatus('error')
        setMessage(data.error || data.message || 'Verification failed')
        toast.error(data.error || 'Verification failed')
      }
    } catch (error) {
      setStatus('error')
      setMessage('An error occurred while verifying your email. Please try again.')
      toast.error('An error occurred')
    }
  }

  const resendVerificationEmail = async () => {
    if (!email) {
      toast.error('Email address is required to resend verification email')
      return
    }

    setResending(true)
    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || 'Verification email sent!')
        setMessage(data.message || 'Verification email sent. Please check your inbox.')
      } else {
        toast.error(data.error || 'Failed to resend verification email')
        setMessage(data.error || 'Failed to resend verification email')
      }
    } catch (error) {
      toast.error('An error occurred')
      setMessage('An error occurred while resending the verification email.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex flex-col items-center gap-3 mb-4">
            <AuthLogoBadge className="mb-0" size={80} />
            <div className="w-16 h-16 bg-gradient-to-br from-accent to-success rounded-xl flex items-center justify-center">
              {status === 'loading' && <Loader2 className="w-8 h-8 text-white animate-spin" />}
              {status === 'success' && <CheckCircle2 className="w-8 h-8 text-white" />}
              {status === 'error' && <XCircle className="w-8 h-8 text-white" />}
              {status === 'idle' && <Mail className="w-8 h-8 text-white" />}
            </div>
          </div>
          <CardTitle className="text-2xl">
            {status === 'loading' && 'Verifying Email...'}
            {status === 'success' && 'Email Verified!'}
            {status === 'error' && 'Verification Failed'}
            {status === 'idle' && 'Email Verification'}
          </CardTitle>
          <CardDescription>
            {status === 'loading' && 'Please wait while we verify your email address'}
            {status === 'success' && 'Your email has been successfully verified'}
            {status === 'error' && 'We couldn\'t verify your email address'}
            {status === 'idle' && 'Verify your email address to continue'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <div className={`p-4 rounded-lg flex items-start gap-3 ${
              status === 'success' 
                ? 'bg-success/10 text-success border border-success/20' 
                : status === 'error'
                ? 'bg-destructive/10 text-destructive border border-destructive/20'
                : 'bg-muted'
            }`}>
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <p className="text-sm">{message}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground text-center">
                Redirecting to sign in page...
              </p>
              <Button 
                onClick={() => router.push('/auth/signin')} 
                className="w-full"
              >
                Go to Sign In
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground text-center">
                The verification link may have expired or is invalid.
              </p>
              {email && (
                <Button 
                  onClick={resendVerificationEmail}
                  disabled={resending}
                  variant="outline"
                  className="w-full"
                >
                  {resending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Resend Verification Email
                    </>
                  )}
                </Button>
              )}
              <Button 
                onClick={() => router.push('/auth/signin')} 
                variant="outline"
                className="w-full"
              >
                Go to Sign In
              </Button>
            </div>
          )}

          {status === 'idle' && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground text-center">
                Please check your email for the verification link, or request a new one.
              </p>
              {email && (
                <Button 
                  onClick={resendVerificationEmail}
                  disabled={resending}
                  className="w-full"
                >
                  {resending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Resend Verification Email
                    </>
                  )}
                </Button>
              )}
              <Button 
                onClick={() => router.push('/auth/signin')} 
                variant="outline"
                className="w-full"
              >
                Go to Sign In
              </Button>
            </div>
          )}

          <div className="pt-4 border-t">
            <Link 
              href="/auth/signin" 
              className="text-sm text-muted-foreground hover:underline text-center block"
            >
              ← Back to home
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/5 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Loading...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}

