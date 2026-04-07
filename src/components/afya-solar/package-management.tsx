'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Package, 
  Zap, 
  DollarSign,
  Settings,
  CheckCircle,
  XCircle,
  Save,
  Loader2
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface SolarPackage {
  id: number
  code: string
  name: string
  ratedKw: number
  suitableFor: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  plans: {
    id: number
    planTypeCode: string
    currency: string
    pricing: {
      cashPrice?: number
      installmentDurationMonths?: number
      defaultUpfrontPercent?: string
      defaultMonthlyAmount?: number
      eaasMonthlyFee?: number
      eaasBillingModel?: string
    }
  }[]
}

interface PackageFormData {
  code: string
  name: string
  ratedKw: number
  suitableFor: string
  isActive: boolean
}

export default function AfyaSolarPackageManagement() {
  const { toast } = useToast()
  const [packages, setPackages] = useState<SolarPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [editingPackage, setEditingPackage] = useState<SolarPackage | null>(null)
  const [formData, setFormData] = useState<PackageFormData>({
    code: '',
    name: '',
    ratedKw: 0,
    suitableFor: '',
    isActive: true
  })

  // Function to map rated kW to package names
  const getPackageName = (ratedKw: number, originalName: string) => {
    switch (ratedKw) {
      case 10:
        return 'Ultra'
      case 6:
        return 'Pro'
      case 4.2:
        return 'Plus'
      case 2:
        return 'Essential'
      default:
        return originalName
    }
  }

  useEffect(() => {
    fetchPackages()
  }, [])

  const fetchPackages = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/afya-solar/packages')
      const data = await response.json()
      // Normalize API response to a safe array.
      // API shape is: { success: true, data: { packages: [...] } } or mock data with same shape.
      const payload = data?.data
      const list: SolarPackage[] = Array.isArray(payload?.packages)
        ? payload.packages
        : Array.isArray(payload)
          ? payload
          : Array.isArray(data)
            ? data
            : []
      setPackages(list)
    } catch (error) {
      console.error('Error fetching packages:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePackage = async () => {
    try {
      const response = await fetch('/api/afya-solar/packages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          package: formData,
          specs: {
            panelType: 'MONO',
            panelCapacity: formData.ratedKw,
            inverterType: 'STRING',
            mountingType: 'ROOFTOP',
            warrantyYears: 10
          },
          plans: [
            {
              planTypeCode: 'CASH',
              currency: 'TZS',
              pricing: {
                cashPrice: 1000000,
                includesShipping: true,
                includesInstallation: true,
                includesCommissioning: true,
                includesMaintenance: false
              }
            },
            {
              planTypeCode: 'INSTALLMENT',
              currency: 'TZS',
              pricing: {
                installmentDurationMonths: 12,
                defaultUpfrontPercent: '20.00',
                defaultMonthlyAmount: 100000,
                includesShipping: true,
                includesInstallation: true,
                includesCommissioning: true,
                includesMaintenance: false
              }
            },
            {
              planTypeCode: 'EAAS',
              currency: 'TZS',
              pricing: {
                eaasMonthlyFee: 50000,
                eaasBillingModel: 'FIXED_MONTHLY',
                includesShipping: true,
                includesInstallation: true,
                includesCommissioning: true,
                includesMaintenance: true
              }
            }
          ]
        })
      })

      if (response.ok) {
        setIsCreateDialogOpen(false)
        setFormData({ code: '', name: '', ratedKw: 0, suitableFor: '', isActive: true })
        fetchPackages()
        toast({
          title: "Package Created",
          description: `${formData.name} has been created successfully.`,
          duration: 3000,
        })
      } else {
        const errorData = await response.json()
        toast({
          title: "Creation Failed",
          description: errorData.error || "Failed to create package. Please try again.",
          variant: "destructive",
          duration: 5000,
        })
      }
    } catch (error) {
      console.error('Error creating package:', error)
    }
  }

  const handleToggleActive = async (packageId: number, isActive: boolean) => {
    try {
      await fetch(`/api/afya-solar/packages/${packageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: !isActive })
      })
      fetchPackages()
    } catch (error) {
      console.error('Error toggling package:', error)
    }
  }

  const handleDeletePackage = async (packageId: number) => {
    if (confirm('Are you sure you want to delete this package? This action cannot be undone.')) {
      try {
        const response = await fetch(`/api/afya-solar/packages/${packageId}`, {
          method: 'DELETE'
        })
        
        if (response.ok) {
          fetchPackages()
          toast({
            title: "Package Deleted",
            description: "Package has been deleted successfully.",
            duration: 3000,
          })
        } else {
          const errorData = await response.json()
          toast({
            title: "Deletion Failed",
            description: errorData.error || "Failed to delete package. Please try again.",
            variant: "destructive",
            duration: 5000,
          })
        }
      } catch (error) {
        console.error('Error deleting package:', error)
        toast({
          title: "Deletion Failed",
          description: "Network error. Please check your connection and try again.",
          variant: "destructive",
          duration: 5000,
        })
      }
    }
  }

  const handleEditPackage = (pkg: SolarPackage) => {
    console.log('Editing package:', pkg)
    setEditingPackage(pkg)
    setFormData({
      code: pkg.code,
      name: pkg.name,
      ratedKw: pkg.ratedKw,
      suitableFor: pkg.suitableFor,
      isActive: pkg.isActive
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdatePackage = async () => {
    if (!editingPackage) return

    setIsUpdating(true)
    try {
      const response = await fetch(`/api/afya-solar/packages/${editingPackage.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: formData.code,
          name: formData.name,
          ratedKw: formData.ratedKw,
          suitableFor: formData.suitableFor,
          isActive: formData.isActive
        })
      })

      if (response.ok) {
        setIsEditDialogOpen(false)
        setEditingPackage(null)
        setFormData({ code: '', name: '', ratedKw: 0, suitableFor: '', isActive: true })
        fetchPackages()
        toast({
          title: "Package Updated",
          description: `${formData.name} has been updated successfully.`,
          duration: 3000,
        })
      } else {
        const errorData = await response.json()
        toast({
          title: "Update Failed",
          description: errorData.error || "Failed to update package. Please try again.",
          variant: "destructive",
          duration: 5000,
        })
      }
    } catch (error) {
      console.error('Error updating package:', error)
      toast({
        title: "Update Failed",
        description: "Network error. Please check your connection and try again.",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const getPlanTypeColor = (planTypeCode: string) => {
    switch (planTypeCode) {
      case 'CASH': return 'bg-green-100 text-green-800'
      case 'INSTALLMENT': return 'bg-blue-100 text-blue-800'
      case 'EAAS': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Package Management</h1>
          <p className="text-gray-600">Manage solar package offerings and pricing</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Package
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Package</DialogTitle>
              <DialogDescription>
                Add a new solar package with specifications and pricing plans
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="code">Package Code</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g., SOLAR-50W"
                  />
                </div>
                <div>
                  <Label htmlFor="name">Package Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., 50W Residential System"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ratedKw">Rated Power (kW)</Label>
                  <Input
                    id="ratedKw"
                    type="number"
                    value={formData.ratedKw}
                    onChange={(e) => setFormData({ ...formData, ratedKw: Number(e.target.value) })}
                    placeholder="0.05"
                  />
                </div>
                <div>
                  <Label htmlFor="suitableFor">Suitable For</Label>
                  <Input
                    id="suitableFor"
                    value={formData.suitableFor}
                    onChange={(e) => setFormData({ ...formData, suitableFor: e.target.value })}
                    placeholder="e.g., Residential, Small Business"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
                <Label htmlFor="isActive">Active Package</Label>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreatePackage}>
                Create Package
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Package Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open)
          if (!open) {
            setEditingPackage(null)
            setFormData({ code: '', name: '', ratedKw: 0, suitableFor: '', isActive: true })
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Package</DialogTitle>
              <DialogDescription>
                Update the solar package details and configuration
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-code">Package Code</Label>
                  <Input
                    id="edit-code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g., SOLAR-50W"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-name">Package Name</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., 50W Residential System"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-ratedKw">Rated Power (kW)</Label>
                  <Input
                    id="edit-ratedKw"
                    type="number"
                    value={formData.ratedKw}
                    onChange={(e) => setFormData({ ...formData, ratedKw: Number(e.target.value) })}
                    placeholder="0.05"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-suitableFor">Suitable For</Label>
                  <Input
                    id="edit-suitableFor"
                    value={formData.suitableFor}
                    onChange={(e) => setFormData({ ...formData, suitableFor: e.target.value })}
                    placeholder="e.g., Residential, Small Business"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
                <Label htmlFor="edit-isActive">Active Package</Label>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdatePackage} disabled={isUpdating}>
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Update Package
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Packages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(Array.isArray(packages) ? packages : []).map((pkg) => (
          <Card key={pkg.id} className={pkg.isActive ? '' : 'opacity-60'}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Package className="h-5 w-5" />
                  <CardTitle className="text-lg">{getPackageName(pkg.ratedKw, pkg.name)}</CardTitle>
                </div>
                <Badge variant={pkg.isActive ? 'default' : 'secondary'}>
                  {pkg.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <CardDescription>
                {pkg.code} • {pkg.ratedKw} kW • {pkg.suitableFor}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Pricing Plans */}
                <div>
                  <h4 className="font-medium mb-2">Available Plans:</h4>
                  <div className="space-y-2">
                    {pkg.plans.map((plan) => (
                      <div key={plan.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center space-x-2">
                          <Badge className={getPlanTypeColor(plan.planTypeCode)}>
                            {plan.planTypeCode}
                          </Badge>
                          <span className="text-sm">
                            {plan.planTypeCode === 'CASH' && plan.pricing.cashPrice && 
                              `TZS ${plan.pricing.cashPrice.toLocaleString()}`
                            }
                            {plan.planTypeCode === 'INSTALLMENT' && plan.pricing.defaultMonthlyAmount && 
                              `TZS ${plan.pricing.defaultMonthlyAmount.toLocaleString()}/mo`
                            }
                            {plan.planTypeCode === 'EAAS' && plan.pricing.eaasMonthlyFee && 
                              `TZS ${plan.pricing.eaasMonthlyFee.toLocaleString()}/mo`
                            }
                          </span>
                        </div>
                        <DollarSign className="h-4 w-4 text-green-600" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(pkg.id, pkg.isActive)}
                    >
                      {pkg.isActive ? (
                        <XCircle className="h-4 w-4" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEditPackage(pkg)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeletePackage(pkg.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {packages.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No packages found</p>
            <Button className="mt-4" onClick={() => setIsCreateDialogOpen(true)}>
              Create First Package
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
