"use client"

import Link from "next/link"

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50/30 via-white to-green-50/20 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white shadow-md rounded-lg border border-green-100 p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-2">
          UBUNTU AFYALINK COMPANY LIMITED – TERMS &amp; CONDITIONS
        </h1>
        <p className="text-sm text-gray-500 mb-1">Effective Date: 01 th November 2025</p>
        <p className="text-sm text-gray-500 mb-6">Last Updated: 10th December 2025</p>

        <p className="text-sm text-gray-700 mb-4">
          These Terms &amp; Conditions ("Terms") govern access to and use of the Ubuntu AfyaLink Company Limited digital platform and all services provided under AfyaSolar, equipment financing, and consumables inventory financing ("Services"). By registering, accessing, or using our platform, the user ("Client," "Facility," "You") agrees to be bound by these Terms. If you do not agree to these Terms, do not use the Platform.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mb-2">1. DEFINITIONS</h2>
        <div className="space-y-1 text-sm text-gray-700 mb-4">
          <p><strong>"Platform"</strong> means the Ubuntu AfyaLink digital system, mobile application, website, and all associated technologies.</p>
          <p><strong>"Facility"</strong> means any healthcare facility, clinic, hospital, pharmacy, laboratory, or related institution that uses our Services.</p>
          <p><strong>"Solutions"</strong> refers to AfyaSolar, financing services, and any new modules introduced.</p>
          <p><strong>"Subscription"</strong> refers to any paid service billed monthly or annually.</p>
          <p><strong>"Financing Services"</strong> refers to medical equipment financing, upgrades, and consumable inventory financing offered through Ubuntu AfyaLink or partners.</p>
        </div>

        <h2 className="text-lg font-bold text-gray-900 mb-2">2. SCOPE OF SERVICES</h2>
        <p className="text-sm text-gray-700 mb-3">Ubuntu AfyaLink provides the following:</p>

        <h3 className="text-sm font-semibold text-gray-900 mb-1">2.1 AfyaSolar</h3>
        <ul className="list-disc list-inside text-sm text-gray-700 mb-3 space-y-1">
          <li>Supply and installation of solar energy systems for health facilities.</li>
          <li>Off-grid and on-grid hybrid systems.</li>
          <li>Optional flexible financing ("Solar-as-a-Service").</li>
          <li>Annual operations &amp; maintenance (O&amp;M) service package.</li>
          <li>Energy efficiency assessments.</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-900 mb-1">2.2 Financing Services</h3>
        <ul className="list-disc list-inside text-sm text-gray-700 mb-6 space-y-1">
          <li>Medical equipment financing.</li>
          <li>Consumables &amp; medical supplies inventory financing.</li>
          <li>Flexible repayment schedules.</li>
        </ul>
        <p className="text-sm text-gray-700 mb-6">Ubuntu AfyaLink may also add new services from time to time.</p>

        <h2 className="text-lg font-bold text-gray-900 mb-2">3. ELIGIBILITY</h2>
        <p className="text-sm text-gray-700 mb-2">To use the Platform, a Facility must:</p>
        <ul className="list-disc list-inside text-sm text-gray-700 mb-6 space-y-1">
          <li>Be a registered healthcare entity within its jurisdiction.</li>
          <li>Provide accurate, verifiable documentation upon request.</li>
          <li>Be legally authorized to sign agreements and undertake financial obligations.</li>
        </ul>

        <h2 className="text-lg font-bold text-gray-900 mb-2">4. ACCOUNT REGISTRATION</h2>
        <ul className="list-disc list-inside text-sm text-gray-700 mb-6 space-y-1">
          <li>All information provided must be accurate, complete, and updated regularly.</li>
          <li>You are responsible for safeguarding your login credentials.</li>
          <li>Ubuntu AfyaLink is not liable for damages from unauthorized access resulting from your negligence.</li>
        </ul>

        <h2 className="text-lg font-bold text-gray-900 mb-2">5. PAYMENT TERMS</h2>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">5.1 Subscriptions</h3>
        <ul className="list-disc list-inside text-sm text-gray-700 mb-3 space-y-1">
          <li>AfyaSolar O&amp;M billed quarterly unless otherwise stated.</li>
          <li>All subscription payments are non-transferable.</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-900 mb-1">5.2 One-Off Purchases</h3>
        <ul className="list-disc list-inside text-sm text-gray-700 mb-3 space-y-1">
          <li>AfyaSolar systems and installations require upfront payment unless under financing.</li>
          <li>One-off services may be billed per service order.</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-900 mb-1">5.3 Financing Services</h3>
        <ul className="list-disc list-inside text-sm text-gray-700 mb-6 space-y-1">
          <li>Financing approval is subject to assessment and due diligence.</li>
          <li>Facilities must sign a Financing Agreement outlining repayment terms, penalties, and asset ownership rules.</li>
          <li>Late payments may attract interest, penalties, or equipment retrieval.</li>
        </ul>

        <h2 className="text-lg font-bold text-gray-900 mb-2">6. SERVICE DELIVERY</h2>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">6.1 AfyaSolar</h3>
        <ul className="list-disc list-inside text-sm text-gray-700 mb-3 space-y-1">
          <li>Delivery timelines depend on system size, location, and inventory.</li>
          <li>Installation includes testing, training, and commissioning.</li>
          <li>O&amp;M may be performed remotely or onsite as needed.</li>
        </ul>

        <h2 className="text-lg font-bold text-gray-900 mb-2">7. CLIENT OBLIGATIONS</h2>
        <p className="text-sm text-gray-700 mb-2">Clients must:</p>
        <ul className="list-disc list-inside text-sm text-gray-700 mb-6 space-y-1">
          <li>Provide safe access for engineers and installers.</li>
          <li>Maintain reasonable care of equipment.</li>
          <li>Not modify, tamper with, or resell equipment without written approval.</li>
          <li>Ensure timely payment of subscriptions and financing obligations.</li>
        </ul>

        <h2 className="text-lg font-bold text-gray-900 mb-2">8. PLATFORM USAGE</h2>
        <p className="text-sm text-gray-700 mb-2">You agree not to:</p>
        <ul className="list-disc list-inside text-sm text-gray-700 mb-6 space-y-1">
          <li>Copy, resell, or commercially exploit the Platform.</li>
          <li>Reverse engineer, hack, or interfere with its operations.</li>
          <li>Upload harmful, malicious, or illegal content.</li>
        </ul>
        <p className="text-sm text-gray-700 mb-6">Violation may result in immediate suspension.</p>

        <h2 className="text-lg font-bold text-gray-900 mb-2">9. DATA PRIVACY &amp; SECURITY</h2>
        <p className="text-sm text-gray-700 mb-6">
          Ubuntu AfyaLink adheres to applicable data protection laws, including:
        </p>
        <ul className="list-disc list-inside text-sm text-gray-700 mb-6 space-y-1">
          <li>Lawful processing of facility and patient data.</li>
          <li>Secure storage and encrypted transmission.</li>
          <li>No resale of identifiable patient data to third parties. Analytics may be used for improving services.</li>
        </ul>

        <h2 className="text-lg font-bold text-gray-900 mb-2">10. INTELLECTUAL PROPERTY</h2>
        <p className="text-sm text-gray-700 mb-6">
          All trademarks, software, designs, and strategies remain the property of Ubuntu AfyaLink. Clients receive a limited, revocable, non-transferable license to use the Platform.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mb-2">11. WARRANTIES &amp; DISCLAIMERS</h2>
        <ul className="list-disc list-inside text-sm text-gray-700 mb-6 space-y-1">
          <li>Ubuntu AfyaLink strives for high uptime and quality but does not guarantee uninterrupted service.</li>
          <li>AfyaSolar performance is subject to weather conditions and site suitability.</li>
          <li>Ubuntu AfyaLink is not responsible for losses due to facility misuse, negligence, or force majeure events.</li>
        </ul>

        <h2 className="text-lg font-bold text-gray-900 mb-2">12. LIMITATION OF LIABILITY</h2>
        <p className="text-sm text-gray-700 mb-6">
          To the fullest extent allowed by law, Ubuntu AfyaLink is not liable for:
        </p>
        <ul className="list-disc list-inside text-sm text-gray-700 mb-6 space-y-1">
          <li>Loss of profits, business interruptions, or revenue loss.</li>
          <li>Damages arising from misuse, delays, or third-party actions.</li>
          <li>Data loss (though best practices are applied to prevent this).</li>
        </ul>
        <p className="text-sm text-gray-700 mb-6">
          Total liability shall not exceed the total annual subscription fees paid by the Facility.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mb-2">13. TERMINATION</h2>
        <p className="text-sm text-gray-700 mb-2">Ubuntu AfyaLink may suspend or terminate accounts if the Facility:</p>
        <ul className="list-disc list-inside text-sm text-gray-700 mb-6 space-y-1">
          <li>Violates these Terms,</li>
          <li>Defaults on financing agreements,</li>
          <li>Engages in fraudulent or illegal activity.</li>
        </ul>
        <p className="text-sm text-gray-700 mb-6">
          Clients may cancel anytime through the Platform, but refunds are governed by Clause 14.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mb-2">14. REFUND POLICY</h2>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">14.1 AfyaSolar</h3>
        <p className="text-sm text-gray-700 mb-3">System deposits are refundable within 14 days before installation begins.</p>
        <p className="text-sm text-gray-700 mb-3">Once installation begins, payments become non-refundable, except in cases of proven service failure.</p>

        <h3 className="text-sm font-semibold text-gray-900 mb-1">14.2 Financing</h3>
        <p className="text-sm text-gray-700 mb-6">
          Financing fees, interest, and principal repayments are non-refundable. Early settlement may be allowed but with conditions as per financing contract.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mb-2">15. DISPUTE RESOLUTION</h2>
        <p className="text-sm text-gray-700 mb-6">
          Disputes will be resolved through the following steps:
        </p>
        <ol className="list-decimal list-inside text-sm text-gray-700 mb-6 space-y-1">
          <li>Internal mediation with Ubuntu AfyaLink team.</li>
          <li>Arbitration under the laws of the United Republic of Tanzania (or agreed jurisdiction).</li>
          <li>Courts as the final remedy if arbitration fails.</li>
        </ol>

        <h2 className="text-lg font-bold text-gray-900 mb-2">16. GOVERNING LAW</h2>
        <p className="text-sm text-gray-700 mb-6">
          These Terms are governed by the laws of Tanzania and applicable international commercial standards for cross-border services.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mb-2">17. AMENDMENTS</h2>
        <p className="text-sm text-gray-700 mb-6">
          Ubuntu AfyaLink may modify these Terms at any time. Clients will be notified via email, SMS, or Platform notices. Continued usage constitutes acceptance of revised Terms.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mb-2">18. CONTACT INFORMATION</h2>
        <p className="text-sm text-gray-700 mb-2">
          For questions, clarifications, or complaints, contact:
        </p>
        <ul className="list-none text-sm text-gray-700 mb-8 space-y-1">
          <li>Ubuntu AfyaLink Support</li>
          <li>Phone: +255 656 721 324</li>
          <li>Email: info@ubuntuafyalink.co.tz</li>
          <li>Website: www.ubuntuafyalink.co.tz</li>
        </ul>

        <div className="text-xs text-gray-500 space-x-4">
          <Link href="/auth/signin" className="text-green-600 hover:text-green-700 font-semibold">
            Back to Sign In
          </Link>
          <Link href="/privacy-policy" className="text-green-600 hover:text-green-700 font-semibold">
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  )
}
