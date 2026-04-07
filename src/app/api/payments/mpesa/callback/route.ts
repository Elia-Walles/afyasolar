import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * POST /api/payments/mpesa/callback
 * Design-compat callback endpoint.
 *
 * In this codebase, payment callbacks are handled by AzamPay at:
 * - POST /api/payments/azam-pay/callback
 *
 * We proxy the request body to the AzamPay callback handler to preserve
 * the existing transaction update logic while providing the design URL.
 */
export async function POST(request: NextRequest) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const raw = await request.text()

    const res = await fetch(`${baseUrl}/api/payments/azam-pay/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': request.headers.get('content-type') || 'application/json',
      },
      body: raw,
      // Do not forward cookies/authorization; this is a webhook-style callback.
    })

    const text = await res.text()
    let json: any = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = { raw: text }
    }

    return NextResponse.json(json ?? { success: res.ok }, { status: res.status })
  } catch (error) {
    console.error('Error proxying mpesa callback to azam-pay callback:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

