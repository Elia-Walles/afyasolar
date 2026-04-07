import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

export const equipmentSchema = z.object({
  id: z.string(),
  equipmentName: z.string().min(1, "Equipment name is required"),
  brand: z.string().min(1, "Brand is required"),
  model: z.string().min(1, "Model is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  category: z.string().min(1, "Category is required"),
  condition: z.enum(["new", "used", "refurbished"]).default("refurbished"),
  price: z.number().min(0, "Price must be a positive number"),
  currency: z.string().default("TZS"),
  quantity: z.number().int().min(1, "Quantity must be at least 1").default(1),
  status: z.enum(["draft", "published", "sold_out", "archived"]).default("draft"),
  warrantyMonths: z.number().int().min(0, "Warranty must be a positive number").default(12),
  specifications: z.object({
    weight: z.string().optional(),
    dimensions: z.string().optional(),
    power: z.string().optional(),
    manufacturer: z.string().optional(),
    modelYear: z.number().optional(),
    serialNumber: z.string().optional(),
  }).optional(),
  features: z.array(z.string()).default([]),
  photos: z.array(z.object({
    url: z.string().url("Must be a valid URL"),
    isPrimary: z.boolean().default(false),
    caption: z.string().optional(),
  })).min(1, "At least one photo is required"),
  location: z.object({
    name: z.string(),
    address: z.string(),
    city: z.string(),
    country: z.string(),
    coordinates: z.object({
      lat: z.number(),
      lng: z.number(),
    }).optional(),
  }),
  contactInfo: z.object({
    name: z.string(),
    email: z.string().email("Invalid email"),
    phone: z.string().min(8, "Phone number is required"),
  }),
  shippingInfo: z.object({
    available: z.boolean().default(true),
    cost: z.number().min(0).default(0),
    estimatedDelivery: z.string().optional(),
  }).optional(),
  paymentTerms: z.string().optional(),
  returnPolicy: z.string().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})

export const createEquipmentSchema = equipmentSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
})

export const updateEquipmentSchema = createEquipmentSchema.partial()

export type Equipment = z.infer<typeof equipmentSchema>
export type CreateEquipmentInput = z.infer<typeof createEquipmentSchema>
export type UpdateEquipmentInput = z.infer<typeof updateEquipmentSchema>

// Mock API functions - replace these with actual API calls
const fetchEquipmentList = async (): Promise<Equipment[]> => {
  // Sample data for testing
  return [
    {
      id: '1',
      equipmentName: 'Ultrasound Machine',
      brand: 'GE Healthcare',
      model: 'Voluson E10',
      description: 'Premium ultrasound system for general imaging with advanced features for detailed diagnostics.',
      category: 'Diagnostic Imaging',
      condition: 'refurbished',
      price: 45000000, // 45,000,000 TZS
      currency: 'TZS',
      quantity: 2,
      status: 'published',
      warrantyMonths: 12,
      specifications: {
        weight: '120kg',
        dimensions: '120x80x60cm',
        power: '100-240V, 50/60Hz',
        manufacturer: 'GE Healthcare',
        modelYear: 2022,
        serialNumber: 'US-2022-00123'
      },
      features: ['4D Imaging', 'Touch Screen', 'Wireless Connectivity', 'DICOM 3.0', 'Multi-frequency Probes'],
      photos: [
        {
          url: '/images/ultrasound.jpg',
          isPrimary: true,
          caption: 'Front view with touch screen'
        },
        {
          url: '/images/ultrasound-side.jpg',
          isPrimary: false,
          caption: 'Side view showing probe connections'
        }
      ],
      location: {
        name: 'Main Warehouse',
        address: 'Industrial Area, Plot 123',
        city: 'Dar es Salaam',
        country: 'Tanzania',
        coordinates: {
          lat: -6.7924,
          lng: 39.2083
        }
      },
      contactInfo: {
        name: 'Medical Equipment Sales',
        email: 'sales@afyasolar.com',
        phone: '+255 712 345 678'
      },
      shippingInfo: {
        available: true,
        cost: 250000, // 250,000 TZS
        estimatedDelivery: '3-5 business days'
      },
      paymentTerms: '50% deposit, 50% before delivery',
      returnPolicy: '30-day return policy for unused items',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: '2',
      equipmentName: 'Patient Monitor',
      brand: 'Philips',
      model: 'IntelliVue MX40',
      description: 'Wearable patient monitor for continuous monitoring of vital signs with wireless connectivity.',
      category: 'Patient Monitoring',
      condition: 'used',
      price: 12500000, // 12,500,000 TZS
      currency: 'TZS',
      quantity: 5,
      status: 'published',
      warrantyMonths: 6,
      specifications: {
        weight: '0.5kg',
        dimensions: '12x8x3cm',
        manufacturer: 'Philips Healthcare',
        modelYear: 2021,
        serialNumber: 'PM-2021-04567'
      },
      features: ['ECG', 'SpO2', 'NIBP', 'Temperature', 'Respiratory Rate', 'Alarm System'],
      photos: [
        {
          url: '/images/patient-monitor.jpg',
          isPrimary: true,
          caption: 'Front view with display'
        },
        {
          url: '/images/patient-monitor-worn.jpg',
          isPrimary: false,
          caption: 'Worn by patient'
        }
      ],
      location: {
        name: 'Central Medical Supplies',
        address: 'Mikocheni B, Plot 45',
        city: 'Dar es Salaam',
        country: 'Tanzania',
        coordinates: {
          lat: -6.7833,
          lng: 39.2333
        }
      },
      contactInfo: {
        name: 'Equipment Department',
        email: 'equipment@afyasolar.com',
        phone: '+255 754 123 456'
      },
      shippingInfo: {
        available: true,
        cost: 100000, // 100,000 TZS
        estimatedDelivery: '2-3 business days'
      },
      paymentTerms: 'Full payment before delivery',
      returnPolicy: '14-day return policy',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]
}

const fetchEquipment = async (id: string): Promise<Equipment> => {
  // In a real app, this would be an API call
  throw new Error("Not implemented")
}

const createEquipment = async (data: CreateEquipmentInput): Promise<Equipment> => {
  // In a real app, this would be an API call
  return {
    ...data,
    id: Math.random().toString(36).substring(2, 9),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

const updateEquipment = async ({ 
  id, 
  data 
}: { 
  id: string; 
  data: UpdateEquipmentInput 
}): Promise<Equipment> => {
  // In a real app, this would be an API call
  const current = await fetchEquipment(id)
  return {
    ...current,
    ...data,
    updatedAt: new Date().toISOString(),
  }
}

const deleteEquipment = async (id: string): Promise<void> => {
  // In a real app, this would be an API call
  console.log("Deleting equipment:", id)
}

export const useAdminEquipmentList = () => {
  return useQuery<Equipment[]>({
    queryKey: ['admin', 'equipment'],
    queryFn: fetchEquipmentList,
  })
}

export const useAdminEquipment = (id: string) => {
  return useQuery<Equipment>({
    queryKey: ['admin', 'equipment', id],
    queryFn: () => fetchEquipment(id),
    enabled: !!id,
  })
}

export const useCreateEquipment = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createEquipment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'equipment'] })
    },
  })
}

export const useUpdateEquipment = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: updateEquipment,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'equipment'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'equipment', data.id] })
    },
  })
}

export const useDeleteEquipment = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: deleteEquipment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'equipment'] })
    },
  })
}
