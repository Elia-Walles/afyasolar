"use client"

import Link from "next/link"

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50/30 via-white to-green-50/20 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white shadow-md rounded-lg border border-green-100 p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-gray-500 mb-6">Last Updated: September 2025</p>

        <p className="text-sm text-gray-700 mb-4">
          Ubuntu AfyaLink ("Company", "we", "our", "us") values your trust. This Privacy Policy explains how we collect, use, disclose, and protect your information when you use our services, solutions, and website www.ubuntuafyalink.co.tz (the "Service").
        </p>
        <p className="text-sm text-gray-700 mb-6">
          By using our Service, you agree to the practices described in this policy.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mb-2">1. Definitions</h2>
        <div className="space-y-1 text-sm text-gray-700 mb-4">
          <p><strong>Account:</strong> A unique profile created by you to access our Service or its features.</p>
          <p><strong>Company:</strong> Ubuntu AfyaLink, registered in Tanzania.</p>
          <p><strong>Cookies:</strong> Small text files stored on your device to improve browsing experience.</p>
          <p><strong>Device:</strong> Any tool you use to access our Service (computer, tablet, phone).</p>
          <p><strong>Personal Data:</strong> Information that identifies you as an individual (e.g. name, phone, email, NIDA/ID number).</p>
          <p><strong>Service:</strong> Our website, applications, and digital solutions.</p>
          <p><strong>Usage Data:</strong> Automatically collected information (IP address, browser type, pages visited, etc.).</p>
          <p><strong>You:</strong> The individual, clinic, hospital, or organization using our Service.</p>
        </div>

        <h2 className="text-lg font-bold text-gray-900 mb-2">2. Types of Data We Collect</h2>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">(a) Personal Data</h3>
        <p className="text-sm text-gray-700 mb-2">When you interact with us, we may collect:</p>
        <ul className="list-disc list-inside text-sm text-gray-700 mb-3 space-y-1">
          <li>Full name</li>
          <li>Email address</li>
          <li>Phone number</li>
          <li>Postal or physical address</li>
          <li>National ID/Passport (where required for contracts or compliance)</li>
          <li>Payment information (processed via secure third-party providers)</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-900 mb-1">(b) Usage Data</h3>
        <p className="text-sm text-gray-700 mb-2">Automatically collected data includes:</p>
        <ul className="list-disc list-inside text-sm text-gray-700 mb-3 space-y-1">
          <li>IP address, browser type, operating system</li>
          <li>Pages you visit on our website</li>
          <li>Date, time, and duration of visits</li>
          <li>Device identifiers and diagnostic data</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-900 mb-1">(c) Cookies &amp; Tracking</h3>
        <p className="text-sm text-gray-700 mb-4">
          We use Cookies to:
        </p>
        <ul className="list-disc list-inside text-sm text-gray-700 mb-6 space-y-1">
          <li>Keep you logged in securely</li>
          <li>Remember your preferences</li>
          <li>Analyze traffic and improve Service performance</li>
        </ul>

        <h2 className="text-lg font-bold text-gray-900 mb-2">3. How We Use Your Data</h2>
        <p className="text-sm text-gray-700 mb-2">We may use your information to:</p>
        <ul className="list-disc list-inside text-sm text-gray-700 mb-6 space-y-1">
          <li>Deliver and maintain our Services (AfyaSolar, Afya Finance).</li>
          <li>Register and manage your Account.</li>
          <li>Process orders, payments, and contracts.</li>
          <li>Communicate with you (via email, SMS, or app notifications).</li>
          <li>Share updates, promotions, or healthcare innovations (only if you opt-in).</li>
          <li>Monitor Service performance and prevent fraud.</li>
          <li>Comply with legal obligations in Tanzania and other applicable laws.</li>
        </ul>

        <h2 className="text-lg font-bold text-gray-900 mb-2">4. Data Sharing</h2>
        <p className="text-sm text-gray-700 mb-2">We do not sell your Personal Data. We may share it in these cases:</p>
        <ul className="list-disc list-inside text-sm text-gray-700 mb-6 space-y-1">
          <li><strong>With Service Providers:</strong> Vendors, technicians, or partners who help us deliver the Service.</li>
          <li><strong>Business Transfers:</strong> In case of merger, acquisition, or restructuring.</li>
          <li><strong>Legal Requirements:</strong> If required by law, regulation, or valid government request.</li>
          <li><strong>With Your Consent:</strong> For specific uses that you approve.</li>
        </ul>

        <h2 className="text-lg font-bold text-gray-900 mb-2">5. Data Retention</h2>
        <ul className="list-disc list-inside text-sm text-gray-700 mb-6 space-y-1">
          <li>Personal Data is kept only as long as needed for Service delivery, compliance, or legitimate business needs.</li>
          <li>Usage Data is usually retained for shorter periods (unless needed for security or improvements).</li>
        </ul>

        <h2 className="text-lg font-bold text-gray-900 mb-2">6. Data Security</h2>
        <p className="text-sm text-gray-700 mb-6">
          We use reasonable technical and organizational safeguards (encryption, secure servers, access controls) to protect your data. However, no system is 100% secure — so we encourage you to protect your login credentials.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mb-2">7. Children's Privacy</h2>
        <p className="text-sm text-gray-700 mb-6">
          Our Service is not intended for children under 13. We do not knowingly collect data from children. If you believe a child has provided us information, please contact us to remove it.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mb-2">8. International Transfers</h2>
        <p className="text-sm text-gray-700 mb-6">
          Although we operate in Tanzania, your information may be stored or processed in other countries by our partners or service providers. We take steps to ensure your data is protected according to this Privacy Policy.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mb-2">9. Your Rights</h2>
        <p className="text-sm text-gray-700 mb-2">You may request to:</p>
        <ul className="list-disc list-inside text-sm text-gray-700 mb-3 space-y-1">
          <li>Access your Personal Data</li>
          <li>Correct or update your information</li>
          <li>Request deletion of your data (subject to legal obligations)</li>
          <li>Opt-out of promotional communications</li>
        </ul>
        <p className="text-sm text-gray-700 mb-6">
          To exercise your rights, contact us at info@ubuntuafyalink.co.tz.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mb-2">10. Third-Party Links</h2>
        <p className="text-sm text-gray-700 mb-6">
          Our website may include links to other sites. We are not responsible for their content or privacy practices. Please review their policies before sharing information.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mb-2">11. Changes to this Policy</h2>
        <p className="text-sm text-gray-700 mb-6">
          We may update this Privacy Policy from time to time. Updates will be posted on this page with a new "Last Updated" date.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mb-2">12. Contact Us</h2>
        <p className="text-sm text-gray-700 mb-1">
          If you have questions or concerns about this Privacy Policy, please contact us:
        </p>
        <ul className="list-none text-sm text-gray-700 mb-8 space-y-1">
          <li>📧 Email: info@ubuntuafyalink.co.tz</li>
          <li>🌍 Website: www.ubuntuafyalink.co.tz</li>
          <li>📞 Phone: +255 656 721 324</li>
        </ul>

        <div className="text-xs text-gray-500">
          <Link href="/auth/signin" className="text-green-600 hover:text-green-700 font-semibold">
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}
