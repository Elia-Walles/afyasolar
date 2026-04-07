"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Loader2, Building2, MapPin, Phone, Mail, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { AuthLogoBadge } from "@/components/auth/auth-logo-badge"

interface InviteFacilityDialogProps {
  onSuccess?: () => void
}

export function InviteFacilityDialog({ onSuccess }: InviteFacilityDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingRegions, setIsLoadingRegions] = useState(false)
  const [regions, setRegions] = useState<Array<{ id: number; name: string }>>([])
  const [districts, setDistricts] = useState<Array<{ id: number; name: string; regionId: number }>>([])
  const [selectedRegionId, setSelectedRegionId] = useState<string>("")
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    address: "", // Optional - no default value
    phone: "+255 ",
    region: "",
    regionId: undefined as number | undefined,
    districtId: undefined as number | undefined,
  })

  // Load regions when dialog opens
  useEffect(() => {
    if (open) {
      loadRegions()
    }
  }, [open])

  // Load districts when region changes
  useEffect(() => {
    if (selectedRegionId) {
      loadDistricts(parseInt(selectedRegionId))
    } else {
      setDistricts([])
      setSelectedDistrictId("")
    }
  }, [selectedRegionId])

  const loadRegions = async () => {
    try {
      setIsLoadingRegions(true)
      const response = await fetch('/api/regions', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      })
      
      if (response.ok) {
        const result = await response.json()
        const regionsData = result.data || []
        setRegions(regionsData)
        if (regionsData.length === 0) {
          toast.error('No regions available. Please contact support.')
        }
      } else {
        toast.error('Failed to load regions. Please refresh the page.')
      }
    } catch (error) {
      console.error('Error loading regions:', error)
      toast.error('Error loading regions. Please check your connection and try again.')
    } finally {
      setIsLoadingRegions(false)
    }
  }

  const loadDistricts = async (regionId: number) => {
    try {
      setDistricts([])
      setSelectedDistrictId("")
      const response = await fetch(`/api/districts?regionId=${regionId}`)
      if (response.ok) {
        const result = await response.json()
        const districtsData = result.data || []
        setDistricts(districtsData)
      } else {
        console.error('Failed to load districts:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Error loading districts:', error)
    }
  }

  const handleRegionChange = (regionId: string) => {
    setSelectedRegionId(regionId)
    setSelectedDistrictId("")
    setDistricts([])
    
    const selectedRegion = regions.find(r => r.id.toString() === regionId)
    if (selectedRegion) {
      setFormData({ ...formData, region: selectedRegion.name, regionId: parseInt(regionId), districtId: undefined })
    }
    
    if (regionId) {
      loadDistricts(parseInt(regionId))
    }
  }

  const handleDistrictChange = (districtId: string) => {
    setSelectedDistrictId(districtId)
    
    const selectedDistrict = districts.find(d => d.id.toString() === districtId)
    if (selectedDistrict) {
      setFormData({ ...formData, districtId: parseInt(districtId) })
    }
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value
    
    // Ensure "+255 " prefix is always present
    const prefix = "+255 "
    
    // If user tries to delete the prefix, prevent it
    if (!value.startsWith(prefix)) {
      // If value is shorter than prefix, restore prefix
      if (value.length < prefix.length) {
        value = prefix
      } else {
        // If user typed something else, extract only numbers and add prefix
        const digitsOnly = value.replace(/\D/g, '')
        // If starts with 0, remove it and use remaining digits
        if (digitsOnly.startsWith('0') && digitsOnly.length > 1) {
          const remainingDigits = digitsOnly.substring(1)
          value = prefix + (remainingDigits.length <= 9 ? remainingDigits : remainingDigits.substring(0, 9))
        } else if (digitsOnly.startsWith('255') && digitsOnly.length > 3) {
          // If starts with 255, use digits after 255
          const after255 = digitsOnly.substring(3)
          value = prefix + (after255.length <= 9 ? after255 : after255.substring(0, 9))
        } else {
          // Use all digits, limit to 9
          value = prefix + (digitsOnly.length <= 9 ? digitsOnly : digitsOnly.substring(0, 9))
        }
      }
    } else {
      // Extract only numbers from the part after the prefix
      const afterPrefix = value.substring(prefix.length)
      const digitsOnly = afterPrefix.replace(/\D/g, '')
      // Limit to 9 digits
      value = prefix + (digitsOnly.length <= 9 ? digitsOnly : digitsOnly.substring(0, 9))
    }
    
    setFormData({ ...formData, phone: value })
    const { phone: _, ...restErrors } = errors
    setErrors(restErrors)
  }

  const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const prefix = "+255 "
    const input = e.currentTarget
    const cursorPosition = input.selectionStart || 0
    
    // Prevent deletion of the prefix
    if (cursorPosition <= prefix.length) {
      // Allow backspace/delete only if there's content after the prefix
      if ((e.key === 'Backspace' || e.key === 'Delete') && formData.phone.length > prefix.length) {
        // Allow the deletion but it will be handled by onChange
        return
      }
      // Prevent cursor from going before the prefix
      if (e.key === 'ArrowLeft' || e.key === 'Home') {
        e.preventDefault()
        input.setSelectionRange(prefix.length, prefix.length)
      }
    }
    
    // Prevent typing non-numeric characters after the prefix
    if (cursorPosition >= prefix.length) {
      if (e.key.length === 1 && !/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
        e.preventDefault()
      }
    }
  }

  const handlePhoneFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const prefix = "+255 "
    // If phone is empty or doesn't start with prefix, set it
    if (!formData.phone.startsWith(prefix)) {
      setFormData({ ...formData, phone: prefix })
    }
    // Move cursor to end after prefix
    setTimeout(() => {
      e.target.setSelectionRange(formData.phone.length, formData.phone.length)
    }, 0)
  }

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value
    
    // Address is optional - allow empty value
    if (!value || value.trim() === '') {
      setFormData({ ...formData, address: '' })
      const { address: _, ...restErrors } = errors
      setErrors(restErrors)
      return
    }
    
    // If user starts typing, optionally add "P.O BOX " prefix if they don't have it
    const prefix = "P.O BOX "
    
    // If value doesn't start with prefix and user is typing, allow free-form input
    // Only auto-format if they're clearly trying to enter a PO BOX number
    if (!value.startsWith(prefix) && /^\d/.test(value.trim())) {
      // If they start with a number, assume they want PO BOX format
      const numbers = value.replace(/\D/g, '')
      if (numbers) {
        value = prefix + numbers
      }
    } else if (value.startsWith(prefix)) {
      // If it starts with prefix, extract only numbers from the part after the prefix
      const afterPrefix = value.substring(prefix.length)
      const numbers = afterPrefix.replace(/\D/g, '')
      value = prefix + numbers
    }
    
    setFormData({ ...formData, address: value })
    const { address: _, ...restErrors } = errors
    setErrors(restErrors)
  }

  const handleAddressKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const prefix = "P.O BOX "
    const input = e.currentTarget
    const cursorPosition = input.selectionStart || 0
    const currentAddress = formData.address || ''
    
    // If address is empty, allow free-form input
    if (!currentAddress || currentAddress.trim() === '') {
      return
    }
    
    // If address starts with prefix, enforce format rules
    if (currentAddress.startsWith(prefix)) {
      // Prevent deletion of the prefix
      if (cursorPosition <= prefix.length) {
        // Allow backspace/delete only if there's content after the prefix
        if ((e.key === 'Backspace' || e.key === 'Delete') && currentAddress.length > prefix.length) {
          // Allow the deletion but it will be handled by onChange
          return
        }
        // Prevent cursor from going before the prefix
        if (e.key === 'ArrowLeft' || e.key === 'Home') {
          e.preventDefault()
          input.setSelectionRange(prefix.length, prefix.length)
        }
      }
      
      // Prevent typing non-numeric characters after the prefix
      if (cursorPosition >= prefix.length) {
        if (e.key.length === 1 && !/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
          e.preventDefault()
        }
      }
    }
  }

  const handleAddressFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Address is optional - no auto-formatting on focus
    // User can type freely or leave empty
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.email) {
      newErrors.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email address"
    }

    if (!formData.name || formData.name.length < 2) {
      newErrors.name = "Facility name must be at least 2 characters"
    }

    // Address is optional, but if provided, validate format
    if (formData.address && formData.address.length > "P.O BOX ".length) {
      if (!/^P\.?O\.?\s*BOX\s+\d+$/i.test(formData.address.trim())) {
        newErrors.address = "Please enter a valid P.O BOX number"
      }
    }

    if (!formData.phone || formData.phone.length <= "+255 ".length) {
      newErrors.phone = "Please enter a phone number"
    } else {
      const afterPrefix = formData.phone.substring("+255 ".length)
      const digitsOnly = afterPrefix.replace(/\D/g, '')
      if (digitsOnly.length !== 9) {
        newErrors.phone = "Phone number must have exactly 9 digits after +255 (e.g., +255 712 345 678)"
      }
    }

    if (!formData.region || !selectedRegionId) {
      newErrors.region = "Region is required"
    }

    if (!selectedDistrictId) {
      newErrors.district = "District is required"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/admin/facilities/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          name: formData.name,
          address: formData.address,
          region: formData.region,
          phone: formData.phone,
          regionId: formData.regionId,
          districtId: formData.districtId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to send invitation")
      }

      toast.success("Invitation sent successfully!")
      setOpen(false)
      // Reset form
                setFormData({
                  email: "",
                  name: "",
                  address: "", // Optional - no default value
                  phone: "+255 ",
                  region: "",
                  regionId: undefined,
                  districtId: undefined,
                })
      setSelectedRegionId("")
      setSelectedDistrictId("")
      setErrors({})
      onSuccess?.()
    } catch (error: any) {
      toast.error(error.message || "Failed to send invitation")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="text-xs h-7 px-2 bg-green-600 hover:bg-green-700">
          <Plus className="w-3 h-3 mr-1" />
          Invite Facility
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <AuthLogoBadge className="mb-3" size={72} />
          <DialogTitle className="text-lg">Invite New Facility</DialogTitle>
          <DialogDescription>
            Fill in the facility information. An invitation email will be sent to complete registration.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Information Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-green-900 border-b border-green-200 pb-1.5">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Facility Name */}
              <div className="space-y-1">
                <Label htmlFor="facilityName" className="text-xs font-semibold text-green-800 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-green-600" />
                  Facility Name
                </Label>
                <div className="relative group">
                  <Input
                    id="facilityName"
                    type="text"
                    placeholder="Health Center Name"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value })
                      const { name: _, ...restErrors } = errors
                      setErrors(restErrors)
                    }}
                    disabled={isLoading}
                    className="h-9 text-sm border border-green-200/80 bg-white focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:bg-white shadow-sm hover:shadow-md transition-all"
                  />
                </div>
                {errors.name && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Email Field */}
              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs font-semibold text-green-800 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-green-600" />
                  Email Address
                </Label>
                <div className="relative group">
                  <Input
                    id="email"
                    type="email"
                    placeholder="facility@example.com"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value })
                      const { email: _, ...restErrors } = errors
                      setErrors(restErrors)
                    }}
                    disabled={isLoading}
                    className="h-9 text-sm border border-green-200/80 bg-white focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:bg-white shadow-sm hover:shadow-md transition-all"
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Phone Number */}
              <div className="space-y-1">
                <Label htmlFor="phone" className="text-xs font-semibold text-green-800 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-green-600" />
                  Phone Number
                </Label>
                <div className="relative group">
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+255 712 345 678"
                    value={formData.phone}
                    onChange={handlePhoneChange}
                    onKeyDown={handlePhoneKeyDown}
                    onFocus={handlePhoneFocus}
                    disabled={isLoading}
                    className="h-9 w-[180px] text-sm border border-green-200/80 bg-white focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:bg-white shadow-sm hover:shadow-md transition-all"
                  />
                </div>
                {errors.phone && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    {errors.phone}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Location Information Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-green-900 border-b border-green-200 pb-1.5">Location Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Address */}
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="address" className="text-xs font-semibold text-green-800 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-green-600" />
                  Address <span className="text-gray-500 font-normal">(Optional)</span>
                </Label>
                <div className="relative group">
                  <Input
                    id="address"
                    type="text"
                    placeholder="P.O BOX 1234 (Optional)"
                    value={formData.address}
                    onChange={handleAddressChange}
                    onKeyDown={handleAddressKeyDown}
                    onFocus={handleAddressFocus}
                    disabled={isLoading}
                    className="h-9 w-[160px] text-sm border border-green-200/80 bg-white focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:bg-white shadow-sm hover:shadow-md transition-all"
                  />
                </div>
                {errors.address && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    {errors.address}
                  </p>
                )}
              </div>

              {/* Region */}
              <div className="space-y-1">
                <Label htmlFor="region" className="text-xs font-semibold text-green-800 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-green-600" />
                  Region
                </Label>
                <Select
                  value={selectedRegionId}
                  onValueChange={handleRegionChange}
                  disabled={isLoading || isLoadingRegions}
                >
                  <SelectTrigger className="h-9 text-sm border border-green-200/80 bg-white focus:border-green-500 focus:ring-2 focus:ring-green-500/20 shadow-sm hover:shadow-md transition-all">
                    <SelectValue placeholder={isLoadingRegions ? "Loading regions..." : "Select region"} />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingRegions ? (
                      <div className="p-2 text-center text-sm text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      </div>
                    ) : regions.length === 0 ? (
                      <div className="p-2 text-center text-sm text-gray-500">
                        No regions available
                      </div>
                    ) : (
                      regions.map((region) => (
                        <SelectItem key={region.id} value={region.id.toString()}>
                          {region.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {errors.region && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    {errors.region}
                  </p>
                )}
              </div>

              {/* District/City */}
              <div className="space-y-1">
                <Label htmlFor="district" className="text-xs font-semibold text-green-800 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-green-600" />
                  District
                </Label>
                <Select
                  value={selectedDistrictId}
                  onValueChange={handleDistrictChange}
                  disabled={isLoading || !selectedRegionId}
                >
                  <SelectTrigger className="h-9 text-sm border border-green-200/80 bg-white focus:border-green-500 focus:ring-2 focus:ring-green-500/20 shadow-sm hover:shadow-md transition-all">
                    <SelectValue placeholder={!selectedRegionId ? "Select region first" : districts.length === 0 ? "No districts available" : "Select district"} />
                  </SelectTrigger>
                  <SelectContent>
                    {districts.length === 0 ? (
                      <div className="p-2 text-center text-sm text-gray-500">
                        {!selectedRegionId ? "Please select a region first" : "No districts available"}
                      </div>
                    ) : (
                      districts.map((district) => (
                        <SelectItem key={district.id} value={district.id.toString()}>
                          {district.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {errors.district && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    {errors.district}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false)
                setFormData({
                  email: "",
                  name: "",
                  address: "",
                  phone: "+255 ",
                  region: "",
                  regionId: undefined,
                  districtId: undefined,
                })
                setSelectedRegionId("")
                setSelectedDistrictId("")
                setErrors({})
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-green-600 hover:bg-green-700">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Invitation"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
