import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { db } from "@/lib/db"
import { facilityEquipment, equipmentCategories } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { z } from "zod"
import { randomUUID } from "crypto"

const createEquipmentSchema = z.object({
  name: z.string().min(1),
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

const updateEquipmentSchema = createEquipmentSchema.partial()

/**
 * GET /api/equipment
 * Get all equipment for the facility
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'facility' || !session.user.facilityId) {
      return NextResponse.json({ error: 'Only facilities can view equipment' }, { status: 403 })
    }

    const equipment = await db
      .select({
        id: facilityEquipment.id,
        name: facilityEquipment.name,
        model: facilityEquipment.model,
        serialNumber: facilityEquipment.serialNumber,
        manufacturer: facilityEquipment.manufacturer,
        purchaseDate: facilityEquipment.purchaseDate,
        installationDate: facilityEquipment.installationDate,
        warrantyExpiryDate: facilityEquipment.warrantyExpiryDate,
        purchaseCost: facilityEquipment.purchaseCost,
        locationInFacility: facilityEquipment.locationInFacility,
        status: facilityEquipment.status,
        condition: facilityEquipment.condition,
        specifications: facilityEquipment.specifications,
        maintenanceNotes: facilityEquipment.maintenanceNotes,
        images: facilityEquipment.images,
        categoryId: facilityEquipment.categoryId,
        createdAt: facilityEquipment.createdAt,
        updatedAt: facilityEquipment.updatedAt,
      })
      .from(facilityEquipment)
      .where(eq(facilityEquipment.facilityId, session.user.facilityId))

    return NextResponse.json({ success: true, data: equipment })
  } catch (error) {
    console.error('Error fetching equipment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/equipment
 * Create new equipment
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'facility' || !session.user.facilityId) {
      return NextResponse.json({ error: 'Only facilities can create equipment' }, { status: 403 })
    }

    const body = await request.json()
    const validated = createEquipmentSchema.parse(body)

    const newEquipment = {
      id: randomUUID(),
      facilityId: session.user.facilityId,
      name: validated.name,
      model: validated.model || null,
      serialNumber: validated.serialNumber || null,
      manufacturer: validated.manufacturer || null,
      purchaseDate: validated.purchaseDate ? new Date(validated.purchaseDate) : null,
      installationDate: validated.installationDate ? new Date(validated.installationDate) : null,
      warrantyExpiryDate: validated.warrantyExpiryDate ? new Date(validated.warrantyExpiryDate) : null,
      purchaseCost: validated.purchaseCost || null,
      locationInFacility: validated.locationInFacility || null,
      status: validated.status || 'active',
      condition: validated.condition || 'good',
      specifications: validated.specifications || null,
      maintenanceNotes: validated.maintenanceNotes || null,
      images: validated.images && validated.images.length > 0 ? JSON.stringify(validated.images) : null,
      categoryId: validated.categoryId || null,
    }

    await db.insert(facilityEquipment).values(newEquipment)

    return NextResponse.json({ success: true, data: newEquipment }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Error creating equipment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

