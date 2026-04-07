"use client"

import EquipmentForm from "../../_components/equipment-form"

export default function EditEquipmentPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <EquipmentForm isEdit equipmentId={params.id} />
    </div>
  )
}
