"use client"

import { useMemo, useState, useRef, useEffect } from "react"
import {
  Activity,
  AlertCircle,
  BarChart3,
  Camera,
  CheckCircle,
  DollarSign,
  Image as ImageIcon,
  Loader2,
  Package,
  RefreshCcw,
  ShoppingCart,
  Truck,
  X,
  ChevronDown,
  Check,
  History,
  Store,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { useBuybacks, useCreateBuyback, useUpdateBuyback } from "@/hooks/use-buybacks"
import { useResaleInventory, usePurchaseResaleItem } from "@/hooks/use-resale-inventory"
import { useEquipment } from "@/hooks/use-equipment"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import { ServiceAccessPaymentDialog } from "@/components/services/service-access-payment-dialog"

type TabValue = "submit" | "my-submissions" | "buy-refurbished"
type BuyRefurbishedTab = "catalog" | "history"

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  submitted: "bg-gray-100 text-gray-800",
  under_review: "bg-yellow-100 text-yellow-800",
  offer_sent: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  pickup_scheduled: "bg-purple-100 text-purple-800",
  received: "bg-indigo-100 text-indigo-800",
  refurbishing: "bg-teal-100 text-teal-800",
  completed: "bg-emerald-100 text-emerald-800",
}

export function FacilityCircularTakeback() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<TabValue>("submit")
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>("")
  const [equipmentDropdownOpen, setEquipmentDropdownOpen] = useState(false)
  const equipmentDropdownRef = useRef<HTMLDivElement>(null)
  const [newBuyback, setNewBuyback] = useState({
    equipmentName: "",
    brand: "",
    model: "",
    serialNumber: "",
    purchaseDate: "",
    ageYears: "",
    condition: "good",
    functionalStatus: "fully_functional",
    issueDescription: "",
    reasonForSale: "",
    expectedPrice: "",
    hasWarranty: false,
    warrantyExpiry: "",
    hasDocumentation: false,
  })
  const [equipmentImages, setEquipmentImages] = useState<string[]>([])
  const [uploadingImages, setUploadingImages] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [expandedImages, setExpandedImages] = useState<string | null>(null)
  const [purchasingItem, setPurchasingItem] = useState<string | null>(null)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [selectedResaleItem, setSelectedResaleItem] = useState<{ id: string; name: string; price: number } | null>(null)
  const [buyRefurbishedTab, setBuyRefurbishedTab] = useState<BuyRefurbishedTab>("catalog")

  const { data: buybacks = [], isLoading } = useBuybacks()
  const updateBuyback = useUpdateBuyback()
  const { data: resaleItems = [], isLoading: catalogLoading } = useResaleInventory({
    status: "listed",
  })
  const { data: purchasedItems = [], isLoading: historyLoading } = useResaleInventory({
    status: "sold",
    facilityId: session?.user?.facilityId,
  })
  const purchaseResaleItem = usePurchaseResaleItem()
  const createBuybackMutation = useCreateBuyback()
  const { data: equipment = [], isLoading: equipmentLoading } = useEquipment()

  // Calculate age in years from purchase date
  const calculateAge = (purchaseDate: string | Date | null | undefined): string => {
    if (!purchaseDate) return ""
    const purchase = new Date(purchaseDate)
    const now = new Date()
    const years = Math.floor((now.getTime() - purchase.getTime()) / (1000 * 60 * 60 * 24 * 365))
    return years.toString()
  }

  // Handle equipment selection and auto-populate fields
  const handleEquipmentSelect = (equipmentId: string) => {
    setSelectedEquipmentId(equipmentId)
    setEquipmentDropdownOpen(false)
    const selectedEquipment = equipment.find((eq) => eq.id === equipmentId)
    
    if (selectedEquipment) {
      const purchaseDateStr = selectedEquipment.purchaseDate
        ? new Date(selectedEquipment.purchaseDate).toISOString().split('T')[0]
        : ""
      const ageYears = calculateAge(selectedEquipment.purchaseDate)
      const warrantyExpiryStr = selectedEquipment.warrantyExpiryDate
        ? new Date(selectedEquipment.warrantyExpiryDate).toISOString().split('T')[0]
        : ""
      const hasWarranty = selectedEquipment.warrantyExpiryDate 
        ? new Date(selectedEquipment.warrantyExpiryDate) > new Date()
        : false
      
      setNewBuyback({
        ...newBuyback,
        equipmentName: selectedEquipment.name,
        brand: selectedEquipment.manufacturer || "",
        model: selectedEquipment.model || "",
        serialNumber: selectedEquipment.serialNumber || "",
        purchaseDate: purchaseDateStr,
        ageYears: ageYears,
        condition: selectedEquipment.condition || "good",
        hasWarranty: hasWarranty,
        warrantyExpiry: warrantyExpiryStr,
      })
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (equipmentDropdownRef.current && !equipmentDropdownRef.current.contains(event.target as Node)) {
        setEquipmentDropdownOpen(false)
      }
    }

    if (equipmentDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [equipmentDropdownOpen])

  const impactMetrics = useMemo(() => {
    const soldBack = buybacks.filter((b) => b.status === "completed").length
    const totalEarned = buybacks
      .filter((b) => b.payoutAmount)
      .reduce((sum, b) => sum + Number(b.payoutAmount ?? 0), 0)
    const purchased = resaleItems.filter((i) => i.status === "sold").length
    const totalSaved = resaleItems
      .filter((i) => i.status === "sold" && i.projectedMargin)
      .reduce((sum, item) => sum + Number(item.projectedMargin ?? 0), 0)
    const eWaste = buybacks
      .filter((b) => b.impactWeightKg)
      .reduce((sum, b) => sum + Number(b.impactWeightKg ?? 0), 0)

    return {
      soldBack,
      totalEarned,
      purchased,
      totalSaved,
      co2Prevented: Math.max(50, Math.round(eWaste * 1.2)),
      eWasteAvoided: eWaste,
    }
  }, [buybacks, resaleItems])

  const pendingBuybacks = buybacks.filter((b) =>
    ["under_review", "offer_sent", "accepted", "pickup_scheduled"].includes(b.status)
  )

  const [respondingToOffer, setRespondingToOffer] = useState<string | null>(null)

  const handlePurchaseItem = async (itemId: string) => {
    // Find the item to get its details
    const item = resaleItems.find((i) => i.id === itemId)
    if (!item || !item.listPrice) {
      return
    }

    // Show payment dialog instead of directly purchasing
    setSelectedResaleItem({
      id: itemId,
      name: item.equipmentName,
      price: parseFloat(item.listPrice),
    })
    setShowPaymentDialog(true)
  }

  const handlePaymentComplete = async () => {
    if (selectedResaleItem) {
      try {
        setPurchasingItem(selectedResaleItem.id)
        await purchaseResaleItem.mutateAsync({ id: selectedResaleItem.id })
      } catch (error) {
        // Error already handled by the mutation
      } finally {
        setPurchasingItem(null)
        setSelectedResaleItem(null)
      }
    }
  }

  const handleOfferResponse = async (buybackId: string, action: "accept" | "reject") => {
    try {
      setRespondingToOffer(buybackId)
      await updateBuyback.mutateAsync({
        id: buybackId,
        payload: {
          status: action === "accept" ? "accepted" : "rejected",
        },
      })
    } finally {
      setRespondingToOffer(null)
    }
  }

  // Camera setup
  useEffect(() => {
    if (cameraOpen && videoRef.current) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' } })
        .then((stream) => {
          streamRef.current = stream
          if (videoRef.current) {
            videoRef.current.srcObject = stream
          }
        })
        .catch((error) => {
          console.error('Error accessing camera:', error)
          setCameraOpen(false)
        })
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [cameraOpen])

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0)
        const imageData = canvas.toDataURL('image/jpeg', 0.8)
        setEquipmentImages([...equipmentImages, imageData])
        setCameraOpen(false)
      }
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploadingImages(true)
    try {
      const formData = new FormData()
      Array.from(files).forEach((file) => {
        formData.append('images', file)
      })

      const response = await fetch('/api/upload?type=buyback', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to upload images')
      }

      const data = await response.json()
      setEquipmentImages([...equipmentImages, ...data.data.urls])
    } catch (error) {
      console.error('Error uploading images:', error)
    } finally {
      setUploadingImages(false)
    }
  }

  const removeImage = (index: number) => {
    setEquipmentImages(equipmentImages.filter((_, i) => i !== index))
  }

  const handleSubmitBuyback = async () => {
    if (!newBuyback.equipmentName.trim()) return

    try {
      // Upload base64 images if any
      let imageUrls: string[] = []
      if (equipmentImages.length > 0) {
        const base64Images = equipmentImages.filter((img) => img.startsWith('data:'))
        const urlImages = equipmentImages.filter((img) => !img.startsWith('data:'))

        if (base64Images.length > 0) {
          setUploadingImages(true)
          try {
            const response = await fetch('/api/upload?type=buyback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ images: base64Images }),
            })
            if (response.ok) {
              const data = await response.json()
              imageUrls = [...urlImages, ...data.data.urls]
            } else {
              imageUrls = urlImages
            }
          } catch (error) {
            console.error('Error uploading images:', error)
            imageUrls = urlImages
          } finally {
            setUploadingImages(false)
          }
        } else {
          imageUrls = urlImages
        }
      }

      await createBuybackMutation.mutateAsync({
        equipmentName: newBuyback.equipmentName.trim(),
        brand: newBuyback.brand || undefined,
        model: newBuyback.model || undefined,
        serialNumber: newBuyback.serialNumber || undefined,
        purchaseDate: newBuyback.purchaseDate || undefined,
        ageYears: newBuyback.ageYears ? Number(newBuyback.ageYears) : undefined,
        condition: newBuyback.condition as "excellent" | "good" | "fair" | "poor",
        functionalStatus: newBuyback.functionalStatus as
          | "fully_functional"
          | "partially_functional"
          | "not_functional",
        hasWarranty: newBuyback.hasWarranty,
        warrantyExpiry: newBuyback.warrantyExpiry || undefined,
        hasDocumentation: newBuyback.hasDocumentation,
        issueDescription: newBuyback.issueDescription || undefined,
        reasonForSale: newBuyback.reasonForSale || undefined,
        expectedPrice: newBuyback.expectedPrice ? Number(newBuyback.expectedPrice) : undefined,
        photos: imageUrls.map((url) => ({ url })),
      })

      setSelectedEquipmentId("")
      setNewBuyback({
        equipmentName: "",
        brand: "",
        model: "",
        serialNumber: "",
        purchaseDate: "",
        ageYears: "",
        condition: "good",
        functionalStatus: "fully_functional",
        issueDescription: "",
        reasonForSale: "",
        expectedPrice: "",
        hasWarranty: false,
        warrantyExpiry: "",
        hasDocumentation: false,
      })
      setEquipmentImages([])
    } catch (error) {
      console.error('Error submitting buyback:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-700">Equipment Sold Back</p>
                <p className="text-3xl font-bold text-green-700">{impactMetrics.soldBack}</p>
              </div>
              <RefreshCcw className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-sm text-green-700 mt-2 font-medium">
              Earned: TZS {impactMetrics.totalEarned.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-700">Refurbished Purchased</p>
                <p className="text-3xl font-bold text-blue-700">{impactMetrics.purchased}</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
            <p className="text-sm text-blue-700 mt-2 font-medium">
              Saved: TZS {impactMetrics.totalSaved.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-teal-50 to-green-50 border-teal-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-700">CO₂ Prevented</p>
                <p className="text-2xl font-bold text-teal-700">
                  {impactMetrics.co2Prevented} kg
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-teal-600" />
            </div>
            <p className="text-xs text-gray-600 mt-2">Environmental impact</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-700">E-waste Avoided</p>
                <p className="text-2xl font-bold text-emerald-700">
                  {impactMetrics.eWasteAvoided.toFixed(1)} kg
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
            <p className="text-xs text-gray-600 mt-2">Diverted from landfills</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="submit">Submit Equipment</TabsTrigger>
          <TabsTrigger value="my-submissions">My Submissions</TabsTrigger>
          <TabsTrigger value="buy-refurbished">Buy Refurbished</TabsTrigger>
        </TabsList>

        <TabsContent value="submit">
          <Card>
            <CardHeader>
              <CardTitle>Sell Your Old Equipment</CardTitle>
              <CardDescription>
                Submit equipment details for instant valuation, schedule pickup, and receive payouts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="relative col-span-3 md:col-span-1" ref={equipmentDropdownRef}>
                  <Label>Select Registered Equipment *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between mt-1 h-auto min-h-[2.5rem]"
                    onClick={() => {
                      console.log("Equipment dropdown clicked", { equipment, equipmentLoading, equipmentDropdownOpen })
                      setEquipmentDropdownOpen(!equipmentDropdownOpen)
                    }}
                    disabled={equipmentLoading}
                  >
                    <span className="text-left flex-1 truncate">
                      {selectedEquipmentId
                        ? equipment.find((eq) => eq.id === selectedEquipmentId)?.name || "Select equipment"
                        : equipmentLoading
                        ? "Loading..."
                        : equipment.length > 0
                        ? `Select equipment (${equipment.length} available)`
                        : "Select equipment"}
                    </span>
                    <ChevronDown className={cn("h-4 w-4 ml-2 transition-transform flex-shrink-0", equipmentDropdownOpen && "rotate-180")} />
                  </Button>
                  
                  {equipmentDropdownOpen && (
                    <div className="absolute z-[100] w-full mt-2 bg-white border-2 border-gray-400 rounded-lg shadow-2xl max-h-[500px] overflow-y-auto overflow-x-hidden">
                      {equipmentLoading ? (
                        <div className="p-6 text-sm text-muted-foreground text-center">
                          <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                          Loading equipment...
                        </div>
                      ) : equipment.length === 0 ? (
                        <div className="p-6 text-sm text-muted-foreground text-center">
                          <Package className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                          <p className="font-medium">No registered equipment found</p>
                          <p className="text-xs mt-1">Please register equipment first to use this feature</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-200">
                          {equipment.map((eq) => {
                            console.log("Rendering equipment:", eq)
                            return (
                              <button
                                key={eq.id}
                                type="button"
                                onClick={() => {
                                  console.log("Equipment selected:", eq)
                                  handleEquipmentSelect(eq.id)
                                }}
                                className={cn(
                                  "w-full text-left p-4 hover:bg-blue-50 transition-colors border-b border-gray-200 last:border-b-0",
                                  selectedEquipmentId === eq.id && "bg-blue-100 border-l-4 border-l-blue-600"
                                )}
                              >
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-lg text-gray-900">{eq.name || "Unnamed Equipment"}</span>
                                    {selectedEquipmentId === eq.id && (
                                      <Check className="h-5 w-5 text-blue-600 flex-shrink-0" />
                                    )}
                                  </div>
                                  
                                  <div className="space-y-2 text-sm bg-gray-50 p-3 rounded border border-gray-200">
                                    <div className="flex items-start gap-3">
                                      <span className="font-bold text-gray-700 min-w-[100px] text-left">Brand:</span>
                                      <span className="text-gray-900 font-medium">{eq.manufacturer || "Not specified"}</span>
                                    </div>
                                    <div className="flex items-start gap-3">
                                      <span className="font-bold text-gray-700 min-w-[100px] text-left">Model:</span>
                                      <span className="text-gray-900 font-medium">{eq.model || "Not specified"}</span>
                                    </div>
                                    <div className="flex items-start gap-3">
                                      <span className="font-bold text-gray-700 min-w-[100px] text-left">Serial Number:</span>
                                      <span className="text-gray-900 font-mono text-sm font-medium">{eq.serialNumber || "Not specified"}</span>
                                    </div>
                                    <div className="flex items-start gap-3">
                                      <span className="font-bold text-gray-700 min-w-[100px] text-left">Location:</span>
                                      <span className="text-gray-900 font-medium">{eq.locationInFacility || "Not specified"}</span>
                                    </div>
                                    {eq.purchaseDate ? (
                                      <div className="flex items-start gap-3">
                                        <span className="font-bold text-gray-700 min-w-[100px] text-left">Purchase Date:</span>
                                        <span className="text-gray-900 font-medium">{new Date(eq.purchaseDate).toLocaleDateString()}</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-start gap-3">
                                        <span className="font-bold text-gray-700 min-w-[100px] text-left">Purchase Date:</span>
                                        <span className="text-gray-500 italic">Not specified</span>
                                      </div>
                                    )}
                                    <div className="flex items-start gap-3">
                                      <span className="font-bold text-gray-700 min-w-[100px] text-left">Condition:</span>
                                      <span className="text-gray-900 font-medium capitalize">{eq.condition || "Not specified"}</span>
                                    </div>
                                    <div className="flex items-start gap-3">
                                      <span className="font-bold text-gray-700 min-w-[100px] text-left">Status:</span>
                                      <span className="text-gray-900 font-medium capitalize">{eq.status || "Not specified"}</span>
                                    </div>
                                    {eq.purchaseCost && (
                                      <div className="flex items-start gap-3">
                                        <span className="font-bold text-gray-700 min-w-[100px] text-left">Purchase Cost:</span>
                                        <span className="text-gray-900 font-medium">TZS {Number(eq.purchaseCost).toLocaleString()}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {equipment.length === 0 && !equipmentLoading && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Register equipment first to use this feature
                    </p>
                  )}
                  {selectedEquipmentId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-xs"
                      onClick={() => {
                        setSelectedEquipmentId("")
                        setNewBuyback({
                          ...newBuyback,
                          equipmentName: "",
                          brand: "",
                          model: "",
                          serialNumber: "",
                          purchaseDate: "",
                          ageYears: "",
                        })
                      }}
                    >
                      Clear Selection
                    </Button>
                  )}
                </div>
                <div>
                  <Label>Equipment Name *</Label>
                  <Input
                    value={newBuyback.equipmentName}
                    onChange={(e) => setNewBuyback({ ...newBuyback, equipmentName: e.target.value })}
                    placeholder="e.g., Oxygen Concentrator"
                    readOnly={!!selectedEquipmentId}
                    className={selectedEquipmentId ? "bg-gray-50" : ""}
                  />
                </div>
                <div>
                  <Label>Brand</Label>
                  <Input
                    value={newBuyback.brand}
                    onChange={(e) => setNewBuyback({ ...newBuyback, brand: e.target.value })}
                    placeholder="Philips, Tuttnauer..."
                    readOnly={!!selectedEquipmentId}
                    className={selectedEquipmentId ? "bg-gray-50" : ""}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-4 gap-4">
                <div>
                  <Label>Model</Label>
                  <Input
                    value={newBuyback.model}
                    onChange={(e) => setNewBuyback({ ...newBuyback, model: e.target.value })}
                    readOnly={!!selectedEquipmentId}
                    className={selectedEquipmentId ? "bg-gray-50" : ""}
                  />
                </div>
                <div>
                  <Label>Serial Number</Label>
                  <Input
                    value={newBuyback.serialNumber}
                    onChange={(e) => setNewBuyback({ ...newBuyback, serialNumber: e.target.value })}
                    readOnly={!!selectedEquipmentId}
                    className={selectedEquipmentId ? "bg-gray-50" : ""}
                  />
                </div>
                <div>
                  <Label>Purchase Date</Label>
                  <Input
                    type="date"
                    value={newBuyback.purchaseDate}
                    onChange={(e) => {
                      const newDate = e.target.value
                      const ageYears = calculateAge(newDate)
                      setNewBuyback({ 
                        ...newBuyback, 
                        purchaseDate: newDate,
                        ageYears: ageYears
                      })
                    }}
                    readOnly={!!selectedEquipmentId}
                    className={selectedEquipmentId ? "bg-gray-50" : ""}
                  />
                </div>
                <div>
                  <Label>Age (Years)</Label>
                  <Input
                    type="number"
                    value={newBuyback.ageYears}
                    onChange={(e) => setNewBuyback({ ...newBuyback, ageYears: e.target.value })}
                    readOnly={!!selectedEquipmentId}
                    className={selectedEquipmentId ? "bg-gray-50" : ""}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Physical Condition</Label>
                  <Select
                    value={newBuyback.condition}
                    onValueChange={(value) => setNewBuyback({ ...newBuyback, condition: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excellent">Excellent - Like new</SelectItem>
                      <SelectItem value="good">Good - Minor wear</SelectItem>
                      <SelectItem value="fair">Fair - Visible wear</SelectItem>
                      <SelectItem value="poor">Poor - Needs repairs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Functional Status</Label>
                  <Select
                    value={newBuyback.functionalStatus}
                    onValueChange={(value) =>
                      setNewBuyback({ ...newBuyback, functionalStatus: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Functional status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fully_functional">Fully Functional</SelectItem>
                      <SelectItem value="partially_functional">Partially Functional</SelectItem>
                      <SelectItem value="not_functional">Not Functional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Known Issues</Label>
                  <Textarea
                    rows={3}
                    value={newBuyback.issueDescription}
                    onChange={(e) =>
                      setNewBuyback({ ...newBuyback, issueDescription: e.target.value })
                    }
                    placeholder="Describe any problems or defects..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reason for Selling</Label>
                  <Textarea
                    rows={3}
                    value={newBuyback.reasonForSale}
                    onChange={(e) =>
                      setNewBuyback({ ...newBuyback, reasonForSale: e.target.value })
                    }
                    placeholder="Why are you selling this equipment?"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Expected Price (TZS)</Label>
                  <Input
                    type="number"
                    value={newBuyback.expectedPrice}
                    onChange={(e) =>
                      setNewBuyback({ ...newBuyback, expectedPrice: e.target.value })
                    }
                    placeholder="e.g., 500000"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Warranty & Documentation</Label>
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="warranty"
                        checked={newBuyback.hasWarranty}
                        onCheckedChange={(checked) =>
                          setNewBuyback({ ...newBuyback, hasWarranty: Boolean(checked) })
                        }
                      />
                      <Label htmlFor="warranty">Still under warranty</Label>
                    </div>
                    {newBuyback.hasWarranty && (
                      <Input
                        type="date"
                        value={newBuyback.warrantyExpiry}
                        onChange={(e) =>
                          setNewBuyback({ ...newBuyback, warrantyExpiry: e.target.value })
                        }
                      />
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="documentation"
                      checked={newBuyback.hasDocumentation}
                      onCheckedChange={(checked) =>
                        setNewBuyback({ ...newBuyback, hasDocumentation: Boolean(checked) })
                      }
                    />
                    <Label htmlFor="documentation">Has manuals/certificates</Label>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Equipment Photos</Label>
                <p className="text-xs text-gray-500">
                  Upload photos or take pictures of the equipment to help with valuation
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCameraOpen(true)}
                    className="flex items-center gap-2"
                  >
                    <Camera className="h-4 w-4" />
                    Take Photo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const input = document.createElement('input')
                      input.type = 'file'
                      input.accept = 'image/*'
                      input.multiple = true
                      input.onchange = (e) => {
                        handleFileUpload(e as any)
                      }
                      input.click()
                    }}
                    disabled={uploadingImages}
                    className="flex items-center gap-2"
                  >
                    {uploadingImages ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <ImageIcon className="h-4 w-4" />
                        Upload Images
                      </>
                    )}
                  </Button>
                </div>
                {equipmentImages.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                    {equipmentImages.map((img, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={img}
                          alt={`Equipment ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg border border-gray-200"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeImage(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  onClick={handleSubmitBuyback}
                  disabled={createBuybackMutation.isPending || !newBuyback.equipmentName.trim()}
                >
                  {createBuybackMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <DollarSign className="h-4 w-4 mr-2" />
                      Submit for Valuation
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setNewBuyback({
                      equipmentName: "",
                      brand: "",
                      model: "",
                      serialNumber: "",
                      purchaseDate: "",
                      ageYears: "",
                      condition: "good",
                      functionalStatus: "fully_functional",
                      issueDescription: "",
                      reasonForSale: "",
                      expectedPrice: "",
                      hasWarranty: false,
                      warrantyExpiry: "",
                      hasDocumentation: false,
                    })
                    setEquipmentImages([])
                  }}
                >
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="my-submissions">
          <Card>
            <CardHeader>
              <CardTitle>Your Buyback Submissions</CardTitle>
              <CardDescription>Track status and payouts from the circular program.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-gray-500">
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Loading submissions...
                </div>
              ) : buybacks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <Activity className="h-10 w-10 mb-3" />
                  <p>No submissions yet. Start by submitting equipment for buyback.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {buybacks.map((submission) => {
                    const canRespond =
                      submission.status === "offer_sent" && !submission.payoutAmount
                    return (
                    <div
                      key={submission.id}
                      className="border border-green-200 rounded-lg p-4 space-y-3 bg-gradient-to-r from-white to-green-50"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-lg">{submission.equipmentName}</h3>
                            <Badge className={cn("text-xs", statusColors[submission.status])}>
                              {submission.status.replace("_", " ")}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">
                            {submission.brand} {submission.model}
                          </p>
                          <p className="text-xs text-gray-500">
                            Submitted {new Date(submission.createdAt).toLocaleDateString()}
                          </p>
                          {submission.issueDescription && (
                            <p className="text-xs text-gray-500">{submission.issueDescription}</p>
                          )}
                          {submission.photos && submission.photos.length > 0 && (
                            <div className="mt-3 space-y-2">
                              <p className="text-xs font-medium text-gray-700 flex items-center gap-1">
                                <ImageIcon className="h-3 w-3" />
                                Equipment Photos ({submission.photos.length})
                              </p>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {submission.photos.map((photo, idx) => {
                                  const photoUrl = typeof photo === 'string' ? photo : photo?.url
                                  if (!photoUrl) return null
                                  
                                  const thumbnailUrl = photoUrl.includes('cloudinary.com')
                                    ? photoUrl.replace('/upload/', '/upload/w_300,h_300,c_fill,g_auto,q_auto,f_auto/')
                                    : photoUrl
                                  
                                  return (
                                    <div
                                      key={idx}
                                      className="relative group cursor-pointer bg-white rounded-lg overflow-hidden border border-gray-200 hover:border-emerald-400 hover:shadow-md transition-all"
                                      onClick={() => setExpandedImages(photoUrl)}
                                    >
                                      <div className="relative w-full h-24 bg-gray-50">
                                        <img
                                          src={thumbnailUrl}
                                          alt={typeof photo === 'object' && photo?.caption ? photo.caption : `Equipment photo ${idx + 1}`}
                                          className="w-full h-full object-cover"
                                          loading="lazy"
                                          decoding="async"
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                          <ImageIcon className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="text-right space-y-1">
                          {submission.quoteAmount && (
                            <p className="text-2xl font-bold text-green-600">
                              TZS {Number(submission.quoteAmount).toLocaleString()}
                            </p>
                          )}
                          {submission.payoutAmount && (
                            <p className="text-sm text-gray-600">
                              Paid TZS {Number(submission.payoutAmount).toLocaleString()}
                            </p>
                          )}
                          {submission.pickupDate && (
                            <div className="flex items-center justify-end gap-1 text-xs text-blue-600">
                              <Truck className="w-3 h-3" />
                              {new Date(submission.pickupDate).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                      {canRespond && (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button
                            className="flex-1"
                            onClick={() => handleOfferResponse(submission.id, "accept")}
                            disabled={respondingToOffer === submission.id}
                          >
                            {respondingToOffer === submission.id ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Accepting...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Accept Offer
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => handleOfferResponse(submission.id, "reject")}
                            disabled={respondingToOffer === submission.id}
                          >
                            Decline
                          </Button>
                        </div>
                      )}
                    </div>
                  )})}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="buy-refurbished">
          <Tabs value={buyRefurbishedTab} onValueChange={(v) => setBuyRefurbishedTab(v as BuyRefurbishedTab)} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="catalog">
                <Store className="h-4 w-4 mr-2" />
                Catalog
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="h-4 w-4 mr-2" />
                Purchase History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="catalog">
              <div className="space-y-4">
                <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
                  <CardContent className="p-6 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Why Buy Refurbished?</h3>
                      <p className="text-gray-700 mt-1">
                        Save up to 60% while supporting circular economy and reducing e-waste
                      </p>
                    </div>
                    <Package className="h-12 w-12 text-blue-600" />
                  </CardContent>
                </Card>

                {catalogLoading ? (
                  <div className="flex items-center justify-center py-12 text-gray-500">
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Loading catalog...
                  </div>
                ) : resaleItems.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-10 text-gray-500">
                      <Package className="h-10 w-10 mb-3" />
                      <p>No refurbished equipment available at the moment. Check back soon.</p>
                    </CardContent>
                  </Card>
                ) : (
                  resaleItems.map((item) => (
                    <Card key={item.id} className="overflow-hidden border-green-200">
                      <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-xl">{item.equipmentName}</CardTitle>
                            <CardDescription className="text-base mt-1">
                              {item.brand} {item.model}
                            </CardDescription>
                          </div>
                          <Badge
                            className={
                              item.status === "listed"
                                ? "bg-green-100 text-green-800"
                                : "bg-yellow-100 text-yellow-800"
                            }
                          >
                            {item.status === "listed" ? "In Stock" : item.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4 pt-6">
                        <div className="flex items-baseline space-x-3">
                          <p className="text-4xl font-bold text-green-600">
                            {item.currency ?? "TZS"} {Number(item.listPrice ?? 0).toLocaleString()}
                          </p>
                          {item.projectedMargin && (
                            <Badge className="bg-yellow-100 text-yellow-800">
                              Save TZS {Number(item.projectedMargin).toLocaleString()}
                            </Badge>
                          )}
                        </div>

                        <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-700">
                          <div>
                            <p>
                              <span className="font-medium">Condition:</span> {item.condition}
                            </p>
                            <p>
                              <span className="font-medium">Warranty:</span>{" "}
                              {item.warrantyMonths ? `${item.warrantyMonths} months` : "Included"}
                            </p>
                          </div>
                          <div>
                            <p>
                              <span className="font-medium">Margin:</span>{" "}
                              {item.marginPercentage ? `${item.marginPercentage}%` : "N/A"}
                            </p>
                            <p>
                              <span className="font-medium">SKU:</span> {item.sku || "N/A"}
                            </p>
                          </div>
                        </div>

                        <div className="flex space-x-2 pt-4 border-t">
                          <Button
                            className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                            disabled={item.status !== "listed" || purchaseResaleItem.isPending}
                            onClick={() => handlePurchaseItem(item.id)}
                          >
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            {purchasingItem === item.id && purchaseResaleItem.isPending
                              ? "Processing..."
                              : item.status === "listed"
                              ? "Buy Now"
                              : "Unavailable"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="history">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Purchase History</CardTitle>
                    <CardDescription>
                      View all refurbished equipment you have purchased
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {historyLoading ? (
                      <div className="flex items-center justify-center py-12 text-gray-500">
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Loading purchase history...
                      </div>
                    ) : purchasedItems.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                        <History className="h-10 w-10 mb-3" />
                        <p>No purchase history yet. Start shopping to see your purchases here.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {purchasedItems.map((item) => (
                          <Card key={item.id} className="border-l-4 border-l-green-500">
                            <CardContent className="pt-6">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <Package className="h-5 w-5 text-green-600" />
                                    <h3 className="text-lg font-semibold">{item.equipmentName}</h3>
                                    <Badge className="bg-green-100 text-green-800">Purchased</Badge>
                                  </div>
                                  <p className="text-sm text-gray-600 mb-3">
                                    {item.brand} {item.model}
                                  </p>
                                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <p className="text-gray-500">Purchase Date</p>
                                      <p className="font-medium">
                                        {item.soldAt
                                          ? new Date(item.soldAt).toLocaleDateString("en-US", {
                                              year: "numeric",
                                              month: "long",
                                              day: "numeric",
                                            })
                                          : "N/A"}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500">Price Paid</p>
                                      <p className="font-medium text-green-600">
                                        {item.currency ?? "TZS"}{" "}
                                        {Number(item.salePrice ?? item.listPrice ?? 0).toLocaleString()}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500">Condition</p>
                                      <p className="font-medium capitalize">{item.condition}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500">Warranty</p>
                                      <p className="font-medium">
                                        {item.warrantyMonths ? `${item.warrantyMonths} months` : "Included"}
                                      </p>
                                    </div>
                                    {item.sku && (
                                      <div>
                                        <p className="text-gray-500">SKU</p>
                                        <p className="font-medium">{item.sku}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      {/* Camera Modal */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-emerald-900/45 via-slate-900/55 to-black/55 backdrop-blur-sm p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle>Capture Photo</CardTitle>
              <CardDescription>Position the equipment in the frame and capture</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative bg-slate-950 rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-auto"
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>
              <div className="flex gap-2">
                <Button onClick={capturePhoto} className="flex-1">
                  <Camera className="h-4 w-4 mr-2" />
                  Capture
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCameraOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payment Dialog */}
      {selectedResaleItem && (
        <ServiceAccessPaymentDialog
          open={showPaymentDialog}
          onOpenChange={setShowPaymentDialog}
          serviceName="equipment-resale"
          serviceDisplayName={`Purchase ${selectedResaleItem.name}`}
          amount={selectedResaleItem.price}
          resaleItemId={selectedResaleItem.id}
          onPaymentComplete={handlePaymentComplete}
        />
      )}

      {/* Image Modal */}
      {expandedImages && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-emerald-900/45 via-slate-900/55 to-black/55 backdrop-blur-sm p-4"
          onClick={() => setExpandedImages(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-10 bg-white/10 hover:bg-white/20 text-white"
              onClick={() => setExpandedImages(null)}
            >
              <X className="h-5 w-5" />
            </Button>
            <img
              src={expandedImages}
              alt="Equipment photo"
              className="w-full h-auto rounded-lg object-contain max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  )
}

