/**
 * Azam Pay Payment Gateway Integration
 * Documentation: https://developer.azampay.co.tz/
 */

interface AzamPayConfig {
  appName?: string // Application name (optional, may be needed for token endpoint)
  clientId: string
  clientSecret: string
  token?: string // Pre-existing access token (use this directly if provided)
  apiKey?: string // X-API-Key (optional, may not be provided)
  environment: 'SANDBOX' | 'LIVE'
  callbackUrl: string
}

interface AzamPayTokenResponse {
  accessToken: string
  expiresIn: number
  tokenType: string
}

interface MobileCheckoutRequest {
  amount: number
  accountNumber: string // This is the mobile number/MSISDN
  externalId: string
  provider: 'Airtel' | 'Tigo' | 'Mpesa' | 'Halopesa' | 'Azampesa' // Valid providers from official docs
  currency?: string
  additionalProperties?: Record<string, any>
}

interface BankCheckoutRequest {
  amount: number
  merchantAccountNumber: string // Bank account number
  merchantMobileNumber: string // Mobile number linked to bank account
  otp: string // One-Time Password from bank
  provider: 'CRDB' | 'NMB' // Only CRDB and NMB are supported
  referenceId: string // External reference ID
  currency?: string
  merchantName?: string
  additionalProperties?: Record<string, any>
}

interface AzamPayCheckoutResponse {
  success: boolean
  transactionId?: string
  message?: string
  data?: any
}

class AzamPayService {
  private config: AzamPayConfig
  private tokenCache: {
    token: string | null
    expiresAt: number
  } = {
    token: null,
    expiresAt: 0,
  }

  constructor(config: AzamPayConfig) {
    this.config = config
  }

  /**
   * Get base URL based on environment (for checkout endpoints)
   * 
   * Note: If you experience connection timeouts in production, verify the correct
   * production URL with Azam Pay support. The production URL may vary.
   */
  private getBaseUrl(): string {
    // Allow override via environment variable
    if (process.env.AZAM_PAY_BASE_URL) {
      return process.env.AZAM_PAY_BASE_URL
    }
    
    return this.config.environment === 'SANDBOX'
      ? 'https://sandbox.azampay.co.tz'
      : 'https://checkout.azampay.co.tz'
  }

  /**
   * Get authenticator URL for token endpoint
   */
  private getAuthenticatorUrl(): string {
    return this.config.environment === 'SANDBOX'
      ? 'https://authenticator-sandbox.azampay.co.tz'
      : 'https://authenticator.azampay.co.tz'
  }

  /**
   * Retry fetch with exponential backoff for network errors
   */
  private async retryFetch(
    url: string,
    options: RequestInit,
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<Response> {
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        })
        
