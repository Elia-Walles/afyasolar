import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useEffect, type Dispatch, type SetStateAction } from "react"

type ServiceName = "afya-solar"

const ALL_SERVICES: { id: ServiceName; label: string }[] = [
  { id: "afya-solar", label: "Afya Solar" },
]

interface Props {
  selectedFacilityId: string
  loadingVisibility: boolean
  savingVisibility: boolean
  visibleServices: ServiceName[]
  setLoadingVisibility: Dispatch<SetStateAction<boolean>>
  setSavingVisibility: Dispatch<SetStateAction<boolean>>
  setVisibleServices: Dispatch<SetStateAction<ServiceName[]>>
}

export function ServiceVisibilityPanel({
  selectedFacilityId,
  loadingVisibility,
  savingVisibility,
  visibleServices,
  setLoadingVisibility,
  setSavingVisibility,
  setVisibleServices,
}: Props) {
  useEffect(() => {
    const loadVisibility = async () => {
      if (!selectedFacilityId) return
      try {
        setLoadingVisibility(true)
        const res = await fetch(`/api/admin/facilities/${selectedFacilityId}/service-visibility`)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          if (res.status === 404) {
            toast.error("This facility could not be found. Refresh the Facilities list and select a valid facility.")
            return
          }
          throw new Error(data.error || "Failed to load visibility settings")
        }
        const data: { data?: { visibleServices: ServiceName[] } } = await res.json()
        if (data?.data?.visibleServices) {
          setVisibleServices(data.data.visibleServices)
        } else {
          setVisibleServices(ALL_SERVICES.map((s) => s.id))
        }
      } catch (error: unknown) {
        console.error("Error loading service visibility:", error)
        toast.error(error instanceof Error ? error.message : "Failed to load visibility settings.")
      } finally {
        setLoadingVisibility(false)
      }
    }

    loadVisibility()
  }, [selectedFacilityId, setLoadingVisibility, setVisibleServices])

  const handleToggleService = (serviceId: ServiceName, checked: boolean | "indeterminate") => {
    const enabled = checked === true
    setVisibleServices((prev) => {
      const set = new Set(prev)
      if (enabled) {
        set.add(serviceId)
      } else {
        set.delete(serviceId)
      }
      return Array.from(set) as ServiceName[]
    })
  }

  const handleSave = async () => {
    if (!selectedFacilityId) {
      toast.error("Select a facility first.")
      return
    }
    if (visibleServices.length === 0) {
      toast.error("Select at least one service to show.")
      return
    }
    try {
      setSavingVisibility(true)
      const res = await fetch(`/api/admin/facilities/${selectedFacilityId}/service-visibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visibleServices,
          defaultService: "afya-solar",
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))

        if (res.status === 404) {
          toast.error("This facility could not be found. Refresh the Facilities list and select a valid facility.")
          return
        }

        throw new Error(data.error || "Failed to save visibility settings")
      }
      toast.success("Service visibility updated for facility.")
    } catch (error: unknown) {
      console.error("Error saving service visibility:", error)
      toast.error(error instanceof Error ? error.message : "Failed to save visibility settings.")
    } finally {
      setSavingVisibility(false)
    }
  }

  return (
    <Card className="border-emerald-100 bg-white/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Afya Solar access</CardTitle>
        <CardDescription>
          This app is Afya Solar only. Control whether this facility can access the solar dashboard; after login, users
          always land on Afya Solar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Card className="border-emerald-100 bg-emerald-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Visible product</CardTitle>
            <CardDescription className="text-xs">
              Enable Afya Solar for this facility (solar monitoring and energy dashboards).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingVisibility ? (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                Loading visibility settings…
              </div>
            ) : (
              ALL_SERVICES.map((service) => (
                <label
                  key={service.id}
                  className="flex items-start gap-3 rounded-md border border-emerald-100 bg-white px-3 py-2"
                >
                  <Checkbox
                    checked={visibleServices.includes(service.id)}
                    onCheckedChange={(checked) => handleToggleService(service.id, checked)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{service.label}</div>
                    <div className="text-xs text-gray-600">Solar energy monitoring and facility dashboards.</div>
                  </div>
                </label>
              ))
            )}
          </CardContent>
        </Card>

        <Button
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
          onClick={handleSave}
          disabled={savingVisibility || loadingVisibility || !selectedFacilityId}
        >
          {savingVisibility ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving…
            </>
          ) : (
            "Save visibility settings"
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
