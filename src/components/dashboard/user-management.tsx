"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users, Plus, Loader2, Mail, CheckCircle2, Clock, XCircle, Search, ChevronLeft, ChevronRight, Trash2, Phone } from "lucide-react"
import { toast } from "sonner"

interface User {
  id: string
  email: string
  name: string
  role: string
  facilityId?: string | null
  phone?: string | null
  emailVerified: boolean
  invitationSentAt?: string
  invitationCount?: number
  lastLoginAt?: string | null
  failedLoginAttempts?: number
  createdAt: string
  type?: 'user' | 'admin'
}

function getInvitationStatus(user: User): { label: string; color: string; icon: React.ReactNode } {
  if (user.emailVerified) {
    return {
      label: 'Verified',
      color: 'bg-green-100 text-green-700 border-green-200',
      icon: <CheckCircle2 className="w-3 h-3" />,
    }
  }
  
  if (user.invitationSentAt) {
    const sentDate = new Date(user.invitationSentAt)
    const now = new Date()
    const hoursSinceSent = (now.getTime() - sentDate.getTime()) / (1000 * 60 * 60)
    
    if (hoursSinceSent > 24) {
      return {
        label: 'Expired',
        color: 'bg-red-100 text-red-700 border-red-200',
        icon: <XCircle className="w-3 h-3" />,
      }
    }
    
    return {
      label: 'Pending',
      color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      icon: <Clock className="w-3 h-3" />,
    }
  }
  
  return {
    label: 'Not Sent',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: <Mail className="w-3 h-3" />,
  }
}

