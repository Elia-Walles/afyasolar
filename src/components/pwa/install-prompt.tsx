'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Download, X, Smartphone, ChevronDown, ChevronUp } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsStandalone(true)
      // Mark as handled so we never show again on this device
      try {
        localStorage.setItem('pwa-install-handled', 'true')
      } catch {
        // ignore storage errors
      }
      return
    }

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(iOS)

    // Listen for beforeinstallprompt event (Android/Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      try {
        const hasHandled = localStorage.getItem('pwa-install-handled') === 'true'
        if (hasHandled) {
          // User has already installed or dismissed; don't show again
          return
        }
      } catch {
        // If we can't read localStorage, fall back to showing once per session
      }

      // Intercept the default mini-infobar and show our custom UI instead
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowInstallPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // For iOS, show custom prompt after a delay
    if (iOS) {
      const timer = setTimeout(() => {
        try {
          const hasHandled = localStorage.getItem('pwa-install-handled') === 'true'
          if (!hasHandled) {
            setShowInstallPrompt(true)
          }
        } catch {
          setShowInstallPrompt(true)
        }
      }, 3000) // Show after 3 seconds

      return () => {
        clearTimeout(timer)
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Show the install prompt
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === 'accepted') {
        console.log('User accepted the install prompt')
        try {
          localStorage.setItem('pwa-install-handled', 'true')
        } catch {
          // ignore
        }
      } else {
        console.log('User dismissed the install prompt')
        try {
          localStorage.setItem('pwa-install-handled', 'true')
        } catch {
          // ignore
        }
      }

      setDeferredPrompt(null)
      setShowInstallPrompt(false)
    }
  }

  const handleDismiss = () => {
    setShowInstallPrompt(false)
    try {
      // Mark as handled so we don't nag again on this device
      localStorage.setItem('pwa-install-handled', 'true')
    } catch {
      // ignore
    }
  }

  if (isStandalone || !showInstallPrompt) {
    return null
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100]">
      <div 
        className={cn(
          "bg-white rounded-xl shadow-xl border-2 border-green-400 overflow-hidden transition-all duration-300 animate-glow",
          showInstallPrompt ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
        )}
        style={{
          animation: 'glow 2s ease-in-out infinite',
        }}
      >
        <style jsx>{`
          @keyframes glow {
            0%, 100% {
              box-shadow: 0 0 5px rgba(34, 197, 94, 0.4), 0 0 10px rgba(34, 197, 94, 0.3), 0 0 15px rgba(34, 197, 94, 0.2);
            }
            50% {
              box-shadow: 0 0 10px rgba(34, 197, 94, 0.6), 0 0 20px rgba(34, 197, 94, 0.5), 0 0 30px rgba(34, 197, 94, 0.4);
            }
          }
        `}</style>
        {/* Main notification */}
        <div className="p-3 flex items-center gap-3">
          {/* Logo */}
          <div className="relative w-10 h-10 rounded-full bg-green-100 p-1 flex-shrink-0">
            <Image
              src="/images/services/logo.png"
              alt="Afya Solar"
              width={40}
              height={40}
              className="rounded-full"
            />
          </div>

          {/* Text */}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">
              Install Afya Solar
            </p>
            <p className="text-xs text-gray-500">
              Better experience & offline access
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 ml-2">
            {isIOS ? (
              <Button
                onClick={() => setIsExpanded(!isExpanded)}
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white text-xs h-8 px-3"
              >
                How to
                {isExpanded ? (
                  <ChevronUp className="w-3 h-3 ml-1" />
                ) : (
                  <ChevronDown className="w-3 h-3 ml-1" />
                )}
              </Button>
            ) : (
              <Button
                onClick={handleInstallClick}
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white text-xs h-8 px-3 animate-pulse"
              >
                <Download className="w-3 h-3 mr-1" />
                Install
              </Button>
            )}
            <Button
              onClick={handleDismiss}
              size="sm"
              variant="ghost"
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 h-8 w-8 p-0"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* iOS Instructions - Expandable */}
        {isIOS && isExpanded && (
          <div className="bg-gray-50 border-t border-gray-100 p-3">
            <div className="flex items-start gap-2">
              <Smartphone className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <ol className="list-decimal list-inside space-y-1 text-xs text-gray-600">
                <li>Tap <span className="font-medium text-gray-900">Share</span> <span className="font-mono bg-gray-200 px-1 rounded text-[10px]">□↑</span></li>
                <li>Tap <span className="font-medium text-gray-900">&quot;Add to Home Screen&quot;</span></li>
                <li>Tap <span className="font-medium text-gray-900">&quot;Add&quot;</span></li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
