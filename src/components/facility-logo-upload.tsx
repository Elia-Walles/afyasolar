"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Upload, Loader2, X, Image as ImageIcon } from "lucide-react"
import Image from "next/image"
import { toast } from "sonner"
import { useFacility } from "@/hooks/use-facilities"
import { useQueryClient } from "@tanstack/react-query"

interface FacilityLogoUploadProps {
  facilityId?: string
  className?: string
  size?: "sm" | "md" | "lg"
}

export function FacilityLogoUpload({ 
  facilityId, 
  className = "",
  size = "md"
}: FacilityLogoUploadProps) {
  const { data: facility } = useFacility(facilityId)
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sizeClasses = {
    sm: "w-16 h-16",
    md: "w-24 h-24",
    lg: "w-32 h-32",
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB')
      return
    }

    await uploadLogo(file)
  }

  const uploadLogo = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('logo', file)

      const response = await fetch(`/api/facilities/logo?facilityId=${facilityId}`, {
        method: 'PATCH',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to upload logo')
      }

      const data = await response.json()
      toast.success('Logo uploaded successfully')
      
      // Refetch facility data to get updated logo
      queryClient.invalidateQueries({ queryKey: ['facility', facilityId] })
      queryClient.invalidateQueries({ queryKey: ['facilities'] })
    } catch (error: any) {
      console.error('Error uploading logo:', error)
      toast.error(error.message || 'Failed to upload logo')
    } finally {
      setUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveLogo = async () => {
    if (!confirm('Are you sure you want to remove the logo?')) {
      return
    }

    setUploading(true)
    try {
      const response = await fetch(`/api/facilities/logo?facilityId=${facilityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoUrl: null }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to remove logo')
      }

      toast.success('Logo removed successfully')
      
      // Refetch facility data
      queryClient.invalidateQueries({ queryKey: ['facility', facilityId] })
      queryClient.invalidateQueries({ queryKey: ['facilities'] })
    } catch (error: any) {
      console.error('Error removing logo:', error)
      toast.error(error.message || 'Failed to remove logo')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div className={`relative ${sizeClasses[size]} rounded-full overflow-hidden border-2 border-gray-200 bg-gray-50 flex items-center justify-center group`}>
        {facility?.logoUrl ? (
          <>
            <Image
              src={facility.logoUrl}
              alt={`${facility.name} logo`}
              fill
              className="object-cover"
              unoptimized
            />
            {!uploading && (
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-white hover:bg-red-600"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveLogo()
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-400">
            <ImageIcon className="w-8 h-8 mb-1" />
            <span className="text-xs">No logo</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-white" />
          </div>
        )}
      </div>
      
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-xs"
        >
          {uploading ? (
            <>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Uploading...
            </>
          ) : facility?.logoUrl ? (
            <>
              <Upload className="w-3 h-3 mr-1" />
              Change
            </>
          ) : (
            <>
              <Upload className="w-3 h-3 mr-1" />
              Upload Logo
            </>
          )}
        </Button>
        {facility?.logoUrl && !uploading && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemoveLogo}
            className="text-xs text-red-600 hover:text-red-700"
          >
            <X className="w-3 h-3 mr-1" />
            Remove
          </Button>
        )}
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}