const ITEMS_PER_PAGE = 10

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)
  const [isInviting, setIsInviting] = useState(false)
  const [resendingUserId, setResendingUserId] = useState<string | null>(null)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)
  
  // Pagination and filtering
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const [inviteFormData, setInviteFormData] = useState({
    name: '',
    email: '',
  })

  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/users')
      if (response.ok) {
        const result = await response.json()
        setUsers(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('Failed to load users')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  // Filter and search users
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Search filter
      const matchesSearch = searchQuery === '' || 
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
      
      // Role filter
      const matchesRole = roleFilter === 'all' || user.role === roleFilter
      
      // Status filter
      let matchesStatus = true
      if (statusFilter === 'verified') {
        matchesStatus = user.emailVerified === true
      } else if (statusFilter === 'pending') {
        matchesStatus = !user.emailVerified && !!user.invitationSentAt
      } else if (statusFilter === 'expired') {
        if (user.invitationSentAt) {
          const sentDate = new Date(user.invitationSentAt)
          const hoursSinceSent = (Date.now() - sentDate.getTime()) / (1000 * 60 * 60)
          matchesStatus = !user.emailVerified && hoursSinceSent > 24
        } else {
          matchesStatus = false
        }
      }
      
      return matchesSearch && matchesRole && matchesStatus
    })
  }, [users, searchQuery, roleFilter, statusFilter])

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, roleFilter, statusFilter])

  const handleInviteAdmin = async () => {
    if (!inviteFormData.name || !inviteFormData.email) {
      toast.error('Fill all fields')
      return
    }

    setIsInviting(true)
    try {
      const response = await fetch('/api/users/invite-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteFormData),
      })

      const result = await response.json()

      if (!response.ok) {
        toast.error(result.error || 'Failed')
        return
      }

      toast.success('Invitation sent')
      setIsInviteDialogOpen(false)
      setInviteFormData({ name: '', email: '' })
      fetchUsers()
    } catch (error) {
      toast.error('Error occurred')
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
        toast.error(result.error || 'Failed')
        return
      }

      toast.success('Invitation resent')
      fetchUsers()
    } catch (error) {
      toast.error('Error occurred')
    } finally {
      setResendingUserId(null)
    }
  }

  const confirmDelete = async () => {
    if (!userToDelete) return
    setDeleting(true)
    try {
      const params = new URLSearchParams({
        userId: userToDelete.id,
        type: userToDelete.type === 'admin' ? 'admin' : 'user',
      })
      const response = await fetch(`/api/users?${params.toString()}`, { method: 'DELETE' })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete user')
      }
      toast.success('User deleted successfully')
      setUserToDelete(null)
      fetchUsers()
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete user')
    } finally {
      setDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-green-600" />
            <p className="text-sm text-gray-600">Loading...</p>
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
              <Users className="w-4 h-4 text-green-600" />
              User Management
            </CardTitle>
            <CardDescription className="text-xs">
              {filteredUsers.length} {filteredUsers.length === 1 ? 'user or admin' : 'users and admins'} found
            </CardDescription>
          </div>
          <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700 text-xs h-8 px-3">
                <Plus className="w-3 h-3 mr-1.5" />
                Add Admin
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded">
              <DialogHeader>
                <DialogTitle className="text-sm">Invite Admin</DialogTitle>
                <DialogDescription className="text-xs">
                  Enter name and email to send invitation
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-3">
                <div>
                  <Label htmlFor="invite-name" className="text-xs">Name</Label>
                  <Input
                    id="invite-name"
                    value={inviteFormData.name}
                    onChange={(e) => setInviteFormData({ ...inviteFormData, name: e.target.value })}
                    placeholder="John Doe"
                    className="text-sm h-8"
                  />
                </div>
                <div>
                  <Label htmlFor="invite-email" className="text-xs">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteFormData.email}
                    onChange={(e) => setInviteFormData({ ...inviteFormData, email: e.target.value })}
                    placeholder="admin@example.com"
                    className="text-sm h-8"
                  />
                </div>
                <Button 
                  onClick={handleInviteAdmin} 
                  disabled={isInviting} 
                  className="w-full bg-green-600 hover:bg-green-700 text-xs h-8"
                >
                  {isInviting ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Invitation'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {/* Delete confirmation */}
        <Dialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
          <DialogContent className="rounded">
            <DialogHeader>
              <DialogTitle className="text-sm">Delete user</DialogTitle>
              <DialogDescription className="text-xs">
                This will permanently remove <span className="font-medium">{userToDelete?.name}</span> ({userToDelete?.email}).
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setUserToDelete(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button className="bg-red-600 hover:bg-red-700" onClick={confirmDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Search and Filters */}
        <div className="space-y-3 mb-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-sm h-8 w-full"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="text-xs h-8 w-full sm:w-[140px]">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="facility">Facility</SelectItem>
                <SelectItem value="technician">Technician</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="text-xs h-8 w-full sm:w-[140px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* User List */}
        {paginatedUsers.length > 0 ? (
          <>
            <div className="space-y-2">
              {paginatedUsers.map((user) => {
                const status = getInvitationStatus(user)
                return (
                  <div
                    key={user.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border rounded bg-white gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-medium text-sm truncate">{user.name}</h3>
                        {user.type === 'admin' && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0 bg-purple-50 text-purple-700 border-purple-200 flex-shrink-0">
                            Admin
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs px-1.5 py-0 flex-shrink-0">{user.role}</Badge>
                        <Badge className={`text-xs px-1.5 py-0 border flex-shrink-0 ${status.color}`}>
                          <span className="flex items-center gap-1">
                            {status.icon}
                            {status.label}
                          </span>
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 break-words">{user.email}</p>
                      {user.phone && (
                        <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {user.phone}
                        </p>
                      )}
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Last login: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : '—'} · Failed attempts: {user.failedLoginAttempts ?? 0}
                      </p>
                      {user.invitationSentAt && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Sent: {new Date(user.invitationSentAt).toLocaleDateString()}
                          {user.invitationCount && user.invitationCount > 1 && ` (${user.invitationCount}x)`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      {!user.emailVerified && (user.role === 'admin' || user.type === 'admin') && (
                        <Button
                          onClick={() => handleResendInvitation(user.id)}
                          disabled={resendingUserId === user.id || (user.invitationCount || 0) >= 3}
                          className="text-xs h-7 px-2 bg-green-600 hover:bg-green-700 flex-shrink-0 w-full sm:w-auto"
                        >
                          {resendingUserId === user.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            'Resend'
                          )}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        className="text-xs h-7 px-2 text-red-700 border-red-200 hover:bg-red-50 flex-shrink-0 w-full sm:w-auto"
                        onClick={() => setUserToDelete(user)}
                      >
                        <Trash2 className="w-3 h-3 mr-1.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-xs text-gray-600">
                  Showing {startIndex + 1}-{Math.min(endIndex, filteredUsers.length)} of {filteredUsers.length}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="text-xs h-7 px-2"
                  >
                    <ChevronLeft className="w-3 h-3 mr-1" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className={`text-xs h-7 w-7 p-0 ${
                            currentPage === pageNum ? 'bg-green-600 hover:bg-green-700' : ''
                          }`}
                        >
                          {pageNum}
                        </Button>
                      )
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="text-xs h-7 px-2"
                  >
                    Next
                    <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-6">
            <Users className="w-10 h-10 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">
              {searchQuery || roleFilter !== 'all' || statusFilter !== 'all' 
                ? 'No users match your filters' 
                : 'No users found'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
