import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { db } from "@/lib/db"
import { facilityEquipment } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { z } from "zod"

const updateEquipmentSchema = z.object({
  name: z.string().min(1).optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  manufacturer: z.string().optional(),
  purchaseDate: z.string().optional(),
  installationDate: z.string().optional(),
  warrantyExpiryDate: z.string().optional(),
  purchaseCost: z.string().optional(),
  locationInFacility: z.string().optional(),
  status: z.enum(['active', 'inactive', 'maintenance', 'retired']).optional(),
  condition: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
  specifications: z.string().optional(),
  maintenanceNotes: z.string().optional(),
  categoryId: z.string().optional(),
  images: z.array(z.string()).optional(),
})

/**
 * GET /api/equipment/[id]
 * Get equipment by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'facility' || !session.user.facilityId) {
      return NextResponse.json({ error: 'Only facilities can view equipment' }, { status: 403 })
    }

    const equipment = await db
      .select()
      .from(facilityEquipment)
      .where(
        and(
          eq(facilityEquipment.id, params.id),
          eq(facilityEquipment.facilityId, session.user.facilityId)
        )
      )
      .limit(1)

    if (!equipment.length) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: equipment[0] })
  } catch (error) {
    console.error('Error fetching equipment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/equipment/[id]
 * Update equipment
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'facility' || !session.user.facilityId) {
      return NextResponse.json({ error: 'Only facilities can update equipment' }, { status: 403 })
    }

    const body = await request.json()
    const validated = updateEquipmentSchema.parse(body)

    // Check if equipment exists and belongs to facility
    const existing = await db
      .select()
      .from(facilityEquipment)
      .where(
        and(
          eq(facilityEquipment.id, params.id),
          eq(facilityEquipment.facilityId, session.user.facilityId)
        )
      )
      .limit(1)

    if (!existing.length) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 })
    }

    // Build update object
    const updateData: any = {}
    if (validated.name !== undefined) updateData.name = validated.name
    if (validated.model !== undefined) updateData.model = validated.model || null
    if (validated.serialNumber !== undefined) updateData.serialNumber = validated.serialNumber || null
    if (validated.manufacturer !== undefined) updateData.manufacturer = validated.manufacturer || null
    if (validated.purchaseDate !== undefined) updateData.purchaseDate = validated.purchaseDate ? new Date(validated.purchaseDate) : null
    if (validated.installationDate !== undefined) updateData.installationDate = validated.installationDate ? new Date(validated.installationDate) : null
    if (validated.warrantyExpiryDate !== undefined) updateData.warrantyExpiryDate = validated.warrantyExpiryDate ? new Date(validated.warrantyExpiryDate) : null
    if (validated.purchaseCost !== undefined) updateData.purchaseCost = validated.purchaseCost || null
    if (validated.locationInFacility !== undefined) updateData.locationInFacility = validated.locationInFacility || null
    if (validated.status !== undefined) updateData.status = validated.status
    if (validated.condition !== undefined) updateData.condition = validated.condition
    if (validated.specifications !== undefined) updateData.specifications = validated.specifications || null
    if (validated.maintenanceNotes !== undefined) updateData.maintenanceNotes = validated.maintenanceNotes || null
    if (validated.categoryId !== undefined) updateData.categoryId = validated.categoryId || null
    if (validated.images !== undefined) updateData.images = validated.images && validated.images.length > 0 ? JSON.stringify(validated.images) : null

    await db
      .update(facilityEquipment)
      .set(updateData)
      .where(eq(facilityEquipment.id, params.id))

    const updated = await db
      .select()
      .from(facilityEquipment)
      .where(eq(facilityEquipment.id, params.id))
      .limit(1)

    return NextResponse.json({ success: true, data: updated[0] })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Error updating equipment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/equipment/[id]
 * Delete equipment
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'facility' || !session.user.facilityId) {
      return NextResponse.json({ error: 'Only facilities can delete equipment' }, { status: 403 })
    }

    // Check if equipment exists and belongs to facility
    const existing = await db
      .select()
      .from(facilityEquipment)
      .where(
        and(
          eq(facilityEquipment.id, params.id),
          eq(facilityEquipment.facilityId, session.user.facilityId)
        )
      )
      .limit(1)

    if (!existing.length) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 })
    }

    await db
      .delete(facilityEquipment)
      .where(eq(facilityEquipment.id, params.id))

    return NextResponse.json({ success: true, message: 'Equipment deleted' })
  } catch (error) {
    console.error('Error deleting equipment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

