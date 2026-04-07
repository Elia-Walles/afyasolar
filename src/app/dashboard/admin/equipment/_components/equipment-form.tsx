"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Plus, X, Image as ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  equipmentSchema,
  createEquipmentSchema,
  updateEquipmentSchema,
  useAdminEquipment,
  useCreateEquipment,
  useUpdateEquipment,
  type Equipment,
} from "@/hooks/use-admin-equipment"
import { BasicInfoForm } from "./forms/basic-info-form"
import { SpecificationsForm } from "./forms/specifications-form"
import { LocationContactForm } from "./forms/location-contact-form"

type FormValues = z.infer<typeof equipmentSchema> & { id?: string }

interface EquipmentFormProps {
  isEdit?: boolean
  equipmentId?: string
}

export default function EquipmentForm({ isEdit = false, equipmentId }: EquipmentFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')
  const [previewImages, setPreviewImages] = useState<Array<{
    url: string;
    isPrimary: boolean;
    caption?: string;
  }>>([])

  const { data: equipmentData } = useAdminEquipment(equipmentId || "")
  const createMutation = useCreateEquipment()
  const updateMutation = useUpdateEquipment()

  const defaultValues: z.infer<typeof equipmentSchema> = {
    id: "",
    equipmentName: "",
    brand: "",
    model: "",
    description: "",
    category: "",
    condition: "refurbished",
    price: 0,
    currency: "TZS",
    quantity: 1,
    status: "draft",
    warrantyMonths: 12,
    specifications: {
      weight: "",
      dimensions: "",
      power: "",
      manufacturer: "",
      modelYear: new Date().getFullYear(),
      serialNumber: ""
    },
    features: [],
    photos: [{
      url: "",
      isPrimary: true,
      caption: ""
    }],
    location: {
      name: "",
      address: "",
      city: "",
      country: "Tanzania",
      coordinates: {
        lat: -6.7924,
        lng: 39.2083,
      },
    },
    contactInfo: {
      name: "",
      email: "",
      phone: "",
    },
    shippingInfo: {
      available: false,
      cost: 0,
      estimatedDelivery: ""
    },
    returnPolicy: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const form = useForm<FormValues>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: defaultValues,
    mode: "onChange"
  })

  useEffect(() => {
    if (isEdit && equipmentData) {
      form.reset({
        ...equipmentData,
        price: Number(equipmentData.price) || 0,
        photos: equipmentData.photos || [],
      })
      setPreviewImages(equipmentData.photos || [])
    }
  }, [isEdit, equipmentData, form])

  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true)
      
      // Ensure at least one primary photo is selected
      const updatedData = { 
        ...data,
        updatedAt: new Date().toISOString()
      }
      
      if (updatedData.photos && updatedData.photos.length > 0 && 
          !updatedData.photos.some(photo => photo.isPrimary)) {
        updatedData.photos[0].isPrimary = true
      }

      if (isEdit && equipmentId) {
        // For updates, don't include id or createdAt in the data
        const { id, createdAt, ...updateFields } = updatedData
        await updateMutation.mutateAsync({
          id: equipmentId,
          data: updateFields,
        })
      } else {
        // For new items, don't include id or createdAt - they're generated server-side
        const { id, createdAt, ...createFields } = updatedData
        await createMutation.mutateAsync(createFields)
      }

      toast({
        title: isEdit ? "Equipment updated" : "Equipment created",
        description: isEdit
          ? "Your equipment has been updated successfully."
          : "Your equipment has been created successfully.",
      })

      router.push("/dashboard/admin/equipment")
      router.refresh()
    } catch (error) {
      console.error("Error submitting form:", error)
      toast({
        title: "Error",
        description: "An error occurred while submitting the form. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{isEdit ? "Edit Equipment" : "Add New Equipment"}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {isEdit 
                ? "Update the equipment details below." 
                : "Fill in the details below to add new equipment to your inventory."}
            </p>
          </CardHeader>
          <CardContent>
            <Tabs 
              value={activeTab} 
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="specs">Specifications</TabsTrigger>
                <TabsTrigger value="location">Location & Contact</TabsTrigger>
                <TabsTrigger value="media">Media</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-6">
                <BasicInfoForm 
                  control={form.control} 
                  isSubmitting={isSubmitting} 
                />
              </TabsContent>

              <TabsContent value="specs" className="space-y-6">
                <SpecificationsForm 
                  control={form.control} 
                  isSubmitting={isSubmitting} 
                />
              </TabsContent>

              <TabsContent value="location" className="space-y-6">
                <LocationContactForm 
                  control={form.control} 
                  isSubmitting={isSubmitting} 
                />
              </TabsContent>

              <TabsContent value="media" className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Equipment Photos</h3>
                  <p className="text-sm text-muted-foreground">
                    Upload clear photos of the equipment from different angles.
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {/* Placeholder for image upload component */}
                    <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center h-40">
                      <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground text-center">
                        Drag & drop images here or click to browse
                      </p>
                      <input 
                        type="file" 
                        className="hidden" 
                        id="image-upload" 
                        multiple 
                        accept="image/*"
                        // Add your image upload handler here
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="mt-2"
                        size="sm"
                        onClick={() => document.getElementById('image-upload')?.click()}
                      >
                        Upload Images
                      </Button>
                    </div>
                    
                    {/* Preview of uploaded images */}
                    {previewImages.map((image, index) => (
                      <div key={index} className="relative group rounded-lg overflow-hidden border h-40">
                        <div className="absolute inset-0 bg-cover bg-center" 
                             style={{ backgroundImage: `url(${image.url})` }}></div>
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="text-white hover:bg-white/20"
                            onClick={() => {
                              // Handle set as primary
                              const updatedImages = [...previewImages]
                              updatedImages.forEach((img, i) => {
                                img.isPrimary = i === index
                              })
                              setPreviewImages(updatedImages)
                            }}
                          >
                            {image.isPrimary ? (
                              <span className="text-yellow-400">★</span>
                            ) : (
                              <span className="text-white">★</span>
                            )}
                          </Button>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="text-white hover:bg-white/20"
                            onClick={() => {
                              // Handle remove image
                              const updatedImages = previewImages.filter((_, i) => i !== index)
                              setPreviewImages(updatedImages)
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        {image.isPrimary && (
                          <div className="absolute top-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded">
                            Primary
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <Separator className="my-8" />

            <div className="flex justify-between items-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard/admin/equipment")}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <div className="space-x-3">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setActiveTab(activeTab === 'basic' ? 'specs' : activeTab === 'specs' ? 'location' : 'media')}
                  disabled={isSubmitting}
                >
                  {activeTab === 'media' ? 'Review' : 'Next'}
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEdit ? "Update Equipment" : "Create Equipment"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </FormProvider>
  )
}
