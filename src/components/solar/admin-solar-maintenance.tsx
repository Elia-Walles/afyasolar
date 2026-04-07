import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Wrench, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Search,
  Filter,
  Download,
  Plus,
  Eye,
  Edit,
  MapPin,
  User,
  Zap,
  Settings,
  RefreshCw,
  AlertCircle
} from 'lucide-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { format, addDays, addWeeks, addMonths } from 'date-fns'

interface MaintenanceTask {
  id: string
  deviceId: string
  deviceSerial: string
  facilityId: string
  facilityName: string
  type: 'routine' | 'corrective' | 'predictive' | 'emergency'
  priority: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled'
  scheduledDate: string
  estimatedDuration: number
  assignedTo?: string
  technicianName?: string
  completedDate?: string
  nextMaintenanceDate?: string
  cost?: number
  parts?: string[]
  notes?: string
  metadata: {
    operatingHours?: number
    lastMaintenance?: string
    efficiency?: number
    alerts?: number
  }
}

export function AdminSolarMaintenance() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  // Mock maintenance data
  const { data: maintenanceTasks = [], isLoading, refetch } = useQuery({
    queryKey: ['solar-maintenance', statusFilter, priorityFilter],
    queryFn: async (): Promise<MaintenanceTask[]> => {
      await new Promise(resolve => setTimeout(resolve, 1000))
      return [
        {
          id: '1',
          deviceId: 'device-1',
          deviceSerial: 'SN-001-AFYA',
          facilityId: 'fac-1',
          facilityName: 'Kigali Central Hospital',
          type: 'routine',
          priority: 'medium',
          title: 'Quarterly System Inspection',
          description: 'Perform routine inspection and cleaning of solar panels and inverter',
          status: 'scheduled',
          scheduledDate: addDays(new Date(), 7).toISOString(),
          estimatedDuration: 4,
          assignedTo: 'tech-1',
          technicianName: 'John Technician',
          cost: 250,
          parts: ['Cleaning kit', 'Fuses'],
          metadata: {
            operatingHours: 8760,
            lastMaintenance: '2024-01-15',
            efficiency: 94.5
          }
        },
        {
          id: '2',
          deviceId: 'device-2',
          deviceSerial: 'SN-002-AFYA',
          facilityId: 'fac-2',
          facilityName: 'Muhanga Health Center',
          type: 'corrective',
          priority: 'high',
          title: 'Inverter Replacement',
          description: 'Replace faulty inverter due to intermittent power output',
          status: 'in-progress',
          scheduledDate: new Date().toISOString(),
          estimatedDuration: 6,
          assignedTo: 'tech-2',
          technicianName: 'Sarah Specialist',
          cost: 1200,
          parts: ['Inverter unit', 'Cabling'],
          metadata: {
            operatingHours: 6520,
            lastMaintenance: '2024-02-20',
            efficiency: 78.2,
            alerts: 3
          }
        },
        {
          id: '3',
          deviceId: 'device-3',
          deviceSerial: 'SN-003-AFYA',
          facilityId: 'fac-3',
          facilityName: 'Rubavu Dispensary',
          type: 'predictive',
          priority: 'low',
          title: 'Battery Health Check',
          description: 'Predictive maintenance based on battery performance degradation',
          status: 'scheduled',
          scheduledDate: addWeeks(new Date(), 2).toISOString(),
          estimatedDuration: 2,
          assignedTo: 'tech-3',
          technicianName: 'Mike Expert',
          cost: 150,
          parts: ['Battery tester'],
          metadata: {
            operatingHours: 4320,
            lastMaintenance: '2024-03-10',
            efficiency: 91.8
          }
        },
        {
          id: '4',
          deviceId: 'device-4',
          deviceSerial: 'SN-004-AFYA',
          facilityId: 'fac-1',
          facilityName: 'Kigali Central Hospital',
          type: 'emergency',
          priority: 'critical',
          title: 'System Offline - Immediate Response',
          description: 'System completely offline, requires immediate attention',
          status: 'completed',
          scheduledDate: new Date(Date.now() - 2 * 3600000).toISOString(),
          estimatedDuration: 3,
          assignedTo: 'tech-1',
          technicianName: 'John Technician',
          completedDate: new Date(Date.now() - 1 * 3600000).toISOString(),
          cost: 800,
          parts: ['Communication module', 'Fuses'],
          metadata: {
            operatingHours: 9200,
            lastMaintenance: new Date(Date.now() - 1 * 3600000).toISOString(),
            efficiency: 95.1,
            alerts: 5
          }
        }
      ]
    },
    refetchInterval: 30000,
  })

  const filteredTasks = maintenanceTasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.deviceSerial.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.facilityName.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter
    const matchesType = typeFilter === 'all' || task.type === typeFilter
    
    return matchesSearch && matchesStatus && matchesPriority && matchesType
  })

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'destructive'
      case 'high': return 'destructive'
      case 'medium': return 'secondary'
      case 'low': return 'outline'
      default: return 'secondary'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'default'
      case 'in-progress': return 'secondary'
      case 'completed': return 'default'
      case 'cancelled': return 'outline'
      default: return 'secondary'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'routine': return <Clock className="h-4 w-4" />
      case 'corrective': return <Wrench className="h-4 w-4" />
      case 'predictive': return <AlertTriangle className="h-4 w-4" />
      case 'emergency': return <AlertCircle className="h-4 w-4" />
      default: return <Wrench className="h-4 w-4" />
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return <Calendar className="h-4 w-4" />
      case 'in-progress': return <RefreshCw className="h-4 w-4 animate-spin" />
      case 'completed': return <CheckCircle className="h-4 w-4" />
      case 'cancelled': return <AlertCircle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const stats = {
    total: maintenanceTasks.length,
    scheduled: maintenanceTasks.filter(t => t.status === 'scheduled').length,
    inProgress: maintenanceTasks.filter(t => t.status === 'in-progress').length,
    completed: maintenanceTasks.filter(t => t.status === 'completed').length,
    critical: maintenanceTasks.filter(t => t.priority === 'critical' && t.status !== 'completed').length,
    totalCost: maintenanceTasks.reduce((sum, t) => sum + (t.cost || 0), 0)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading maintenance schedule...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Solar Maintenance Schedule</h2>
          <p className="text-muted-foreground">
            Scheduled maintenance, predictive alerts, and service history
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Schedule Maintenance
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Schedule
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Tasks</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Wrench className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Scheduled</p>
                <p className="text-2xl font-bold text-blue-600">{stats.scheduled}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold text-orange-600">{stats.inProgress}</p>
              </div>
              <RefreshCw className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Critical Tasks</p>
                <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Maintenance Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="routine">Routine</SelectItem>
                <SelectItem value="corrective">Corrective</SelectItem>
                <SelectItem value="predictive">Predictive</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Maintenance Tasks List */}
      <Card>
        <CardHeader>
          <CardTitle>Maintenance Tasks ({filteredTasks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredTasks.map((task) => (
              <div key={task.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      {getTypeIcon(task.type)}
                      {getStatusIcon(task.status)}
                      <div className="flex-1">
                        <h3 className="font-semibold">{task.title}</h3>
                        <p className="text-sm text-muted-foreground">{task.description}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={getPriorityColor(task.priority)}>
                          {task.priority}
                        </Badge>
                        <Badge variant={getStatusColor(task.status)}>
                          {task.status}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Device</p>
                        <p className="text-sm font-medium">{task.deviceSerial}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Facility</p>
                        <p className="text-sm font-medium">{task.facilityName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Scheduled</p>
                        <p className="text-sm font-medium">{format(new Date(task.scheduledDate), 'MMM dd, yyyy')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Duration</p>
                        <p className="text-sm font-medium">{task.estimatedDuration} hours</p>
                      </div>
                    </div>

                    {/* Task Details */}
                    <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>{task.technicianName || 'Unassigned'}</span>
                        </div>
                        {task.cost && (
                          <div className="flex items-center gap-1">
                            <span>Cost: ${task.cost}</span>
                          </div>
                        )}
                        {task.metadata.operatingHours && (
                          <div className="flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            <span>{task.metadata.operatingHours}h runtime</span>
                          </div>
                        )}
                        {task.metadata.efficiency && (
                          <div className="flex items-center gap-1">
                            <span>Efficiency: {task.metadata.efficiency}%</span>
                          </div>
                        )}
                      </div>
                      {task.parts && task.parts.length > 0 && (
                        <div className="mt-2">
                          <span className="text-xs text-muted-foreground">Parts: </span>
                          {task.parts.join(', ')}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t">
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        {task.completedDate && (
                          <span>Completed: {format(new Date(task.completedDate), 'MMM dd, HH:mm')}</span>
                        )}
                        {task.metadata.alerts && task.metadata.alerts > 0 && (
                          <span className="text-red-600">{task.metadata.alerts} related alerts</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          View Details
                        </Button>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {filteredTasks.length === 0 && (
            <div className="text-center py-8">
              <Wrench className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No maintenance tasks found</h3>
              <p className="text-gray-500">Try adjusting your search or filter criteria</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default AdminSolarMaintenance
