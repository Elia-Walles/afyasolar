import { redirect } from "next/navigation"

export default async function FeedbackAppointmentPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>
}) {
  const resolved = await params
  const appointmentId = resolved?.appointmentId ?? ""
  if (!appointmentId) redirect("/feedback")
  redirect(`/feedback?appointmentId=${appointmentId}`)
}
