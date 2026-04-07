'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  Zap, 
  Settings, 
  TrendingUp,
  BarChart3,
  FileText,
  Receipt,
  DollarSign,
  MessageSquare,
  Activity,
  Shield,
  Globe,
  UserCheck
} from 'lucide-react'

import AfyaSolarAdminDashboard from '@/components/afya-solar/admin-dashboard'
import AfyaSolarPackageManagement from '@/components/afya-solar/package-management'
import AfyaSolarServiceManagement from '@/components/afya-solar/service-management'
import AfyaSolarMeterManagement from '@/components/afya-solar/meter-management'
import AfyaSolarInvoiceRequests from '@/components/afya-solar/invoice-requests'
import AfyaSolarEnergyManagement from '@/components/afya-solar/energy-management'
import AfyaSolarFinancialAdministration from '@/components/afya-solar/financial-administration'
import AfyaSolarCustomerService from '@/components/afya-solar/customer-service'
import AfyaSolarAdvancedAnalytics from '@/components/afya-solar/advanced-analytics'
import AfyaSolarSystemAdministration from '@/components/afya-solar/system-administration'
import AfyaSolarContractManagement from '@/components/afya-solar/contract-management'
import AfyaSolarSubscribersManagement from '@/components/afya-solar/subscribers-management'

export default function AfyaSolarAdminPage() {
  const [activeTab, setActiveTab] = useState('dashboard')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Zap className="h-8 w-8 text-blue-600" />
                <h1 className="text-xl font-bold text-gray-900">Afya Solar Admin</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Solar Service Management System
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-11">
            <TabsTrigger value="dashboard" className="flex items-center space-x-2">
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="services" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Services</span>
            </TabsTrigger>
            <TabsTrigger value="packages" className="flex items-center space-x-2">
              <Package className="h-4 w-4" />
              <span>Packages</span>
            </TabsTrigger>
            <TabsTrigger value="subscribers" className="flex items-center space-x-2">
              <UserCheck className="h-4 w-4" />
              <span>Subscribers</span>
            </TabsTrigger>
            <TabsTrigger value="invoice-requests" className="flex items-center space-x-2">
              <Receipt className="h-4 w-4" />
              <span>Invoice Requests</span>
            </TabsTrigger>
            <TabsTrigger value="meters" className="flex items-center space-x-2">
              <Zap className="h-4 w-4" />
              <span>Meters</span>
            </TabsTrigger>
            <TabsTrigger value="energy" className="flex items-center space-x-2">
              <Activity className="h-4 w-4" />
              <span>Energy</span>
            </TabsTrigger>
            <TabsTrigger value="financial" className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4" />
              <span>Financial</span>
            </TabsTrigger>
            <TabsTrigger value="support" className="flex items-center space-x-2">
              <MessageSquare className="h-4 w-4" />
              <span>Support</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="contracts" className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span>Contracts</span>
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>System</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <AfyaSolarAdminDashboard />
          </TabsContent>

          <TabsContent value="services" className="space-y-6">
            <AfyaSolarServiceManagement />
          </TabsContent>

          <TabsContent value="packages" className="space-y-6">
            <AfyaSolarPackageManagement />
          </TabsContent>

          <TabsContent value="subscribers" className="space-y-6">
            <AfyaSolarSubscribersManagement />
          </TabsContent>

          <TabsContent value="invoice-requests" className="space-y-6">
            <AfyaSolarInvoiceRequests />
          </TabsContent>

          <TabsContent value="meters" className="space-y-6">
            <AfyaSolarMeterManagement />
          </TabsContent>

          <TabsContent value="energy" className="space-y-6">
            <AfyaSolarEnergyManagement />
          </TabsContent>

          <TabsContent value="financial" className="space-y-6">
            <AfyaSolarFinancialAdministration />
          </TabsContent>

          <TabsContent value="support" className="space-y-6">
            <AfyaSolarCustomerService />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <AfyaSolarAdvancedAnalytics />
          </TabsContent>

          <TabsContent value="contracts" className="space-y-6">
            <AfyaSolarContractManagement />
          </TabsContent>

          <TabsContent value="system" className="space-y-6">
            <AfyaSolarSystemAdministration />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
