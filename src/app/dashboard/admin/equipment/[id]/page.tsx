"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft, Edit, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAdminEquipment } from "@/hooks/use-admin-equipment"
import { format } from "date-fns"
import { useToast } from "@/components/ui/use-toast"
import { useDeleteEquipment } from "@/hooks/use-admin-equipment"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function EquipmentDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { toast } = useToast()
  const { data: equipment, isLoading } = useAdminEquipment(params.id)
  const deleteMutation = useDeleteEquipment()

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this equipment? This cannot be undone.")) {
      return
    }

    try {
      await deleteMutation.mutateAsync(params.id)
      toast({
        title: "Success",
        description: "Equipment deleted successfully",
        variant: "default",
      })
      router.push("/dashboard/admin/equipment")
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete equipment",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mb-4">Loading equipment details...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!equipment) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-md bg-red-50 p-4">
          <h3 className="text-sm font-medium text-red-800">Equipment not found</h3>
          <div className="mt-2 text-sm text-red-700">
            <p>The equipment you are looking for does not exist or has been deleted.</p>
          </div>
          <div className="mt-4">
            <Button variant="outline" onClick={() => router.push("/dashboard/admin/equipment")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Equipment
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Equipment
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{equipment.equipmentName}</h1>
            <p className="text-muted-foreground">
              {equipment.brand} {equipment.model}
            </p>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/dashboard/admin/equipment/${equipment.id}/edit`)}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none">
                <p>{equipment.description || "No description provided."}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="font-medium">
                  {equipment.status === "draft" && <Badge variant="secondary">Draft</Badge>}
                  {equipment.status === "published" && <Badge variant="default">Published</Badge>}
                  {equipment.status === "sold_out" && <Badge variant="destructive">Sold Out</Badge>}
                  {equipment.status === "archived" && <Badge variant="outline">Archived</Badge>}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Price</p>
                <p className="font-medium">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: equipment.currency || "TZS",
                  }).format(Number(equipment.price))}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Quantity in Stock</p>
                <p className="font-medium">{equipment.quantity}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Updated</p>
                <p className="font-medium">
                  {format(new Date(equipment.updatedAt), "MMM d, yyyy")}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
