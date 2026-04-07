"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search, Loader2 } from "lucide-react"
import { Button } from "../../../../components/ui/button"
import { Input } from "../../../../components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table"
import { Badge } from "../../../../components/ui/badge"
import { format } from "date-fns"
import { useAdminEquipmentList, type Equipment } from "../../../../hooks/use-admin-equipment"
import { useToast } from "../../../../components/ui/use-toast"

export default function AdminEquipmentPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const { data: equipment, isLoading, error } = useAdminEquipmentList()

  // Show toast on data load or error
  useEffect(() => {
    if (error) {
      toast({
        variant: "destructive",
        title: "Error loading equipment",
        description: "There was an error loading the equipment list. Please try again.",
      })
    } else if (equipment) {
      toast({
        title: "Equipment loaded",
        description: `Successfully loaded ${equipment.length} items`,
      })
    }
  }, [equipment, error, toast])

  const handleSearch = (term: string) => {
    setSearchTerm(term)
    if (term) {
      toast({
        title: "Searching...",
        description: `Filtering equipment by "${term}"`,
      })
    }
  }

  const filteredEquipment = equipment?.filter((item: Equipment) =>
    item.equipmentName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusBadge = (status: string) => {
    const statusMap = {
      draft: "bg-gray-100 text-gray-800",
      published: "bg-green-100 text-green-800",
      sold_out: "bg-red-100 text-red-800",
      archived: "bg-gray-200 text-gray-600",
    }
    return <Badge className={statusMap[status as keyof typeof statusMap]}>{status.replace("_", " ")}</Badge>
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-2xl font-bold">Equipment Listings</h1>
          <p className="text-muted-foreground">Manage equipment available for resale</p>
        </div>
        <Button 
          onClick={() => {
            toast({
              title: "Creating new equipment",
              description: "Redirecting to the new equipment form...",
            })
            router.push("/dashboard/admin/equipment/new")
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Equipment
        </Button>
      </div>

      <div className="mt-6 space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search equipment..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <div className="flex items-center justify-center">
                      <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                      Loading equipment...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredEquipment && filteredEquipment.length > 0 ? (
                filteredEquipment.map((item: Equipment) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.equipmentName}</TableCell>
                    <TableCell>{item.brand || "-"}</TableCell>
                    <TableCell>{item.model || "-"}</TableCell>
                    <TableCell>
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: item.currency || "TZS",
                      }).format(Number(item.price))}
                    </TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell>{format(new Date(item.updatedAt), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          toast({
                            title: "Viewing equipment",
                            description: `Viewing details for ${item.equipmentName}`,
                          })
                          router.push(`/dashboard/admin/equipment/${item.id}`)
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    No equipment found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
