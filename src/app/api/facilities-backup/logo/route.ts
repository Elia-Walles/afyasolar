import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { facilities } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { uploadBase64Image, uploadBufferImage } from '@/lib/cloudinary'
import { z } from 'zod'

const updateLogoSchema = z.object({
  logoUrl: z.string().url().optional(),
})

/**
 * PATCH /api/facilities/logo
 * Update facility logo
 * Accepts base64 image or image URL
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only facilities can update their own logo, or admins can update any facility
    if (session.user.role !== 'facility' && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const facilityId = searchParams.get('facilityId') || session.user.facilityId

    if (!facilityId) {
      return NextResponse.json({ error: 'Facility ID required' }, { status: 400 })
    }

    // Check access: facility users can only update their own logo
    if (session.user.role === 'facility' && session.user.facilityId !== facilityId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if facility exists
    const [facility] = await db
      .select({ id: facilities.id })
      .from(facilities)
      .where(eq(facilities.id, facilityId))
      .limit(1)

    if (!facility) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 })
    }

    const contentType = request.headers.get('content-type') || ''
    let logoUrl: string | null = null

    if (contentType.includes('application/json')) {
      // Handle JSON with base64 image or URL
      const body = await request.json()
      
      if (body.logoUrl) {
        // If it's a URL, validate and use it
        const validated = updateLogoSchema.parse({ logoUrl: body.logoUrl })
        logoUrl = validated.logoUrl || null
      } else if (body.image && typeof body.image === 'string' && body.image.startsWith('data:image/')) {
        // If it's a base64 image, upload to Cloudinary
        try {
          logoUrl = await uploadBase64Image(body.image, 'afya-solar/facility-logos')
        } catch (error) {
          console.error('Error uploading logo to Cloudinary:', error)
          return NextResponse.json({ error: 'Failed to upload logo' }, { status: 500 })
        }
      } else {
        return NextResponse.json({ error: 'Invalid image data' }, { status: 400 })
      }
    } else if (contentType.includes('multipart/form-data')) {
      // Handle FormData (file upload)
      const formData = await request.formData()
      const file = formData.get('logo') as File

      if (!file) {
        return NextResponse.json({ error: 'No logo file provided' }, { status: 400 })
      }

      if (!file.type.startsWith('image/')) {
        return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
      }

      try {
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        
        // Generate unique filename
        const ext = file.name.split('.').pop() || 'jpg'
        const filename = `facility-logo-${facilityId}-${Date.now()}.${ext}`
        
        logoUrl = await uploadBufferImage(buffer, 'afya-solar/facility-logos', filename)
      } catch (error) {
        console.error('Error uploading logo file to Cloudinary:', error)
        return NextResponse.json({ error: 'Failed to upload logo' }, { status: 500 })
      }
    } else {
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 })
    }

    // Update facility logo
    try {
      await db
        .update(facilities)
        .set({ 
          logoUrl: logoUrl,
          updatedAt: new Date()
        })
        .where(eq(facilities.id, facilityId))
    } catch (error: any) {
      // If logo_url column doesn't exist, provide helpful error
      if (error.code === 'ER_BAD_FIELD_ERROR' && error.sqlMessage?.includes('logo_url')) {
        return NextResponse.json({ 
          error: 'logo_url column does not exist. Please run database migration: npm run db:migrate' 
        }, { status: 500 })
      }
      throw error
    }

    // Fetch updated facility
    const [updatedFacility] = await db
      .select({
        id: facilities.id,
        name: facilities.name,
        logoUrl: facilities.logoUrl,
      })
      .from(facilities)
      .where(eq(facilities.id, facilityId))
      .limit(1)

    return NextResponse.json({ 
      success: true, 
      data: { logoUrl: updatedFacility?.logoUrl || null } 
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Error updating facility logo:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
