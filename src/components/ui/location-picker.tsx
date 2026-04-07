"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { MapPin, Loader2, Crosshair, AlertCircle } from "lucide-react"

interface LocationPickerProps {
  onLocationChange: (latitude: number, longitude: number) => void
  initialLatitude?: number | null
  initialLongitude?: number | null
  disabled?: boolean
}

export function LocationPicker({
  onLocationChange,
  initialLatitude,
  initialLongitude,
  disabled = false
}: LocationPickerProps) {
  const [latitude, setLatitude] = useState<string>(initialLatitude?.toString() || "")
  const [longitude, setLongitude] = useState<string>(initialLongitude?.toString() || "")
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [address, setAddress] = useState<string>("")

  // Get current location using browser's geolocation API
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser")
      return
    }

    setIsGettingLocation(true)
    setLocationError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        
        setLatitude(lat.toFixed(8))
        setLongitude(lng.toFixed(8))
        onLocationChange(lat, lng)
        setIsGettingLocation(false)
        setLocationError(null)
        
        // Reverse geocode to get address (optional)
        reverseGeocode(lat, lng)
      },
      (error) => {
        setIsGettingLocation(false)
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError("Location access denied. Please enable location permissions.")
            break
          case error.POSITION_UNAVAILABLE:
            setLocationError("Location information is unavailable.")
            break
          case error.TIMEOUT:
            setLocationError("Location request timed out.")
            break
          default:
            setLocationError("An unknown error occurred while getting location.")
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    )
  }

  // Reverse geocoding function (optional - to get address from coordinates)
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      // Using Nominatim (OpenStreetMap) for reverse geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'AfyaLink/1.0'
          }
        }
      )
      
      if (response.ok) {
        const data = await response.json()
        const formattedAddress = data.display_name || "Address not found"
        setAddress(formattedAddress)
      }
    } catch (error) {
      console.error("Error reverse geocoding:", error)
    }
  }

  // Handle manual input changes
  const handleLatitudeChange = (value: string) => {
    setLatitude(value)
    const lat = parseFloat(value)
    if (!isNaN(lat) && lat >= -90 && lat <= 90) {
      const lng = parseFloat(longitude)
      if (!isNaN(lng) && lng >= -180 && lng <= 180) {
        onLocationChange(lat, lng)
      }
    }
  }

  const handleLongitudeChange = (value: string) => {
    setLongitude(value)
    const lng = parseFloat(value)
    if (!isNaN(lng) && lng >= -180 && lng <= 180) {
      const lat = parseFloat(latitude)
      if (!isNaN(lat) && lat >= -90 && lat <= 90) {
        onLocationChange(lat, lng)
      }
    }
  }

  return (
    <Card className="w-full">
      <CardContent className="p-4 space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Facility Location</Label>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={getCurrentLocation}
              disabled={disabled || isGettingLocation}
              className="w-full sm:w-auto"
            >
              {isGettingLocation ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Getting Location...
                </>
              ) : (
                <>
                  <Crosshair className="w-4 h-4 mr-2" />
                  Use Current Location
                </>
              )}
            </Button>
          </div>

          {locationError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <p className="text-sm text-red-600">{locationError}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="latitude" className="text-sm text-gray-600">
                Latitude
              </Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                placeholder="e.g., -6.7924"
                value={latitude}
                onChange={(e) => handleLatitudeChange(e.target.value)}
                disabled={disabled}
                min="-90"
                max="90"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="longitude" className="text-sm text-gray-600">
                Longitude
              </Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                placeholder="e.g., 39.2083"
                value={longitude}
                onChange={(e) => handleLongitudeChange(e.target.value)}
                disabled={disabled}
                min="-180"
                max="180"
              />
            </div>
          </div>

          {address && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center gap-2 text-sm text-blue-800">
                <MapPin className="w-4 h-4" />
                <span className="font-medium">Detected Address:</span>
              </div>
              <p className="text-sm text-gray-700 mt-1">{address}</p>
            </div>
          )}

          <div className="text-xs text-gray-500 space-y-1">
            <p>• Click "Use Current Location" to auto-detect coordinates</p>
            <p>• Or manually enter latitude (-90 to 90) and longitude (-180 to 180)</p>
            <p>• Location helps us provide better service and support</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
