declare module 'web-push' {
  export interface VapidKeys {
    publicKey: string
    privateKey: string
  }

  export interface PushSubscription {
    endpoint: string
    keys: {
      p256dh: string
      auth: string
    }
  }

  export interface SendResult {
    statusCode: number
    body: string
    headers: Record<string, string>
  }

  export interface RequestOptions {
    TTL?: number
    headers?: Record<string, string>
    contentEncoding?: string
    proxy?: string
    agent?: any
    timeout?: number
  }

  export function generateVAPIDKeys(): VapidKeys

  export function setVapidDetails(
    subject: string,
    publicKey: string,
    privateKey: string
  ): void

  export function sendNotification(
    subscription: PushSubscription,
    payload?: string | Buffer | null,
    options?: RequestOptions
  ): Promise<SendResult>

  export function setGCMAPIKey(apiKey: string): void
}

