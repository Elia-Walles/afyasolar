import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { uploadBase64Image, uploadBufferImage } from '@/lib/cloudinary'

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * POST /api/upload
 * Upload images for maintenance requests or buybacks to Cloudinary
 * Accepts base64 images or FormData
 * Query param: ?type=maintenance|buyback (defaults to maintenance)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only facilities, technicians, and admins can upload images
    if (!['facility', 'technician', 'admin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const uploadType = searchParams.get('type') || 'maintenance' // 'maintenance', 'buyback', or 'product'
    const folder = `afya-solar/${uploadType}`

    const contentType = request.headers.get('content-type') || ''
    let imageUrls: string[] = []

    if (contentType.includes('application/json')) {
      // Handle base64 images (from camera capture)
      const body = await request.json()
      const { images } = body

      if (!images || !Array.isArray(images) || images.length === 0) {
        return NextResponse.json({ error: 'No images provided' }, { status: 400 })
      }

      // Process each base64 image
      for (const imageData of images) {
        if (typeof imageData !== 'string' || !imageData.startsWith('data:image/')) {
          continue
        }

        try {
          const url = await uploadBase64Image(imageData, folder)
          imageUrls.push(url)
        } catch (error) {
          console.error('Error uploading base64 image to Cloudinary:', error)
          // Continue with other images even if one fails
        }
      }
    } else if (contentType.includes('multipart/form-data')) {
      // Handle FormData (file uploads)
      const formData = await request.formData()
      const files = formData.getAll('images') as File[]

      if (files.length === 0) {
        return NextResponse.json({ error: 'No images provided' }, { status: 400 })
      }

      // Process each file
      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          continue
        }

        try {
          const bytes = await file.arrayBuffer()
          const buffer = Buffer.from(bytes)
          
          // Generate unique filename
          const ext = file.name.split('.').pop() || 'jpg'
          const filename = `${uploadType}-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`
          
          const url = await uploadBufferImage(buffer, folder, filename)
          imageUrls.push(url)
        } catch (error) {
          console.error('Error uploading file to Cloudinary:', error)
          // Continue with other images even if one fails
        }
      }
    } else {
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 })
    }

    if (imageUrls.length === 0) {
      return NextResponse.json({ error: 'No valid images processed' }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      data: { urls: imageUrls } 
    })
  } catch (error) {
    console.error('Error uploading images:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

