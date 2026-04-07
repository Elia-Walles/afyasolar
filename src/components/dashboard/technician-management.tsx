"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Wrench, Plus, Loader2, Mail, CheckCircle2, Clock, XCircle, Search, ChevronLeft, ChevronRight, UserCheck, UserX, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { DeleteTechnicianDialog } from "./delete-technician-dialog"

interface Technician {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  yearsExperience?: number | null
  practicingLicense?: string | null
  status: 'active' | 'inactive' | 'banned'
  availabilityStatus: 'available' | 'busy' | 'offline'
  licenseVerified: boolean
  averageRating?: number | null
  totalReviews?: number | null
  createdAt: string
  user?: {
    id: string
    emailVerified: boolean
    invitationSentAt?: string | null
    invitationCount?: number | null
  }
}

function getInvitationStatus(technician: Technician): { label: string; color: string; icon: React.ReactNode } {
  if (!technician.user) {
    return {
      label: 'Not Invited',
      color: 'bg-gray-100 text-gray-700',
      icon: <Clock className="w-3 h-3" />,
    }
  }

  if (technician.user.emailVerified) {
    return {
      label: 'Registered',
      color: 'bg-green-100 text-green-700',
      icon: <CheckCircle2 className="w-3 h-3" />,
    }
  }

  return {
    label: 'Pending',
    color: 'bg-yellow-100 text-yellow-700',
    icon: <Mail className="w-3 h-3" />,
  }
}

const ITEMS_PER_PAGE = 10

