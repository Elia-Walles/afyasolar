/**
 * SMS Queue Management System
 * Handles queuing, processing, and retry logic for SMS notifications
 */

import { sendSMS } from '@/lib/sms'
import { db } from '@/lib/db'

export interface SMSData {
  id?: string
  to: string
  message: string
  sender?: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
  retryCount?: number
  maxRetries?: number
  scheduledAt?: Date
  metadata?: Record<string, any>
  createdAt?: Date
  lastAttemptAt?: Date
  status?: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled'
}

export interface SMSQueueStats {
  total: number
  pending: number
  processing: number
  sent: number
  failed: number
  cancelled: number
}

export class SMSQueue {
  private static instance: SMSQueue
  private isProcessing = false
  private processingInterval: NodeJS.Timeout | null = null

  static getInstance(): SMSQueue {
    if (!SMSQueue.instance) {
      SMSQueue.instance = new SMSQueue()
    }
    return SMSQueue.instance
  }

  /**
   * Add SMS to queue
   */
  async add(smsData: SMSData): Promise<string> {
    const id = crypto.randomUUID()
    const sms: SMSData = {
      id,
      to: smsData.to,
      message: smsData.message,
      sender: smsData.sender || 'Afyalink',
      priority: smsData.priority || 'medium',
      retryCount: 0,
      maxRetries: smsData.maxRetries || 3,
      scheduledAt: smsData.scheduledAt || new Date(),
      metadata: smsData.metadata || {},
      createdAt: new Date(),
      status: 'pending'
    }

    try {
      // In a real implementation, save to database
      console.log(`[SMSQueue] SMS added to queue: ${id}`, sms)
      return id
    } catch (error) {
      console.error('[SMSQueue] Failed to add SMS to queue:', error)
      throw error
    }
  }

  /**
   * Process pending SMS messages
   */
  async process(): Promise<void> {
    if (this.isProcessing) {
      console.log('[SMSQueue] Already processing, skipping')
      return
    }

    this.isProcessing = true
    console.log('[SMSQueue] Starting to process SMS queue')

    try {
      // Get pending SMS scheduled for now or earlier
      const pendingSMS = await this.getPendingSMS()
      
      for (const sms of pendingSMS) {
        await this.processSMS(sms)
      }
    } catch (error) {
      console.error('[SMSQueue] Error processing queue:', error)
    } finally {
      this.isProcessing = false
      console.log('[SMSQueue] Finished processing SMS queue')
    }
  }

  /**
   * Start automatic processing
   */
  start(intervalMs: number = 30000): void {
    if (this.processingInterval) {
      console.log('[SMSQueue] Already started')
      return
    }

    console.log(`[SMSQueue] Starting automatic processing (interval: ${intervalMs}ms)`)
    this.processingInterval = setInterval(() => {
      this.process().catch(error => {
        console.error('[SMSQueue] Error in automatic processing:', error)
      })
    }, intervalMs)

    // Process immediately on start
    this.process().catch(error => {
      console.error('[SMSQueue] Error in initial processing:', error)
    })
  }

  /**
   * Stop automatic processing
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
      console.log('[SMSQueue] Stopped automatic processing')
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<SMSQueueStats> {
    // In a real implementation, query database
    return {
      total: 0,
      pending: 0,
      processing: 0,
      sent: 0,
      failed: 0,
      cancelled: 0
    }
  }

  /**
   * Cancel SMS by ID
   */
  async cancel(smsId: string): Promise<boolean> {
    try {
      // In a real implementation, update database
      console.log(`[SMSQueue] SMS cancelled: ${smsId}`)
      return true
    } catch (error) {
      console.error('[SMSQueue] Failed to cancel SMS:', error)
      return false
    }
  }

  /**
   * Retry failed SMS
   */
  async retryFailed(): Promise<number> {
    try {
      const failedSMS = await this.getFailedSMS()
      let retriedCount = 0

      for (const sms of failedSMS) {
        if (sms.retryCount! < sms.maxRetries!) {
          await this.resetSMSForRetry(sms.id!)
          retriedCount++
        }
      }

      console.log(`[SMSQueue] Retried ${retriedCount} failed SMS`)
      return retriedCount
    } catch (error) {
      console.error('[SMSQueue] Failed to retry SMS:', error)
      return 0
    }
  }

