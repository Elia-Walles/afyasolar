'use client'

import { useComprehensiveFacilities } from '@/hooks/use-facilities'

export default function DebugFacilitiesPage() {
  const { data: facilities, isLoading, error } = useComprehensiveFacilities()

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug: Facilities Data</h1>
      <div className="space-y-4">
        {facilities?.map((facility) => (
          <div key={facility.id} className="border p-4 rounded">
            <p><strong>ID:</strong> {facility.id}</p>
            <p><strong>Name:</strong> {facility.name}</p>
            <p><strong>Slug:</strong> {facility.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-')}</p>
            <p><strong>Status:</strong> {facility.status}</p>
            <p><strong>City:</strong> {facility.city}</p>
            <p><strong>Region:</strong> {facility.region}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