export function TechnicianManagement() {
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)
  const [isInviting, setIsInviting] = useState(false)
  const [resendingUserId, setResendingUserId] = useState<string | null>(null)
  const [deletingTechnician, setDeletingTechnician] = useState<{ id: string; name: string } | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  
  // Pagination and filtering
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('all')

  const [inviteFormData, setInviteFormData] = useState({
    email: '',
  })

  const fetchTechnicians = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/technicians')
      if (response.ok) {
        const result = await response.json()
        setTechnicians(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching technicians:', error)
      toast.error('Failed to load technicians')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTechnicians()
  }, [])

  // Filter and search technicians
  const filteredTechnicians = useMemo(() => {
    return technicians.filter(technician => {
      const matchesSearch = searchQuery === '' || 
        technician.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        technician.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        technician.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (technician.phone && technician.phone.includes(searchQuery))
      
      const matchesStatus = statusFilter === 'all' || technician.status === statusFilter
      const matchesAvailability = availabilityFilter === 'all' || technician.availabilityStatus === availabilityFilter
      
      return matchesSearch && matchesStatus && matchesAvailability
    })
  }, [technicians, searchQuery, statusFilter, availabilityFilter])

  // Pagination
  const totalPages = Math.ceil(filteredTechnicians.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedTechnicians = filteredTechnicians.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  const handleInvite = async () => {
    if (!inviteFormData.email) {
      toast.error('Email is required')
      return
    }

    setIsInviting(true)
    try {
      const response = await fetch('/api/technicians/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteFormData),
      })

      const result = await response.json()

      if (!response.ok) {
        toast.error(result.error || 'Failed to send invitation')
        return
      }

      toast.success('Invitation sent successfully')
      setIsInviteDialogOpen(false)
      setInviteFormData({ email: '' })
      fetchTechnicians()
    } catch (error) {
      toast.error('Failed to send invitation')
    } finally {
      setIsInviting(false)
    }
  }

  const handleResendInvitation = async (userId: string) => {
    setResendingUserId(userId)
    try {
      const response = await fetch('/api/users/resend-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })

      const result = await response.json()

      if (!response.ok) {
        toast.error(result.error || 'Failed to resend invitation')
        return
      }

      toast.success('Invitation resent successfully')
      fetchTechnicians()
    } catch (error) {
      toast.error('Failed to resend invitation')
    } finally {
      setResendingUserId(null)
    }
  }

  const handleDeleteTechnician = (technician: Technician) => {
    const fullName = `${technician.firstName} ${technician.lastName}`
    setDeletingTechnician({ id: technician.id, name: fullName })
    setIsDeleteDialogOpen(true)
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-green-600" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="w-4 h-4 text-green-600" />
              Technician Management
            </CardTitle>
            <CardDescription className="text-xs">
              {filteredTechnicians.length} {filteredTechnicians.length === 1 ? 'technician' : 'technicians'} found
            </CardDescription>
          </div>
          <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700 text-xs h-8 px-3">
                <Plus className="w-3 h-3 mr-1.5" />
                Invite Technician
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded">
              <DialogHeader>
                <DialogTitle className="text-sm">Invite Technician</DialogTitle>
                <DialogDescription className="text-xs">
                  Enter the technician's email address. They will receive an invitation to complete registration.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="email" className="text-xs">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={inviteFormData.email}
                    onChange={(e) => setInviteFormData({ ...inviteFormData, email: e.target.value })}
                    placeholder="technician@example.com"
                    className="text-sm"
                    disabled={isInviting}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsInviteDialogOpen(false)}
                    disabled={isInviting}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleInvite}
                    disabled={isInviting || !inviteFormData.email}
                    className="bg-green-600 hover:bg-green-700 text-xs"
                  >
                    {isInviting ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="w-3 h-3 mr-1.5" />
                        Send Invitation
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-7 text-xs h-8"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="text-xs border rounded px-2 py-1 h-8"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="banned">Banned</option>
            </select>
            <select
              value={availabilityFilter}
              onChange={(e) => {
                setAvailabilityFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="text-xs border rounded px-2 py-1 h-8"
            >
              <option value="all">All Availability</option>
              <option value="available">Available</option>
              <option value="busy">Busy</option>
              <option value="offline">Offline</option>
            </select>
          </div>
        </div>

        {/* Technicians List */}
        {paginatedTechnicians.length > 0 ? (
          <div className="space-y-2">
            {paginatedTechnicians.map((technician) => {
              const invitationStatus = getInvitationStatus(technician)
              const fullName = `${technician.firstName} ${technician.lastName}`
              
              return (
                <div
                  key={technician.id}
                  className="flex items-center justify-between p-3 border rounded text-xs hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-gray-900 truncate">{fullName}</p>
                      <Badge className={invitationStatus.color} style={{ fontSize: '10px', padding: '2px 6px' }}>
                        <span className="flex items-center gap-1">
                          {invitationStatus.icon}
                          {invitationStatus.label}
                        </span>
                      </Badge>
                      <Badge
                        variant={technician.status === 'active' ? 'default' : 'secondary'}
                        style={{ fontSize: '10px', padding: '2px 6px' }}
                      >
                        {technician.status}
                      </Badge>
                      <Badge
                        variant="outline"
                        style={{ fontSize: '10px', padding: '2px 6px' }}
                      >
                        {technician.availabilityStatus}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-gray-600">
                      <span className="truncate">{technician.email}</span>
                      {technician.phone && <span>• {technician.phone}</span>}
                      {technician.yearsExperience !== null && technician.yearsExperience !== undefined && (
                        <span>• {technician.yearsExperience} years exp.</span>
                      )}
                      {technician.averageRating !== null && technician.averageRating !== undefined && (
                        <span>• ⭐ {Number(technician.averageRating).toFixed(1)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {technician.user && !technician.user.emailVerified && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResendInvitation(technician.user!.id)}
                        disabled={resendingUserId === technician.user!.id}
                        className="text-xs h-7 px-2"
                      >
                        {resendingUserId === technician.user!.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <Mail className="w-3 h-3 mr-1" />
                            Resend
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteTechnician(technician)}
                      className="text-xs h-7 px-2"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-6">
            <Wrench className="w-10 h-10 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">
              {searchQuery || statusFilter !== 'all' || availabilityFilter !== 'all'
                ? 'No technicians match your filters'
                : 'No technicians yet'}
            </p>
            {!searchQuery && statusFilter === 'all' && availabilityFilter === 'all' && (
              <Button
                onClick={() => setIsInviteDialogOpen(true)}
                className="mt-3 bg-green-600 hover:bg-green-700 text-xs h-8 px-3"
              >
                <Plus className="w-3 h-3 mr-1.5" />
                Invite First Technician
              </Button>
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <p className="text-xs text-gray-600">
              Showing {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, filteredTechnicians.length)} of {filteredTechnicians.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="text-xs h-7 px-2"
              >
                <ChevronLeft className="w-3 h-3" />
              </Button>
              <span className="text-xs text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="text-xs h-7 px-2"
              >
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      
      {/* Delete Technician Dialog */}
      {deletingTechnician && (
        <DeleteTechnicianDialog
          technicianId={deletingTechnician.id}
          technicianName={deletingTechnician.name}
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          onSuccess={() => {
            fetchTechnicians()
            setDeletingTechnician(null)
          }}
        />
      )}
    </Card>
  )
}