        clearTimeout(timeoutId)
        return response
      } catch (error: any) {
        lastError = error
        
        // Check if it's a retryable network error
        const isRetryableError = 
          error.code === 'ECONNRESET' ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ECONNREFUSED' ||
          error.code === 'ENOTFOUND' ||
          error.name === 'AbortError' ||
          error.message?.includes('fetch failed') ||
          error.message?.includes('network')
        
        if (!isRetryableError || attempt === maxRetries - 1) {
          throw error
        }
        
        // Calculate delay with exponential backoff
        const delay = initialDelay * Math.pow(2, attempt)
        console.log(`Azam Pay token request failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`, {
          error: error.message,
          code: error.code,
        })
        
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw lastError || new Error('Failed to fetch token after retries')
  }

  /**
   * Get access token from Azam Pay
   * Uses pre-existing token if provided, otherwise fetches new token using CLIENT_TOKEN
   */
  async getAccessToken(): Promise<string> {
    // If a pre-existing token is provided, use it directly (assuming it's an access token)
    if (this.config.token && this.config.token.trim() !== '') {
      const token = this.config.token.trim()
      // Log token info (first/last few chars for debugging, not full token)
      console.log('Using provided AZAM_PAY_TOKEN:', {
        length: token.length,
        prefix: token.substring(0, 10) + '...',
        suffix: '...' + token.substring(token.length - 10),
      })
      return token
    }

    // Check if we have a valid cached token
    if (this.tokenCache.token && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.token
    }

    // If no token provided, we need to get one using client credentials
    try {
      // According to official docs: /AppRegistration/GenerateToken on authenticator URL
      // Requires: appName, clientId, clientSecret in JSON format
      if (!this.config.appName) {
        throw new Error('appName is required to generate token. Set AZAM_PAY_APP_NAME or provide AZAM_PAY_TOKEN.')
      }

      const tokenUrl = `${this.getAuthenticatorUrl()}/AppRegistration/GenerateToken`
      
      const requestBody = {
        appName: this.config.appName,
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
      }
      
      // Log request (without sensitive data)
      console.log('Azam Pay token request:', {
        url: tokenUrl,
        appName: this.config.appName,
        clientId: this.config.clientId,
        clientIdLength: this.config.clientId.length,
        clientSecretLength: this.config.clientSecret.length,
        clientSecretPrefix: this.config.clientSecret.substring(0, 20) + '...',
        requestBodyKeys: Object.keys(requestBody),
      })
      
      // Log the exact request body structure for debugging (without full secret)
      console.log('Token request body structure:', {
        appName: requestBody.appName,
        clientId: requestBody.clientId,
        clientSecretLength: requestBody.clientSecret.length,
        clientSecretFirstChars: requestBody.clientSecret.substring(0, 30),
        clientSecretLastChars: '...' + requestBody.clientSecret.substring(requestBody.clientSecret.length - 30),
      })
      
      // Ensure proper JSON encoding
      const requestBodyJson = JSON.stringify(requestBody)
      
      console.log('Sending token request:', {
        method: 'POST',
        url: tokenUrl,
        headers: { 'Content-Type': 'application/json' },
        bodyLength: requestBodyJson.length,
        bodyPreview: requestBodyJson.substring(0, 100) + '...',
      })
      
      const response = await this.retryFetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBodyJson,
      })
      
      console.log('Token response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = 'Failed to get access token'
        let errorDetails: any = {}
        
        try {
          const errorJson = JSON.parse(errorText)
          errorMessage = errorJson.message || errorJson.error || errorMessage
          errorDetails = errorJson
        } catch {
          errorMessage = errorText || errorMessage
        }
        
        // Log detailed error with request info
        console.error('Azam Pay token generation failed:', {
          status: response.status,
          statusText: response.statusText,
          errorMessage,
          errorDetails,
          requestInfo: {
            appName: requestBody.appName,
            appNameLength: requestBody.appName?.length,
            clientId: requestBody.clientId,
            clientSecretLength: requestBody.clientSecret.length,
            url: tokenUrl,
          },
        })
        
        // If it's a 423 error, provide specific guidance
        if (response.status === 423) {
          console.error('⚠️ 423 Error - Possible causes:')
          console.error('  1. Client Secret has expired - regenerate it in Azam Pay dashboard')
          console.error('  2. App Name does not match exactly (case-sensitive, spaces matter)')
          console.error('  3. Client ID is incorrect')
          console.error('  4. Credentials are from wrong environment (sandbox vs production)')
        }
        
        throw new Error(errorMessage)
      }

      const data = await response.json()
      
      // Log successful token response structure (for debugging)
      console.log('Azam Pay token response received:', {
        hasData: !!data.data,
        hasAccessToken: !!data.data?.accessToken,
        accessTokenType: typeof data.data?.accessToken,
        success: data.success,
        message: data.message,
      })
      
      // Response structure: { data: { accessToken: {...}, expire: {...} }, message: "...", success: true, statusCode: 200 }
      // Extract accessToken from nested structure
      let accessToken: string | null = null
      
      if (data.data && data.data.accessToken) {
        // If accessToken is an object, it might have a value property
        if (typeof data.data.accessToken === 'string') {
          accessToken = data.data.accessToken
        } else if (data.data.accessToken.value) {
          accessToken = data.data.accessToken.value
        } else if (data.data.accessToken.token) {
          accessToken = data.data.accessToken.token
        }
      } else if (data.accessToken) {
        accessToken = typeof data.accessToken === 'string' ? data.accessToken : data.accessToken.value || data.accessToken.token
      } else if (data.token) {
        accessToken = data.token
      }

      if (!accessToken || typeof accessToken !== 'string') {
        // Log the full response to help debug
        console.error('Token response structure:', JSON.stringify(data, null, 2))
        // Try to extract token from the object structure - it might be a JWT token object
        if (data.data?.accessToken && typeof data.data.accessToken === 'object') {
          // Try common JWT token object properties
          const possibleToken = data.data.accessToken.token || 
                                data.data.accessToken.jwt || 
                                data.data.accessToken.value ||
                                JSON.stringify(data.data.accessToken)
          if (possibleToken && typeof possibleToken === 'string' && possibleToken.length > 50) {
            accessToken = possibleToken
            console.log('Extracted token from object structure')
          }
        }
        
        if (!accessToken || typeof accessToken !== 'string') {
          throw new Error(`Invalid token response from Azam Pay. Response: ${JSON.stringify(data)}`)
        }
      }

      // Cache the token
      this.tokenCache.token = accessToken
      // Get expire time if available
      const expireData = data.data?.expire || data.expire
      let expiresIn = 3600 // Default 1 hour
      if (expireData) {
        if (typeof expireData === 'number') {
          expiresIn = expireData
        } else if (expireData.value) {
          expiresIn = expireData.value
        } else if (expireData.seconds) {
          expiresIn = expireData.seconds
        }
      }
      this.tokenCache.expiresAt = Date.now() + (expiresIn - 60) * 1000 // Subtract 60s for safety

      return accessToken
    } catch (error: any) {
      console.error('Azam Pay token error:', error)
      
      // Provide more specific error messages for network errors
      if (error.code === 'ECONNRESET' || error.message?.includes('ECONNRESET')) {
        throw new Error('Connection to Azam Pay was reset. Please try again.')
      } else if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
        throw new Error('Request to Azam Pay timed out. Please try again.')
      } else if (error.message) {
        throw new Error(error.message)
      } else {
        throw new Error('Failed to get access token from Azam Pay')
      }
    }
  }

  /**
   * Initiate mobile checkout
   * According to official docs: Requires both Bearer token AND X-API-Key
   */
  async mobileCheckout(request: MobileCheckoutRequest): Promise<AzamPayCheckoutResponse> {
    try {
      let token = await this.getAccessToken()

      // According to official docs, X-API-Key is REQUIRED for checkout endpoints
      if (!this.config.apiKey) {
        return {
          success: false,
          message: 'X-API-Key is required for mobile checkout. Please set AZAM_PAY_API_KEY environment variable.',
        }
      }

      // Prepare headers - Both Authorization and X-API-Key are required
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-API-Key': this.config.apiKey,
      }
      
      // Log token info for debugging (without exposing full token)
      console.log('Using token for mobile checkout:', {
        tokenLength: token.length,
        tokenPrefix: token.substring(0, 20) + '...',
        hasApiKey: !!this.config.apiKey,
        apiKeyPrefix: this.config.apiKey?.substring(0, 10) + '...',
      })

      // According to official docs, the request body structure is:
      // { accountNumber, amount (number), currency, externalId, provider, additionalProperties }
      // Valid providers: ["Airtel", "Tigo", "Halopesa", "Azampesa", "Mpesa"]
      // IMPORTANT: Provider must be exactly as specified (case-sensitive, no spaces)
      const validProviders = ['Airtel', 'Tigo', 'Halopesa', 'Azampesa', 'Mpesa']
      const providerValue = typeof request.provider === 'string' ? request.provider.trim() : request.provider
      
      // Validate provider value
      if (!validProviders.includes(providerValue as string)) {
        return {
          success: false,
          message: `Invalid provider: "${request.provider}". Valid providers are: ${validProviders.join(', ')}`,
        }
      }

      const requestBody = {
        accountNumber: request.accountNumber, // Mobile number/MSISDN
        amount: request.amount, // Number, not string
        currency: request.currency || 'TZS',
        externalId: request.externalId,
        provider: providerValue, // Must be exactly one of: Airtel, Tigo, Halopesa, Azampesa, Mpesa
        ...(request.additionalProperties && { additionalProperties: request.additionalProperties }),
      }
      
      // Log provider value details for debugging (especially for Halopesa)
      if (providerValue === 'Halopesa') {
        console.log('🔍 Halopesa provider details:', {
          originalProvider: request.provider,
          providerValue,
          providerType: typeof providerValue,
          providerLength: providerValue?.length,
          isValidInArray: validProviders.includes(providerValue),
        })
      }

      // Log request for debugging
      const requestBodyJson = JSON.stringify(requestBody)
      console.log('Azam Pay mobile checkout request:', {
        url: `${this.getBaseUrl()}/azampay/mno/checkout`,
        headers: { ...headers, 'Authorization': 'Bearer ***' }, // Don't log full token
        body: requestBody,
        bodyJson: requestBodyJson, // Log exact JSON being sent
      })

      // Create AbortController for timeout (30 seconds for production)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
      
      let response: Response
      try {
        response = await fetch(`${this.getBaseUrl()}/azampay/mno/checkout`, {
          method: 'POST',
          headers,
          body: requestBodyJson,
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        
        // Handle timeout specifically
        if (fetchError.name === 'AbortError' || fetchError.code === 'UND_ERR_CONNECT_TIMEOUT' || fetchError.message?.includes('timeout')) {
          const baseUrl = this.getBaseUrl()
          console.error('[Mobile Checkout] Connection timeout - retrying...', {
            url: `${baseUrl}/azampay/mno/checkout`,
            environment: this.config.environment,
            baseUrl,
            errorCode: fetchError.code,
            errorName: fetchError.name,
          })
          
          // Retry once with longer timeout
          const retryController = new AbortController()
          const retryTimeoutId = setTimeout(() => retryController.abort(), 60000) // 60 second timeout for retry
          
          try {
            console.log('[Mobile Checkout] Retry attempt with 60s timeout...')
            response = await fetch(`${baseUrl}/azampay/mno/checkout`, {
              method: 'POST',
              headers,
              body: requestBodyJson,
              signal: retryController.signal,
            })
            clearTimeout(retryTimeoutId)
            console.log('[Mobile Checkout] Retry successful!')
          } catch (retryError: any) {
            clearTimeout(retryTimeoutId)
            console.error('[Mobile Checkout] Retry also failed:', {
              errorCode: retryError.code,
              errorName: retryError.name,
              errorMessage: retryError.message,
              baseUrl,
            })
            throw new Error(`Connection timeout to Azam Pay after retry. Base URL: ${baseUrl}. This may indicate a network issue or incorrect production URL. Please verify the production URL with Azam Pay support or check your network connectivity. Original error: ${fetchError.message || 'Connection timeout'}`)
          }
        } else {
          throw fetchError
        }
      }

      let data
      try {
        data = await response.json()
      } catch (parseError) {
        const errorText = await response.text()
        console.error('Failed to parse Azam Pay response:', {
          status: response.status,
          statusText: response.statusText,
          errorText,
          parseError,
        })
        return {
          success: false,
          message: errorText || `Payment initiation failed (Status: ${response.status})`,
          data: { status: response.status, error: errorText },
        }
      }

      // Log the full response for debugging
      console.log('Azam Pay checkout response:', {
        status: response.status,
        ok: response.ok,
        data,
        requestDetails: {
          accountNumber: requestBody.accountNumber,
          provider: requestBody.provider,
          providerType: typeof requestBody.provider,
          amount: requestBody.amount,
        },
      })
      
      // Enhanced logging for provider-specific errors
      if (!response.ok && requestBody.provider === 'Halopesa') {
        console.error('🚨 Halopesa-specific error detected:', {
          status: response.status,
          statusText: response.statusText,
          data,
          requestBody: {
            provider: requestBody.provider,
            accountNumber: requestBody.accountNumber,
            amount: requestBody.amount,
          },
        })
      }

      if (!response.ok) {
        // Check for specific authorization errors
        if (response.status === 401 || response.status === 403) {
          // If we got 401 and we have appName, try generating a fresh token
          if (response.status === 401 && this.config.appName && this.config.token) {
            console.warn('Received 401 with provided token. Attempting to generate fresh token using appName...')
            // Clear the provided token and try generating a new one
            const originalToken = this.config.token
            this.config.token = undefined
            this.tokenCache.token = null
            this.tokenCache.expiresAt = 0
            
            try {
              token = await this.getAccessToken()
              console.log('Successfully generated new token. Retrying checkout...')
              
              // Retry the checkout with the new token
              const retryResponse = await fetch(`${this.getBaseUrl()}/azampay/mno/checkout`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                  'X-API-Key': this.config.apiKey!,
                },
                body: requestBodyJson,
              })
              
              const retryData = await retryResponse.json()
              
              if (retryResponse.ok) {
                const isSuccess = retryData.success === true || (retryData.success !== false && retryData.transactionId)
                return {
                  success: isSuccess,
                  transactionId: retryData.transactionId,
                  message: retryData.message || (isSuccess ? 'Payment initiated successfully' : 'Payment initiation failed'),
                  data: retryData,
                }
              } else {
                // Restore original token if retry also fails
                this.config.token = originalToken
                const errorMsg = retryData.message || retryData.error || retryData.errorMessage || retryData.errors || 'Please Provide Valid Authorization'
                return {
                  success: false,
                  message: errorMsg,
                  data: retryData,
                }
              }
            } catch (retryError: any) {
              // Restore original token
              this.config.token = originalToken
              console.error('Failed to generate new token:', retryError)
            }
          }
          
          const errorMsg = data.message || data.error || data.errorMessage || data.errors || 'Please Provide Valid Authorization'
          return {
            success: false,
            message: errorMsg.includes('authorization') || errorMsg.includes('Authorization') 
              ? errorMsg 
              : 'Please Provide Valid Authorization. If you have AZAM_PAY_TOKEN set, try removing it and let the system generate a fresh token using AZAM_PAY_APP_NAME.',
            data,
          }
        }
        
        // For 400 errors, return detailed error information
        const errorMsg = data.message || data.error || data.errorMessage || data.errors || 'Payment initiation failed'
        
        console.error('Azam Pay checkout failed:', {
          status: response.status,
          errorMessage: errorMsg,
          provider: requestBody.provider,
          fullErrorData: data, // Log full error response for debugging
        })
        
        return {
          success: false,
          message: typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg),
          data,
        }
      }

      // Response structure: { transactionId, message, success }
      // Check if the response indicates success
      const isSuccess = data.success === true || (data.success !== false && data.transactionId)
      
      // Log success details for debugging PIN prompt issues
      if (isSuccess) {
        console.log('✅ Azam Pay checkout successful:', {
          transactionId: data.transactionId,
          accountNumber: requestBody.accountNumber,
          provider: requestBody.provider,
          message: data.message,
          fullResponse: data,
        })
        console.log('📱 PIN prompt should appear on mobile:', requestBody.accountNumber)
      }
      
      return {
        success: isSuccess,
        transactionId: data.transactionId,
        message: data.message || (isSuccess ? 'Payment initiated successfully. Please check your phone for the PIN prompt to complete the payment.' : 'Payment initiation failed'),
        data,
      }
    } catch (error: any) {
      console.error('Azam Pay mobile checkout error:', error)
      return {
        success: false,
        message: error.message || 'Failed to initiate payment',
      }
    }
  }

  /**
   * Initiate bank checkout
   * According to official Azam Pay docs:
   * - Requires Bearer token
   * - Required fields: amount, currencyCode, merchantAccountNumber, merchantMobileNumber, otp, provider
   * - Provider must be 'CRDB' or 'NMB'
   */
  async bankCheckout(request: BankCheckoutRequest): Promise<AzamPayCheckoutResponse> {
    try {
      const token = await this.getAccessToken()

      // Prepare headers - Bearer token is required
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      }
      
      // X-API-Key might be optional for bank checkout, but include if provided
      if (this.config.apiKey) {
        headers['X-API-Key'] = this.config.apiKey
      }

      // Bank checkout request structure according to Azam Pay API docs
      // Required: amount, currencyCode, merchantAccountNumber, merchantMobileNumber, otp, provider
      const requestBody = {
        amount: request.amount, // Number, not string
        currencyCode: request.currency || 'TZS',
        merchantAccountNumber: request.merchantAccountNumber,
        merchantMobileNumber: request.merchantMobileNumber,
        merchantName: request.merchantName || null,
        otp: request.otp,
        provider: request.provider, // 'CRDB' or 'NMB'
        referenceId: request.referenceId,
        ...(request.additionalProperties && { additionalProperties: request.additionalProperties }),
      }

      // Log request for debugging (without sensitive data)
      console.log('Azam Pay bank checkout request:', {
        url: `${this.getBaseUrl()}/azampay/bank/checkout`,
        headers: { ...headers, 'Authorization': 'Bearer ***' },
        body: {
          ...requestBody,
          otp: '****', // Hide OTP in logs
        },
      })

      const response = await fetch(`${this.getBaseUrl()}/azampay/bank/checkout`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      })

      let data
      try {
        data = await response.json()
      } catch (parseError) {
        const errorText = await response.text()
        console.error('Failed to parse Azam Pay bank checkout response:', {
          status: response.status,
          statusText: response.statusText,
          errorText,
        })
        return {
          success: false,
          message: errorText || `Bank checkout failed (Status: ${response.status})`,
          data: { status: response.status, error: errorText },
        }
      }

      // Log the full response for debugging
      console.log('Azam Pay bank checkout response:', {
        status: response.status,
        ok: response.ok,
        data,
      })

      if (!response.ok) {
        const errorMsg = data.message || data.error || data.errorMessage || 'Bank checkout failed'
        return {
          success: false,
          message: typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg),
          data,
        }
      }

      // Check if the response indicates success
      const isSuccess = data.success === true || (data.success !== false && data.transactionId)

      return {
        success: isSuccess,
        transactionId: data.transactionId || data.transaction_id,
        message: data.message || (isSuccess ? 'Bank checkout initiated successfully' : 'Bank checkout failed'),
        data,
      }
    } catch (error: any) {
      console.error('Azam Pay bank checkout error:', error)
      return {
        success: false,
        message: error.message || 'Failed to initiate bank checkout',
      }
    }
  }

  /**
   * Verify payment status
   * NOTE: This endpoint may not be available for checkout transactions.
   * According to Azam Pay documentation, checkout transactions only communicate
   * status via callbacks. This method is kept for potential future use or
   * for other API types (like disbursement).
   */
  async verifyPayment(transactionId: string): Promise<any> {
    try {
      const token = await this.getAccessToken()

      // Prepare headers - Azam Pay requires both Authorization and X-API-Key
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
      }
      
      // X-API-Key might be required even with token - include if provided
      if (this.config.apiKey) {
        headers['X-API-Key'] = this.config.apiKey
      } else {
        console.warn('X-API-Key not provided. Some Azam Pay endpoints may require it.')
      }

      const verifyUrl = `${this.getBaseUrl()}/azampay/transaction/verify/${transactionId}`
      console.log('[Verify Payment] Request:', {
        url: verifyUrl,
        method: 'GET',
        hasToken: !!token,
        hasApiKey: !!this.config.apiKey,
        transactionId,
      })

      const response = await fetch(verifyUrl, {
        method: 'GET',
        headers,
      })

      let responseData
      try {
        responseData = await response.json()
      } catch (parseError) {
        const errorText = await response.text()
        console.error('[Verify Payment] Failed to parse response:', {
          status: response.status,
          statusText: response.statusText,
          errorText,
        })
        throw new Error(`Verification failed (Status: ${response.status}): ${errorText || response.statusText}`)
      }

      if (!response.ok) {
        console.error('[Verify Payment] API error response:', {
          status: response.status,
          statusText: response.statusText,
          data: responseData,
        })
        const errorMessage = responseData?.message || responseData?.error || responseData?.errorMessage || `Failed to verify payment (Status: ${response.status})`
        throw new Error(errorMessage)
      }

      console.log('[Verify Payment] Success:', {
        transactionId,
        responseKeys: Object.keys(responseData || {}),
        hasData: !!responseData?.data,
      })

      return responseData
    } catch (error: any) {
      console.error('[Verify Payment] Error details:', {
        transactionId,
        errorMessage: error.message,
        errorStack: error.stack,
      })
      throw error
    }
  }
}

