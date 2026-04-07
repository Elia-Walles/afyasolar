import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { adminEquipmentListings, adminEquipmentPhotos } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

// Schema for updating an equipment listing
const updateEquipmentSchema = z.object({
  equipmentName: z.string().min(1, 'Equipment name is required').optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  condition: z.enum(['new', 'refurbished', 'used']).optional(),
  price: z.number().min(0, 'Price must be a positive number').optional(),
  currency: z.string().optional(),
  quantity: z.number().int().min(1).optional(),
  status: z.enum(['draft', 'published', 'sold_out', 'archived']).optional(),
  warrantyMonths: z.number().int().min(0).optional(),
  specifications: z.record(z.any()).optional(),
  features: z.array(z.string()).optional(),
  photos: z.array(z.object({
    id: z.string().optional(),
    url: z.string().url(),
    isPrimary: z.boolean().default(false),
    caption: z.string().optional(),
  })).optional(),
})

// GET /api/admin/equipment/[id] - Get a specific equipment listing
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const [equipment] = await db
      .select()
      .from(adminEquipmentListings)
      .where(eq(adminEquipmentListings.id, id))
      .limit(1)

    if (!equipment) {
      return NextResponse.json(
        { error: 'Equipment not found' },
        { status: 404 }
      )
    }

    // Get photos for this equipment
    const photos = await db
      .select()
      .from(adminEquipmentPhotos)
      .where(eq(adminEquipmentPhotos.equipmentId, id))
      .orderBy(adminEquipmentPhotos.order)

    return NextResponse.json({
      data: {
        ...equipment,
        photos,
      },
    })
  } catch (error) {
    console.error('Error fetching equipment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/equipment/[id] - Update an equipment listing
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const payload = await request.json()
    const parsed = updateEquipmentSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    // Check if equipment exists
    const [existing] = await db
      .select()
      .from(adminEquipmentListings)
      .where(eq(adminEquipmentListings.id, id))
      .limit(1)

    if (!existing) {
      return NextResponse.json(
        { error: 'Equipment not found' },
        { status: 404 }
      )
    }

    const updateData: any = {
      ...parsed.data,
      updatedBy: session.user.id,
      updatedAt: new Date(),
    }

    // Handle JSON fields
    if (parsed.data.specifications) {
      updateData.specifications = JSON.stringify(parsed.data.specifications)
    }
    if (parsed.data.features) {
      updateData.features = JSON.stringify(parsed.data.features)
    }

    // If status is being published for the first time, set publishedAt
    if (parsed.data.status === 'published' && existing.status !== 'published') {
      updateData.publishedAt = new Date()
    }

    await db.transaction(async (tx) => {
      // Update the equipment listing
      await tx
        .update(adminEquipmentListings)
        .set(updateData)
        .where(eq(adminEquipmentListings.id, id))

      // Handle photos if provided
      if (parsed.data.photos) {
        // First, delete all existing photos
        await tx
          .delete(adminEquipmentPhotos)
          .where(eq(adminEquipmentPhotos.equipmentId, id))

        // Then insert the new photos
        if (parsed.data.photos.length > 0) {
          const photosData = parsed.data.photos.map((photo, index) => ({
            id: photo.id || crypto.randomUUID(),
            equipmentId: id,
            url: photo.url,
            isPrimary: photo.isPrimary || index === 0,
            caption: photo.caption || null,
            order: index,
          }))

          await tx.insert(adminEquipmentPhotos).values(photosData)
        }
      }
    })

    // Get the updated equipment with photos
    const [updatedEquipment] = await db
      .select()
      .from(adminEquipmentListings)
      .where(eq(adminEquipmentListings.id, id))
      .limit(1)

    const photos = await db
      .select()
      .from(adminEquipmentPhotos)
      .where(eq(adminEquipmentPhotos.equipmentId, id))
      .orderBy(adminEquipmentPhotos.order)

    return NextResponse.json({
      data: {
        ...updatedEquipment,
        photos,
      },
    })
  } catch (error) {
    console.error('Error updating equipment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/equipment/[id] - Delete an equipment listing
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if equipment exists
    const { id } = await params

    const [existing] = await db
      .select()
      .from(adminEquipmentListings)
      .where(eq(adminEquipmentListings.id, id))
      .limit(1)

    if (!existing) {
      return NextResponse.json(
        { error: 'Equipment not found' },
        { status: 404 }
      )
    }

    await db.transaction(async (tx) => {
      // Delete photos first due to foreign key constraint
      await tx
        .delete(adminEquipmentPhotos)
        .where(eq(adminEquipmentPhotos.equipmentId, id))

      // Then delete the equipment
      await tx
        .delete(adminEquipmentListings)
        .where(eq(adminEquipmentListings.id, id))
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting equipment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
