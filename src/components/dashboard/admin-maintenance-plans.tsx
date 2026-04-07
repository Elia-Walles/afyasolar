"use client"

import { useMemo, useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { 
  FacilityPlan,
  MaintenancePlan,
  PlanVisit,
  useCreateFacilityPlan,
  useCreateMaintenancePlan,
  useFacilityMaintenancePlans,
  useMaintenancePlanCatalog,
  usePlanVisits,
  useSchedulePlanVisit,
  useUpdateFacilityPlan,
  useUpdateMaintenancePlan,
  useUpdatePlanVisit,
} from "@/hooks/use-maintenance-plans"
import { useFacilities } from "@/hooks/use-facilities"
import { format } from "date-fns"
import { Loader2, PlusCircle, RefreshCcw } from "lucide-react"
import { cn } from "@/lib/utils"

const defaultPlanForm = {
  name: "",
  tier: "standard" as MaintenancePlan["tier"],
  monthlyPrice: "",
  visitsPerYear: "",
  responseTimeHours: "",
  coverage: "",
}

const defaultVisitForm = {
  facilityPlanId: "",
  visitType: "preventive" as PlanVisit["visitType"],
  scheduledDate: "",
  technicianId: "",
  summary: "",
}

export function AdminMaintenancePlansPanel() {
  const { data: plans = [], isLoading: plansLoading } = useMaintenancePlanCatalog({ includeInactive: true })
  const { data: facilities = [] } = useFacilities()
  const [facilityFilter, setFacilityFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "active" | "suspended">("pending")
  const facilityPlansQuery = useFacilityMaintenancePlans({
    facilityId: facilityFilter === "all" ? null : facilityFilter,
    status: statusFilter === "all" ? null : statusFilter,
    enabled: true,
    refetchIntervalMs: 10000,
  })
  const facilityPlans = facilityPlansQuery.data || []
  const enrollmentsLoading = facilityPlansQuery.isLoading
  const { data: planVisits = [] } = usePlanVisits()

  const createPlanMutation = useCreateMaintenancePlan()
  const updatePlanMutation = useUpdateMaintenancePlan()
  const updateFacilityPlan = useUpdateFacilityPlan()
  const scheduleVisitMutation = useSchedulePlanVisit()
  const updateVisitMutation = useUpdatePlanVisit()

  const [planForm, setPlanForm] = useState(defaultPlanForm)
  const [visitForm, setVisitForm] = useState(defaultVisitForm)
  const [technicians, setTechnicians] = useState<Array<{ id: string; firstName: string; lastName: string }>>([])
  const [loadingTechnicians, setLoadingTechnicians] = useState(false)

  useEffect(() => {
    let ignore = false
    const fetchTechnicians = async () => {
      try {
        setLoadingTechnicians(true)
        const response = await fetch("/api/technicians")
        if (!response.ok) return
        const json = await response.json()
        if (!ignore) {
          setTechnicians(json.data || [])
        }
      } catch (error) {
        console.error("Failed to fetch technicians", error)
      } finally {
        setLoadingTechnicians(false)
      }
    }
    fetchTechnicians()
    return () => {
      ignore = true
    }
  }, [])

  const activeFacilityPlans = useMemo(
    () => facilityPlans.filter((plan) => plan.facilityPlanStatus === "active" || plan.facilityPlanStatus === "pending"),
    [facilityPlans]
  )

  const handleCreatePlan = async (event: React.FormEvent) => {
    event.preventDefault()
    createPlanMutation.mutate({
      name: planForm.name,
      tier: planForm.tier,
      monthlyPrice: Number(planForm.monthlyPrice || 0),
      visitsPerYear: planForm.visitsPerYear ? Number(planForm.visitsPerYear) : undefined,
      responseTimeHours: planForm.responseTimeHours ? Number(planForm.responseTimeHours) : undefined,
      coverage: planForm.coverage
        ? planForm.coverage
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
        : undefined,
    }, {
      onSuccess: () => setPlanForm(defaultPlanForm),
    })
  }

  const handleScheduleVisit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!visitForm.facilityPlanId || !visitForm.scheduledDate) return
    scheduleVisitMutation.mutate(
      {
        facilityPlanId: visitForm.facilityPlanId,
        visitType: visitForm.visitType,
        scheduledDate: new Date(visitForm.scheduledDate).toISOString(),
        technicianId: visitForm.technicianId || undefined,
        summary: visitForm.summary || undefined,
      },
      {
        onSuccess: () => setVisitForm(defaultVisitForm),
      },
    )
  }

  const renderPlanStatusBadge = (status: MaintenancePlan["maintenancePlanStatus"]) => {
    const color =
      status === "active"
        ? "bg-green-100 text-green-700 border-green-200"
        : "bg-gray-100 text-gray-700 border-gray-200"
    return <Badge className={cn("text-xs", color)}>{status}</Badge>
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Maintenance Plan Catalog</CardTitle>
          <CardDescription className="text-xs">
            Configure coverage tiers that facilities can subscribe to
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            {plansLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading plans...
              </div>
            ) : plans.length > 0 ? (
              plans.map((plan) => (
                <div key={plan.id} className="border rounded-lg p-3 bg-white shadow-sm space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">{plan.name}</p>
                      <p className="text-xs text-gray-500 capitalize">{plan.tier} tier</p>
                    </div>
                    {renderPlanStatusBadge(plan.maintenancePlanStatus)}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <span>Monthly: <strong>{plan.currency || "TZS"} {Number(plan.monthlyPrice).toLocaleString()}</strong></span>
                    {plan.visitsPerYear && (
                      <span>Visits/year: <strong>{plan.visitsPerYear}</strong></span>
                    )}
                    {plan.responseTimeHours && (
                      <span>Response: <strong>{plan.responseTimeHours}h</strong></span>
                    )}
                  </div>
                  {plan.coverage && plan.coverage.length > 0 && (
                    <ul className="text-xs text-gray-600 list-disc pl-4 space-y-1">
                      {plan.coverage.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 px-2"
                      disabled={updatePlanMutation.isPending}
                      onClick={() =>
                        updatePlanMutation.mutate({
                          planId: plan.id,
                          maintenancePlanStatus: plan.maintenancePlanStatus === "active" ? "inactive" : "active",
                        })
                      }
                    >
                      {plan.maintenancePlanStatus === "active" ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No plans configured yet.</p>
            )}
          </div>

          <form className="space-y-3 border rounded-lg p-4 bg-gray-50" onSubmit={handleCreatePlan}>
            <div>
              <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Create new plan</p>
              <Input
                placeholder="Plan name"
                value={planForm.name}
                onChange={(e) => setPlanForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={planForm.tier}
                onValueChange={(value) => setPlanForm((prev) => ({ ...prev, tier: value as MaintenancePlan["tier"] }))}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Monthly price"
                type="number"
                value={planForm.monthlyPrice}
                onChange={(e) => setPlanForm((prev) => ({ ...prev, monthlyPrice: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Visits per year"
                type="number"
                value={planForm.visitsPerYear}
                onChange={(e) => setPlanForm((prev) => ({ ...prev, visitsPerYear: e.target.value }))}
              />
              <Input
                placeholder="Response time (hrs)"
                type="number"
                value={planForm.responseTimeHours}
                onChange={(e) => setPlanForm((prev) => ({ ...prev, responseTimeHours: e.target.value }))}
              />
            </div>
            <Textarea
              placeholder="Coverage details (one per line)"
              value={planForm.coverage}
              className="text-sm"
              onChange={(e) => setPlanForm((prev) => ({ ...prev, coverage: e.target.value }))}
            />
            <Button
              type="submit"
              size="sm"
              className="text-xs"
              disabled={createPlanMutation.isPending}
            >
              {createPlanMutation.isPending && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
              Add Plan
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-base">Facility Plan Enrollments</CardTitle>
            <CardDescription className="text-xs">
              Approve, activate, or suspend plan coverage. Defaults to pending requests for quicker loading.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <p>Facility:</p>
              <Select value={facilityFilter} onValueChange={setFacilityFilter}>
                <SelectTrigger className="h-8 w-40">
                  <SelectValue placeholder="All facilities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All facilities</SelectItem>
                  {facilities?.map((facility) => (
                    <SelectItem key={facility.id} value={facility.id}>
                      {facility.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <p>Status:</p>
              <Select value={statusFilter} onValueChange={(value: "all" | "pending" | "active" | "suspended") => setStatusFilter(value)}>
                <SelectTrigger className="h-8 w-36">
                  <SelectValue placeholder="Pending" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="all">All statuses</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {facilityPlans.length > 0 && (
            <div className="text-xs text-gray-600 flex flex-wrap gap-4">
              <p>
                Pending requests:{" "}
                <span className="font-semibold text-gray-900">
                  {facilityPlans.filter((plan) => plan.facilityPlanStatus === "pending").length}
                </span>
              </p>
              <p>
                Active plans:{" "}
                <span className="font-semibold text-gray-900">
                  {facilityPlans.filter((plan) => plan.facilityPlanStatus === "active").length}
                </span>
              </p>
            </div>
          )}
          {enrollmentsLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading enrollments...
            </div>
          ) : facilityPlans.length === 0 ? (
            <p className="text-sm text-gray-500">No facility subscriptions yet.</p>
          ) : (
            facilityPlans.map((enrollment) => (
              <div
                key={enrollment.id}
                className="border rounded-lg p-3 bg-white text-sm flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-semibold text-gray-900">
                    {enrollment.facility?.name || "Facility"} • {enrollment.plan?.name || "Plan"}
                  </p>
                  <p className="text-xs text-gray-500">
                    Status: <span className="capitalize">{enrollment.facilityPlanStatus}</span> • Started{" "}
                    {format(new Date(enrollment.startDate), "dd MMM yyyy")}
                  </p>
                </div>
                <div className="flex gap-2">
                  {enrollment.facilityPlanStatus === "pending" && (
                    <Button
                      size="sm"
                      className="text-xs h-7 px-3"
                      disabled={updateFacilityPlan.isPending}
                      onClick={() =>
                        updateFacilityPlan.mutate({
                          facilityPlanId: enrollment.id,
                          facilityPlanStatus: "active",
                          startDate: new Date().toISOString(),
                        })
                      }
                    >
                      Approve
                    </Button>
                  )}
                  {enrollment.facilityPlanStatus === "active" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 px-3"
                      disabled={updateFacilityPlan.isPending}
                      onClick={() =>
                        updateFacilityPlan.mutate({
                          facilityPlanId: enrollment.id,
                          facilityPlanStatus: "suspended",
                        })
                      }
                    >
                      Suspend
                    </Button>
                  )}
                  {enrollment.facilityPlanStatus !== "cancelled" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7 px-3 text-red-600"
                      disabled={updateFacilityPlan.isPending}
                      onClick={() =>
                        updateFacilityPlan.mutate({
                          facilityPlanId: enrollment.id,
                          facilityPlanStatus: "cancelled",
                        })
                      }
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Planned Visits</CardTitle>
          <CardDescription className="text-xs">Schedule and track preventive visits tied to plans</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="grid gap-3 md:grid-cols-2" onSubmit={handleScheduleVisit}>
            <Select
              value={visitForm.facilityPlanId}
              onValueChange={(value) => setVisitForm((prev) => ({ ...prev, facilityPlanId: value }))}
            >
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Select facility plan" />
              </SelectTrigger>
              <SelectContent>
                {activeFacilityPlans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.facility?.name || "Facility"} • {plan.plan?.name || "Plan"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={visitForm.visitType}
              onValueChange={(value) => setVisitForm((prev) => ({ ...prev, visitType: value as PlanVisit["visitType"] }))}
            >
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Visit type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="preventive">Preventive</SelectItem>
                <SelectItem value="inspection">Inspection</SelectItem>
                <SelectItem value="training">Training</SelectItem>
                <SelectItem value="audit">Audit</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="datetime-local"
              value={visitForm.scheduledDate}
              onChange={(e) => setVisitForm((prev) => ({ ...prev, scheduledDate: e.target.value }))}
            />
            <div className="space-y-1">
              <p className="text-xs text-gray-500">Assign technician</p>
              <Select
                value={visitForm.technicianId || "unassigned"}
                onValueChange={(value) =>
                  setVisitForm((prev) => ({ ...prev, technicianId: value === "unassigned" ? "" : value }))
                }
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Assign technician" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">
                    {loadingTechnicians ? "Loading..." : "Auto assign later"}
                  </SelectItem>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.firstName} {tech.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              className="md:col-span-2"
              placeholder="Summary / focus areas"
              value={visitForm.summary}
              onChange={(e) => setVisitForm((prev) => ({ ...prev, summary: e.target.value }))}
            />
            <div className="md:col-span-2 flex justify-end">
              <Button
                type="submit"
                size="sm"
                className="text-xs flex items-center gap-2"
                disabled={scheduleVisitMutation.isPending}
              >
                {scheduleVisitMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlusCircle className="h-3 w-3" />}
                Schedule Visit
              </Button>
            </div>
          </form>

          <div className="space-y-2">
            {planVisits.slice(0, 5).map((visit) => (
                        <div
                key={visit.id}
                className="border rounded-lg p-3 bg-white text-sm flex flex-col gap-1 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-semibold text-gray-900">
                    {visit.facility?.name || "Facility"} • {visit.plan?.name || "Plan"}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {visit.visitType} • {format(new Date(visit.scheduledDate), "dd MMM yyyy, HH:mm")}
                  </p>
                </div>
                          <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="text-xs capitalize">
                    {visit.visitStatus.replace("_", " ")}
                  </Badge>
                            <Select
                              value={visit.technician?.id || "unassigned"}
                              onValueChange={(value) =>
                                updateVisitMutation.mutate({
                                  visitId: visit.id,
                                  technicianId: value === "unassigned" ? undefined : value,
                                })
                              }
                            >
                              <SelectTrigger className="text-xs h-7 px-2 w-32">
                                <SelectValue placeholder="Assign tech" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                {technicians.map((tech) => (
                                  <SelectItem key={tech.id} value={tech.id}>
                                    {tech.firstName} {tech.lastName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                  {visit.visitStatus !== "completed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 px-2"
                      disabled={updateVisitMutation.isPending}
                      onClick={() =>
                        updateVisitMutation.mutate({
                          visitId: visit.id,
                          visitStatus: "completed",
                          completedDate: new Date().toISOString(),
                        })
                      }
                    >
                      <RefreshCcw className="h-3 w-3 mr-1.5" />
                      Mark done
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {planVisits.length === 0 && (
              <p className="text-sm text-gray-500">No visits scheduled yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


