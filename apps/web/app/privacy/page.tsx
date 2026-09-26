import Link from "next/link";
import { LandingFooter } from "@/components/landing/footer";
import { LandingNavbar } from "@/components/landing/navbar";

export const metadata = {
  title: "Privacy Policy — LeadsDom",
  description: "Privacy Policy explaining how LeadsDom collects, uses, protects, and discloses personal information.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col selection:bg-neutral-900 selection:text-white">
      <LandingNavbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-16">
        {/* Breadcrumb & Header */}
        <div className="mb-8 space-y-2">
          <div className="text-xs text-neutral-400 font-medium flex items-center gap-2">
            <Link href="/" className="hover:text-neutral-900 transition-colors">Home</Link>
            <span>/</span>
            <span className="text-neutral-600">Privacy Policy</span>
          </div>
          <p className="text-xs text-neutral-400">Last updated September 20, 2026</p>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-neutral-900 pt-2">
            Privacy Policy
          </h1>
        </div>

        {/* Legal Navigation Tabs */}
        <div className="flex flex-row items-center justify-center gap-1.5 sm:gap-3 my-6 w-full overflow-x-auto no-scrollbar py-1">
          <Link 
            href="/terms" 
            className="text-[11px] sm:text-xs px-3 sm:px-4 py-1.5 rounded-full font-medium whitespace-nowrap transition-all text-slate-600 hover:text-slate-900 bg-slate-100"
          >
            Terms of Service
          </Link>
          <Link 
            href="/privacy" 
            className="text-[11px] sm:text-xs px-3 sm:px-4 py-1.5 rounded-full font-medium whitespace-nowrap transition-all bg-blue-600 text-white shadow-none border-0"
          >
            Privacy Policy
          </Link>
          <Link 
            href="/refund" 
            className="text-[11px] sm:text-xs px-3 sm:px-4 py-1.5 rounded-full font-medium whitespace-nowrap transition-all text-slate-600 hover:text-slate-900 bg-slate-100"
          >
            Refund Policy
          </Link>
        </div>

        {/* Full Plain Legal Text */}
        <div className="space-y-8 text-sm md:text-[15px] text-neutral-700 leading-relaxed font-normal">
          <p>
            This Privacy Policy explains how LeadsDom (the <strong>&quot;Service&quot;</strong>, <strong>&quot;Platform&quot;</strong>, <strong>&quot;we&quot;</strong>, <strong>&quot;us&quot;</strong>, <strong>&quot;our&quot;</strong>) collects, uses, protects, and discloses personal information. It covers two distinct categories of data:
            <br /><br />
            <strong>Part A:</strong> Information about you, our customer/user who registers, tops up wallets, and orders leads.
            <br />
            <strong>Part B:</strong> The business-contact lead data in the product, meaning the public real estate agent intelligence we compile and deliver to customers.
            <br /><br />
            These two categories are treated very differently, and both are detailed below. This is version 2026-09-20 of this Policy.
          </p>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">Part A. Information About You, Our Customer</h2>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">1. What We Collect About You</h2>
            <p>
              <strong>Account Credentials:</strong> Full name, email address, and a secure cryptographic hash of your password (via NextAuth / Auth.js). We never store or have access to your plain-text password. If you sign up using Google OAuth, we receive your verified email and profile name.
            </p>
            <p>
              <strong>Billing &amp; Wallet Data:</strong> Wallet balance, transaction records, lead purchase history, and lifetime top-up volume.               We do not store or process raw credit card numbers. All card payments and wallet recharges are securely handled by our authorized payment processor, Lemon Squeezy (our Merchant of Record and authorized payment reseller).
            </p>
            <p>
              <strong>Platform Usage:</strong> Unlocked state territories, leads delivered or exported, saved search queries, and support communications.
            </p>
            <p>
              <strong>Device &amp; Security Signals:</strong> Your IP address, browser user-agent, operating system, browser timezone, and session tokens. We use these to maintain session security, prevent fraudulent multi-account abuses, and protect the Service.
            </p>
            <p>
              <strong>Approximate Location:</strong> An approximate country or state derived from your IP address and browser timezone recorded during signup. This is approximate and does not use GPS or precise geolocation.
            </p>
            <p>
              <strong>Terms Acceptance Records:</strong> When you accept our Terms of Service and Privacy Policy, we log the version identifier, timestamp, your user ID, IP address, and browser user-agent.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">2. How We Use Customer Information</h2>
            <p>
              To maintain and secure your account, process wallet top-ups, and deliver requested territory datasets;
            </p>
            <p>
              To send essential transactional emails via Resend (such as account verification, password resets, wallet recharge receipts, and export completion notices);
            </p>
            <p>
              To enforce our Terms of Service, detect abusive bot activities, prevent credit fraud, and comply with legal obligations.
            </p>
            <p>
              We do not sell your personal customer account information, and we do not share your private account data with third parties for cross-context behavioral advertising.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">Part B. The Real Estate Lead Data in the Product</h2>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">3. What It Is, and Where It Originates</h2>
            <p>
              LeadsDom compiles, enriches, and indexes professional contact details of licensed US real estate agents, brokers, and real estate brokerages from publicly available registries, state licensing boards, online directories, Google Maps, and public web listings.
            </p>
            <p>
              A delivered agent record can include the individual&apos;s full name, business phone number, direct mobile line, business email address, brokerage affiliation, license number, licensing state, production volume, transaction counts, office address, and verified SMTP deliverability status.
            </p>
            <p>
              Because some records identify an individual real estate professional in their commercial capacity, we treat this business contact data as containing personal information for privacy law compliance. Following the expiration of California&apos;s B2B exemption (effective January 1, 2023), we maintain strict privacy-request mechanisms under the CCPA/CPRA. We use this data solely to provide verified commercial directory intelligence, validate deliverability, and deliver state packs to business customers.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">4. Your Privacy Rights &amp; Opt-Out (For Real Estate Agents)</h2>
            <p>
              If your professional contact information is indexed in our database, or depending on where you reside (including under the California Consumer Privacy Act / CCPA, CPRA, and similar state privacy statutes), you have the right to:
            </p>
            <p>
              <strong>Know &amp; Access:</strong> Request the categories and specific pieces of professional contact information we maintain about you;
            </p>
            <p>
              <strong>Opt-Out &amp; Deletion:</strong> Request the complete removal/deletion of your contact information from the LeadsDom database;
            </p>
            <p>
              <strong>Correction:</strong> Request the correction of inaccurate professional or licensing details;
            </p>
            <p>
              <strong>Non-Discrimination:</strong> Exercise your privacy rights without receiving discriminatory treatment.
            </p>
            <p>
              <strong>How to Request Removal:</strong> To have your professional contact details deleted from our database, email support@leadsdom.com with the subject line <strong>&quot;Privacy / Data Removal Request&quot;</strong> and include your name, state of license, and email address. We verify and honor legitimate opt-out and removal requests within 45 days (or the timeframe required by applicable state law).
            </p>
            <p>
              <strong>Note:</strong> Customers who have already downloaded or exported lead data act as independent data controllers and remain solely responsible for honoring any direct unsubscribe or suppression requests they receive directly.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">Part C. How We Handle, Process, and Protect Data</h2>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">5. Service Providers and Sub-Processors</h2>
            <p>
              We share data with third-party service providers only to the strict extent necessary to operate the Platform. Each provider operates under its own privacy and security protocols:
            </p>
            <p>
              <strong>Cloud Infrastructure &amp; Hosting:</strong> Hosts the web applications and PostgreSQL databases in the United States.
            </p>
            <p>
              <strong>Lemon Squeezy (our Merchant of Record and authorized payment reseller):</strong> Processes customer payments, credit card transactions, and customer billing portals in PCI-compliant environments.
            </p>
            <p>
              <strong>Resend:</strong> Delivers transactional, verification, and notification emails to registered customers.
            </p>
            <p>
              <strong>Upstash (Redis):</strong> Provides high-performance in-memory caching and rate-limiting security.
            </p>
            <p>
              <strong>SMTP Verification &amp; Scraper Pipeline:</strong> Proprietary crawlers and mail exchange (MX) handshake validators that test email deliverability without sending marketing spam.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">6. Disclosure for Legal Reasons</h2>
            <p>
              We may disclose information if required in good faith to comply with applicable laws, subpoenas, court orders, or governmental regulations; to enforce our Terms of Service; to detect and prevent security or technical breaches; or to protect the rights, property, and safety of LeadsDom, our users, or the public.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">7. Data Retention</h2>
            <p>
              <strong>Customer Account Records:</strong> Maintained while your account remains active. When you delete your account, we retain essential transaction ledgers and audit logs for at least 12 months as required for tax compliance, accounting, dispute resolution, and fraud prevention.
            </p>
            <p>
              <strong>Security &amp; Audit Logs:</strong> Maintained for platform security, access monitoring, and terms enforcement.
            </p>
            <p>
              <strong>Lead Database Records:</strong> Maintained and refreshed on an ongoing basis as part of the public directory product, subject to prompt deletion upon individual opt-out requests.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">8. Security Safeguards</h2>
            <p>
              All user passwords are encrypted using secure cryptographic hashing algorithms.
            </p>
            <p>
              Authentication sessions use secure, httpOnly, encrypted JWT cookies that cannot be read by client-side browser scripts.
            </p>
            <p>
              Data transmission between your browser and our servers is encrypted using industry-standard Transport Layer Security (TLS 1.3 / SSL).
            </p>
            <p>
              Administrative access to production databases and backend systems is restricted, role-gated, and logged.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">9. Cookies and Local Storage</h2>
            <p>
              LeadsDom sets essential session cookies:
            </p>
            <p>
              <strong>authjs.session-token / Session Cookie:</strong> An httpOnly, secure cookie that maintains your signed-in status during your session.
            </p>
            <p>
              <strong>Display Preferences:</strong> Local storage keys (such as theme preferences or catalog filters) cached in your browser to prevent unnecessary re-downloads.
            </p>
            <p>
              <strong>No Third-Party Ad Trackers:</strong> We do not sell user tracking cookies to third-party ad brokers.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">10. Jurisdiction and International Users</h2>
            <p>
              The Service is operated and hosted in the United States. If you access the Service from outside the United States, your information will be transferred to and processed in the United States under US commercial and privacy frameworks.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">11. Business Transfers</h2>
            <p>
              In the event that LeadsDom is involved in a merger, asset sale, acquisition, reorganization, or restructuring, user and lead information may be transferred as a business asset under confidentiality protections.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">12. Children&apos;s Privacy</h2>
            <p>
              The Service is intended exclusively for commercial business users and is not directed to individuals under 18 years of age. We do not knowingly collect personal information from minors.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">13. Changes to this Privacy Policy</h2>
            <p>
              We may update this Privacy Policy periodically. Each version will display the version identifier and effective date at the top of the page. Significant changes to how customer data is processed will be communicated through the Service or via email.
            </p>
          </section>

          <section className="space-y-3 pt-6 border-t border-neutral-100">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">14. Contact Us</h2>
            <p>
              For any questions, concerns, or privacy removal requests regarding this Privacy Policy, please contact our privacy team:
            </p>
            <p className="text-sm font-medium text-neutral-900">
              Service: LeadsDom<br />
              Privacy Email: <a href="mailto:support@leadsdom.com" className="text-neutral-900 underline underline-offset-4">support@leadsdom.com</a><br />
              Website: <a href="https://leadsdom.com" className="text-neutral-900 underline underline-offset-4">https://leadsdom.com</a>
            </p>
            <p className="text-xs text-neutral-400 pt-2">
              Document Version: 2026-09-20
            </p>
          </section>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
