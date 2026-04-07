import { FacilityFullDetailsPage } from '@/components/dashboard/facility-full-details-page'

interface FacilityDetailsPageProps {
  params: Promise<{
    facilityId: string // This is the facility UUID
  }>
}

export default async function FacilityDetails({ params }: FacilityDetailsPageProps) {
  const { facilityId } = await params
  return <FacilityFullDetailsPage facilityId={facilityId} />
}
