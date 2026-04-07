'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Package, DollarSign, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ManagementPanelPageSkeleton,
  ManagementPanelErrorState,
} from '@/components/management-panel/management-panel-loading'

/** Same shape as admin package management /api/afya-solar/packages */
interface SolarPackagePlan {
  id: number
  planTypeCode: string
  currency: string
  isActive?: boolean
  pricing: {
    cashPrice?: number
    installmentDurationMonths?: number
    defaultMonthlyAmount?: number
    eaasMonthlyFee?: number
    [key: string]: unknown
  } | null
}

interface SolarPackage {
  id: number
  code: string
  name: string
  ratedKw: number
  suitableFor: string
  isActive: boolean
  createdAt?: string
  updatedAt?: string
  specs?: unknown
  plans: SolarPackagePlan[]
}

function getPackageName(ratedKw: number, originalName: string): string {
  switch (Number(ratedKw)) {
    case 10:
      return 'Ultra'
    case 6:
      return 'Pro'
    case 4.2:
      return 'Plus'
    case 2:
      return 'Essential'
    default:
      return originalName || 'Solar Package'
  }
}

function getPlanTypeColor(planTypeCode: string): string {
  switch (planTypeCode) {
    case 'CASH':
      return 'bg-green-100 text-green-800'
    case 'INSTALLMENT':
      return 'bg-blue-100 text-blue-800'
    case 'EAAS':
      return 'bg-purple-100 text-purple-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export function ManagementPanelPackages() {
  const [packages, setPackages] = useState<SolarPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPackages = async () => {
    try {
      setError(null)
      setRefreshing(true)
      const response = await fetch('/api/afya-solar/packages')
      if (!response.ok) throw new Error('Failed to fetch packages')
      const data = await response.json()
      const payload = data?.data
      const list: SolarPackage[] = Array.isArray(payload?.packages)
        ? payload.packages
        : Array.isArray(payload)
          ? payload
          : Array.isArray(data)
            ? data
            : []
      setPackages(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load packages')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchPackages()
  }, [])

  if (loading) {
    return <ManagementPanelPageSkeleton titleWidth="w-48" rows={4} />
  }

  if (error) {
    return (
      <ManagementPanelErrorState
        title="Unable to load packages"
        message={error}
        onRetry={fetchPackages}
      />
    )
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 animate-in fade-in duration-300">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Package Management</h1>
          <p className="text-sm text-gray-500 mt-1">Solar package offerings and pricing (read-only)</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchPackages}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {packages.length === 0 ? (
        <Card className="rounded-xl border shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
          <CardContent className="text-center py-12">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No packages found</p>
            <p className="text-sm text-gray-500 mt-1">Packages are managed in the main admin panel.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {packages.map((pkg) => (
            <Card
              key={pkg.id}
              className={cn('rounded-xl border shadow-sm', !pkg.isActive && 'opacity-60')}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-emerald-600" />
                    <CardTitle className="text-lg">
                      {getPackageName(Number(pkg.ratedKw), pkg.name)}
                    </CardTitle>
                  </div>
                  <Badge variant={pkg.isActive ? 'default' : 'secondary'}>
                    {pkg.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <CardDescription>
                  {pkg.code} · {pkg.ratedKw} kW · {pkg.suitableFor || '—'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2">Available plans</h4>
                    <div className="space-y-2">
                      {(pkg.plans || []).map((plan) => (
                        <div
                          key={plan.id}
                          className="flex items-center justify-between p-2 rounded-lg border border-gray-100 bg-gray-50/50"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={cn('shrink-0', getPlanTypeColor(plan.planTypeCode))}>
                              {plan.planTypeCode}
                            </Badge>
                            <span className="text-sm text-gray-700">
                              {plan.planTypeCode === 'CASH' && plan.pricing?.cashPrice != null &&
                                `TZS ${Number(plan.pricing.cashPrice).toLocaleString()}`}
                              {plan.planTypeCode === 'INSTALLMENT' && plan.pricing?.defaultMonthlyAmount != null &&
                                `TZS ${Number(plan.pricing.defaultMonthlyAmount).toLocaleString()}/mo`}
                              {plan.planTypeCode === 'EAAS' && plan.pricing?.eaasMonthlyFee != null &&
                                `TZS ${Number(plan.pricing.eaasMonthlyFee).toLocaleString()}/mo`}
                              {!plan.pricing && '—'}
                            </span>
                          </div>
                          <DollarSign className="h-4 w-4 text-emerald-600 shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