/**
 * Create Azam Pay service instance
 */
export function createAzamPayService(): AzamPayService {
  // Trim and clean app name (handle spaces and quotes)
  const rawAppName = process.env.AZAM_PAY_APP_NAME
  const appName = rawAppName ? rawAppName.trim().replace(/^["']|["']$/g, '') : undefined
  
  // Clean and trim client secret (remove quotes, newlines, but preserve the secret itself)
  // Client secrets can be long base64 strings (600+ chars), so we only remove formatting
  const rawClientSecret = process.env.AZAM_PAY_CLIENT_SECRET || ''
  let clientSecret = rawClientSecret.trim()
  
  // Remove surrounding quotes if present
  if ((clientSecret.startsWith('"') && clientSecret.endsWith('"')) || 
      (clientSecret.startsWith("'") && clientSecret.endsWith("'"))) {
    clientSecret = clientSecret.slice(1, -1).trim()
  }
  
  // Remove any newlines that might have been added accidentally
  clientSecret = clientSecret.replace(/\r?\n/g, '')
  
  // Remove any spaces that might have been added (but preserve the secret content)
  // Only remove spaces if they're clearly formatting (multiple spaces, spaces at start/end)
  clientSecret = clientSecret.trim()
  
  // Remove any spaces in the middle if they appear to be formatting (multiple consecutive spaces)
  // This helps catch cases where spaces were accidentally added, but preserves valid base64
  clientSecret = clientSecret.replace(/\s{2,}/g, '')
  
  // Clean and trim client ID
  const clientId = (process.env.AZAM_PAY_CLIENT_ID || '').trim().replace(/^["']|["']$/g, '')
  
  const config: AzamPayConfig = {
    appName, // Required if generating token (trimmed and cleaned)
    clientId,
    clientSecret,
    token: process.env.AZAM_PAY_TOKEN || undefined, // Access token from Azam Pay (use this directly if provided)
    apiKey: process.env.AZAM_PAY_API_KEY || undefined, // X-API-Key (REQUIRED for mobile checkout according to official docs)
    environment: (process.env.AZAM_PAY_ENVIRONMENT as 'SANDBOX' | 'LIVE') || 'SANDBOX',
    callbackUrl: process.env.AZAM_PAY_CALLBACK_URL || `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/azam-pay/callback`,
  }
  
  // Log configuration (without sensitive data)
  console.log('Azam Pay Service Config:', {
    hasAppName: !!config.appName,
    appNameLength: config.appName?.length || 0,
    appName: config.appName, // Log app name to verify it matches dashboard
    hasClientId: !!config.clientId,
    clientIdLength: config.clientId.length,
    clientId: config.clientId, // Log client ID to verify
    hasClientSecret: !!config.clientSecret,
    clientSecretLength: config.clientSecret.length,
    clientSecretPrefix: config.clientSecret.substring(0, 10) + '...', // First 10 chars for verification
    hasToken: !!config.token,
    hasApiKey: !!config.apiKey,
    environment: config.environment,
  })
  
  // Warn if client secret seems problematic
  // Check for potential issues: very long (>1000 chars), contains spaces, or appears duplicated
  const secretLength = config.clientSecret.length
  const hasSpaces = /\s/.test(config.clientSecret)
  const appearsDuplicated = secretLength > 500 && config.clientSecret.substring(0, Math.floor(secretLength / 2)) === config.clientSecret.substring(Math.floor(secretLength / 2))
  
  if (secretLength > 1000 || hasSpaces || appearsDuplicated) {
    console.warn('⚠️ WARNING: Client Secret may have issues:')
    if (secretLength > 1000) {
      console.warn(`  - Unusually long (${secretLength} characters) - may indicate concatenation or encoding issues`)
    }
    if (hasSpaces) {
      console.warn('  - Contains spaces - this may cause authentication failures')
    }
    if (appearsDuplicated) {
      console.warn('  - Appears to be duplicated (same content repeated twice)')
    }
    console.warn('  Please verify your AZAM_PAY_CLIENT_SECRET in .env.local matches exactly what\'s in your Azam Pay dashboard')
  } else if (secretLength > 200 && secretLength <= 1000) {
    // Informational log for long but potentially valid secrets
    console.log(`ℹ️ Client Secret length: ${secretLength} characters (this is normal for Azam Pay)`)
  }

  // Validate required config
  if (!config.clientId || !config.clientSecret) {
    throw new Error('Azam Pay credentials are not configured. Please set AZAM_PAY_CLIENT_ID and AZAM_PAY_CLIENT_SECRET environment variables.')
  }

  // If token is not provided, appName is required to generate one
  if (!config.token && !config.appName) {
    console.warn('AZAM_PAY_TOKEN not provided and AZAM_PAY_APP_NAME is missing. Token generation will fail. Either provide AZAM_PAY_TOKEN or set AZAM_PAY_APP_NAME.')
  }

  // X-API-Key is required for mobile checkout according to official documentation
  if (!config.apiKey) {
    console.warn('AZAM_PAY_API_KEY not provided. Mobile checkout requires X-API-Key header. Please set AZAM_PAY_API_KEY environment variable.')
  }

  return new AzamPayService(config)
}

export type { AzamPayService, MobileCheckoutRequest, BankCheckoutRequest, AzamPayCheckoutResponse }
