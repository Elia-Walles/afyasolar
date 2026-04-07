import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { randomUUID } from 'crypto'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate a unique ID using crypto.randomUUID()
 */
export function generateId(): string {
  return randomUUID()
}

/**
 * Format currency in Tanzanian Shillings
 */
export function formatCurrency(amount: number | null | undefined): string {
  const numAmount = amount ?? 0
  if (isNaN(numAmount)) return '0 TZS'
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numAmount)
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-TZ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

/**
 * Format date and time for display
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return 'N/A'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return 'Invalid date'
  return new Intl.DateTimeFormat('en-TZ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/**
 * Calculate days remaining based on credit balance and daily consumption
 */
export function calculateDaysRemaining(creditBalance: number, dailyConsumption: number): number {
  if (dailyConsumption <= 0) return 0
  return Math.floor(creditBalance / dailyConsumption)
}

/**
 * Validate serial number format (ABC-12345)
 */
export function validateSerialNumber(serial: string): boolean {
  const pattern = /^[A-Z]{3}-[0-9]{5}$/
  return pattern.test(serial)
}

/**
 * Format serial number from parts
 */
export function formatSerialNumber(prefix: string, suffix: string): string {
  return `${prefix.toUpperCase()}-${suffix}`
}

/**
 * Convert a string into a URL-friendly slug
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Format currency in Tanzanian Shillings (TZS)
 * Alias for formatCurrency for Afya Finance compatibility
 */
export function formatTZS(amount: number): string {
  return formatCurrency(amount)
}

