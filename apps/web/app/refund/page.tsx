import Link from "next/link";
import { LandingNavbar } from "@/src/components/landing/navbar";
import { LandingFooter } from "@/src/components/landing/footer";

export const metadata = {
  title: "Refund Policy — LeadsDom",
  description: "Refund and cancellation policy for LeadsDom real estate intelligence platform.",
};

export default function RefundPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col selection:bg-neutral-900 selection:text-white">
      <LandingNavbar />

      <main className="flex-1 max-w-4xl mx-auto px-6 py-16 w-full">
        {/* Breadcrumb & Header */}
        <div className="mb-8 space-y-2">
          <div className="text-xs text-neutral-400 font-medium flex items-center gap-2">
            <Link href="/" className="hover:text-neutral-900 transition-colors">Home</Link>
            <span>/</span>
            <span className="text-neutral-600">Refund Policy</span>
          </div>
          <p className="text-xs text-neutral-400">Last updated September 20, 2026</p>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-neutral-900 pt-2">
            Refund &amp; Cancellation Policy
          </h1>
        </div>

        {/* Legal Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-neutral-200 pb-4 mb-10">
          <Link
            href="/terms"
            className="px-4 py-1.5 rounded-full text-xs font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
          >
            Terms of Service
          </Link>
          <Link
            href="/privacy"
            className="px-4 py-1.5 rounded-full text-xs font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
          >
            Privacy Policy
          </Link>
          <Link
            href="/refund"
            className="px-4 py-1.5 rounded-full text-xs font-semibold bg-neutral-900 text-white transition-colors"
          >
            Refund Policy
          </Link>
        </div>

        {/* Plain Text Content */}
        <div className="space-y-8 text-sm md:text-[15px] text-neutral-700 leading-relaxed font-normal">
          <p>
            At <strong>LeadsDom</strong> (the <strong>&quot;Service&quot;</strong>, <strong>&quot;we&quot;</strong>, <strong>&quot;us&quot;</strong>, <strong>&quot;our&quot;</strong>), our order processing and payments are securely conducted by our Merchant of Record and authorized payment reseller, <strong>Lemon Squeezy</strong>. Because our platform provides instant digital contact records and irreversible data file exports, we maintain a strictly enforced non-refundable policy once leads have been delivered.
          </p>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">1. Strict No-Refund Policy on Delivered Leads</h2>
            <p>
              All lead purchases, state territory unlocks, and spreadsheet exports are <strong>100% FINAL AND STRICTLY NON-REFUNDABLE</strong> once the data has been delivered, unmasked, or made accessible to your account.
            </p>
            <p>
              Because digital contact datasets, phone numbers, and email files cannot be returned, reclaimed, or un-seen once downloaded, we do not offer refunds, exchanges, or credits for buyer&apos;s remorse, incorrect filtering on the user&apos;s part, or changes in your outreach strategy.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">2. Lemon Squeezy as Merchant of Record</h2>
            <p>
              Our order process is conducted by our online reseller and Merchant of Record, <strong>Lemon Squeezy</strong> (Lemon Squeezy, LLC). Lemon Squeezy manages all customer service inquiries, tax calculations (including US state sales tax and VAT), and secure payment processing. By completing a purchase, you agree to both LeadsDom&apos;s terms and Lemon Squeezy&apos;s checkout terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">3. Automated Zero-Deliverable Lead Adjustment</h2>
            <p>
              If an automated order results in <strong>zero (0) deliverable leads</strong> matching your specified filter criteria, the deducted amount for that specific job is automatically restored to your account wallet balance immediately.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">4. Prepaid Wallet Balances</h2>
            <p>
              Wallet top-ups and credit purchases are non-transferable and non-refundable once added to your account. In the event of voluntary account closure or deletion, all remaining wallet balances, promotional credits, or bonuses are permanently forfeited.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">5. Billing Inquiries &amp; Technical Duplications</h2>
            <p>
              In the rare event of a verified technical duplication error (e.g. your card was billed twice for a single wallet recharge due to a network timeout), please notify us within <strong>7 calendar days</strong> of the incident:
            </p>
            <p className="text-sm font-medium text-neutral-900">
              Email: <a href="mailto:support@leadsdom.com" className="underline underline-offset-4">support@leadsdom.com</a>
            </p>
            <p>
              Please provide your account email address and your Lemon Squeezy order reference receipt. Verified duplicate technical charges will be refunded directly through Lemon Squeezy to your original payment method.
            </p>
          </section>

          <section className="space-y-3 pt-6 border-t border-neutral-100">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">6. Fraudulent Chargebacks</h2>
            <p>
              Initiating a fraudulent credit card chargeback or dispute after receiving delivered lead files constitutes a material violation of our Terms of Service and will result in immediate, permanent termination of your account and blacklisting of associated credentials.
            </p>
            <p className="text-xs text-neutral-400 pt-2">
              LeadsDom · Merchant of Record: Lemon Squeezy · Version 2026-09-20
            </p>
          </section>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
