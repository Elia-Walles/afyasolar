import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { adminEquipmentListings, adminEquipmentPhotos } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

export const runtime = 'nodejs'

// Schema for creating a new equipment listing
const createEquipmentSchema = z.object({
  equipmentName: z.string().min(1, 'Equipment name is required'),
  brand: z.string().optional(),
  model: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  condition: z.enum(['new', 'refurbished', 'used']).default('refurbished'),
  price: z.number().min(0, 'Price must be a positive number'),
  currency: z.string().default('TZS'),
  quantity: z.number().int().min(1).default(1),
  warrantyMonths: z.number().int().min(0).optional(),
  specifications: z.record(z.any()).optional(),
  features: z.array(z.string()).optional(),
  photos: z.array(z.object({
    url: z.string().url(),
    isPrimary: z.boolean().default(false),
    caption: z.string().optional(),
  })).optional(),
})

// GET /api/admin/equipment - List all equipment
// GET /api/admin/equipment?status=published - Filter by status
// GET /api/admin/equipment?category=ultrasound - Filter by category
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const category = searchParams.get('category')

    const query = db
      .select()
      .from(adminEquipmentListings)
      .orderBy(adminEquipmentListings.updatedAt)

    if (status) {
      query.where(eq(adminEquipmentListings.status, status as any))
    }

    if (category) {
      query.where(eq(adminEquipmentListings.category, category))
    }

    const listings = await query

    return NextResponse.json({ data: listings })
  } catch (error) {
    console.error('Error fetching equipment listings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/admin/equipment - Create a new equipment listing
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await request.json()
    const parsed = createEquipmentSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    const equipmentData = {
      ...parsed.data,
      id: crypto.randomUUID(),
      createdBy: session.user.id,
      status: 'draft' as const, // Type assertion for enum
      price: parsed.data.price.toString(), // Convert number to string for decimal type
      specifications: parsed.data.specifications ? JSON.stringify(parsed.data.specifications) : null,
      features: parsed.data.features ? JSON.stringify(parsed.data.features) : null,
    }

    await db.transaction(async (tx) => {
      // Create the equipment listing
      await tx.insert(adminEquipmentListings).values(equipmentData)

      // Add photos if any
      if (parsed.data.photos && parsed.data.photos.length > 0) {
        const photosData = parsed.data.photos.map((photo, index) => ({
          id: crypto.randomUUID(),
          equipmentId: equipmentData.id,
          url: photo.url,
          isPrimary: photo.isPrimary || index === 0, // First photo is primary by default
          caption: photo.caption || null,
          order: index,
        }))

        await tx.insert(adminEquipmentPhotos).values(photosData)
      }
    })

    // Get the created equipment with photos
    const [createdEquipment] = await db
      .select()
      .from(adminEquipmentListings)
      .where(eq(adminEquipmentListings.id, equipmentData.id))
      .limit(1)

    return NextResponse.json(
      { data: createdEquipment },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating equipment listing:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