  /**
   * Get pending SMS from database
   */
  private async getPendingSMS(): Promise<SMSData[]> {
    // In a real implementation, query database for pending SMS
    // For now, return empty array
    return []
  }

  /**
   * Get failed SMS from database
   */
  private async getFailedSMS(): Promise<SMSData[]> {
    // In a real implementation, query database for failed SMS
    // For now, return empty array
    return []
  }

  /**
   * Process individual SMS
   */
  private async processSMS(sms: SMSData): Promise<void> {
    try {
      // Update status to processing
      await this.updateSMSStatus(sms.id!, 'processing')
      sms.lastAttemptAt = new Date()

      // Send SMS
      const result = await sendSMS({
        to: sms.to,
        message: sms.message,
        sender: sms.sender
      })

      if (result.success) {
        // Mark as sent
        await this.updateSMSStatus(sms.id!, 'sent')
        console.log(`[SMSQueue] SMS sent successfully: ${sms.id}`)
      } else {
        // Handle failure
        await this.handleSMSFailure(sms, result.message)
      }
    } catch (error) {
      console.error(`[SMSQueue] Error processing SMS ${sms.id}:`, error)
      await this.handleSMSFailure(sms, error instanceof Error ? error.message : 'Unknown error')
    }
  }

  /**
   * Handle SMS sending failure
   */
  private async handleSMSFailure(sms: SMSData, errorMessage: string): Promise<void> {
    sms.retryCount = (sms.retryCount || 0) + 1

    if (sms.retryCount >= sms.maxRetries!) {
      // Max retries reached, mark as failed
      await this.updateSMSStatus(sms.id!, 'failed')
      console.error(`[SMSQueue] SMS failed after ${sms.maxRetries} retries: ${sms.id}`)
    } else {
      // Schedule retry with exponential backoff
      const delayMs = Math.pow(2, sms.retryCount) * 1000 // 1s, 2s, 4s, etc.
      const retryAt = new Date(Date.now() + delayMs)
      
      await this.scheduleSMSRetry(sms.id!, retryAt)
      console.log(`[SMSQueue] SMS scheduled for retry #${sms.retryCount} at ${retryAt}: ${sms.id}`)
    }
  }

  /**
   * Update SMS status in database
   */
  private async updateSMSStatus(smsId: string, status: SMSData['status']): Promise<void> {
    // In a real implementation, update database
    console.log(`[SMSQueue] SMS status updated: ${smsId} -> ${status}`)
  }

  /**
   * Schedule SMS for retry
   */
  private async scheduleSMSRetry(smsId: string, retryAt: Date): Promise<void> {
    // In a real implementation, update database with new scheduled time
    console.log(`[SMSQueue] SMS scheduled for retry: ${smsId} at ${retryAt}`)
  }

  /**
   * Reset SMS for retry
   */
  private async resetSMSForRetry(smsId: string): Promise<void> {
    // In a real implementation, update database
    console.log(`[SMSQueue] SMS reset for retry: ${smsId}`)
  }
}

// Export singleton instance
export const smsQueue = SMSQueue.getInstance()

// Helper functions for common operations
export async function queueSMS(smsData: SMSData): Promise<string> {
  return await smsQueue.add(smsData)
}

export async function queueBulkSMS(smsList: SMSData[]): Promise<string[]> {
  const ids: string[] = []
  for (const sms of smsList) {
    try {
      const id = await smsQueue.add(sms)
      ids.push(id)
    } catch (error) {
      console.error('Failed to queue SMS:', error)
    }
  }
  return ids
}

export async function scheduleSMS(smsData: SMSData, scheduledAt: Date): Promise<string> {
  return await smsQueue.add({
    ...smsData,
    scheduledAt
  })
}

export async function cancelSMS(smsId: string): Promise<boolean> {
  return await smsQueue.cancel(smsId)
}

export async function getSMSQueueStats(): Promise<SMSQueueStats> {
  return await smsQueue.getStats()
}

// Initialize queue on module import
if (typeof window === 'undefined') {
  // Only run on server side
  smsQueue.start(30000) // Process every 30 seconds
}
