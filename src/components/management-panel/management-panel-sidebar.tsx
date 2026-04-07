'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  Building2,
  Receipt,
  Menu,
  X,
  LogOut,
  ChevronRight,
  Gauge,
  Package,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard/management-panel', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/management-panel/sites', label: 'Installation Sites', icon: Building2 },
  { href: '/dashboard/management-panel/packages', label: 'Package Management', icon: Package },
  { href: '/dashboard/management-panel/energy-efficiency', label: 'Energy Efficiency', icon: Gauge },
  { href: '/dashboard/management-panel/payment-history', label: 'Payment History', icon: Receipt },
]

export function ManagementPanelSidebar() {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile menu button */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2.5 rounded-xl bg-white border border-gray-200 shadow-sm hover:bg-gray-50 active:scale-95 transition-all duration-200"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5 text-gray-600" />
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm',
          'transition-transform duration-300 ease-out',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full min-h-screen overflow-y-auto">
          {/* Header */}
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
            <Link
              href="/dashboard/management-panel"
              className="flex items-center gap-2.5 min-w-0 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors p-1 -m-1"
            >
              <div className="relative w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex-shrink-0 overflow-hidden ring-1 ring-gray-200/50">
                <Image
                  src="/images/services/logo.png"
                  alt="Ubuntu Afyalink"
                  fill
                  className="object-contain p-1"
                  sizes="36px"
                />
              </div>
              <span className="font-semibold text-gray-900 truncate text-sm">Management Panel</span>
            </Link>
            <button
              type="button"
              onClick={() => (window.innerWidth >= 1024 ? setSidebarOpen(!sidebarOpen) : setMobileOpen(false))}
              className="p-1.5 rounded-lg hover:bg-gray-100 lg:block hidden"
            >
              {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="p-1.5 rounded-lg hover:bg-gray-100 lg:hidden"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || (item.href !== '/dashboard/management-panel' && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border-l-4',
                    isActive
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm shadow-emerald-600/20'
                      : 'border-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900 active:scale-[0.99]'
                  )}
                >
                  <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-white' : 'text-gray-500')} />
                  <span className="flex-1">{item.label}</span>
                  <ChevronRight className={cn('w-4 h-4 opacity-70 shrink-0', isActive && 'text-white')} />
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="p-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              Sign out
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
