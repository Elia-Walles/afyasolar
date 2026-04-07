import { ManagementPanelPaymentHistory } from '@/components/management-panel/management-panel-payment-history'

export default function PaymentHistoryPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment History</h1>
      <p className="text-gray-600 mb-6">Recent payments and billing activity across installation sites.</p>
      <ManagementPanelPaymentHistory />
    </div>
  )
}
