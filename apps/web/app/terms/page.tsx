import Link from "next/link";
import { LandingFooter } from "@/components/landing/footer";
import { LandingNavbar } from "@/components/landing/navbar";

export const metadata = {
  title: "Terms of Service — LeadsDom",
  description: "Terms of Service and usage agreement for LeadsDom real estate intelligence platform.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col selection:bg-neutral-900 selection:text-white">
      <LandingNavbar />

      <main className="flex-1 max-w-4xl mx-auto px-6 py-16 w-full">
        {/* Breadcrumb & Header */}
        <div className="mb-8 space-y-2">
          <div className="text-xs text-neutral-400 font-medium flex items-center gap-2">
            <Link href="/" className="hover:text-neutral-900 transition-colors">Home</Link>
            <span>/</span>
            <span className="text-neutral-600">Terms of Service</span>
          </div>
          <p className="text-xs text-neutral-400">Last updated September 20, 2026</p>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-neutral-900 pt-2">
            Terms of Service
          </h1>
        </div>

        {/* Legal Navigation Tabs */}
        <div className="flex flex-row items-center justify-center gap-1.5 sm:gap-3 my-6 w-full overflow-x-auto no-scrollbar py-1">
          <Link 
            href="/terms" 
            className="text-[11px] sm:text-xs px-3 sm:px-4 py-1.5 rounded-full font-medium whitespace-nowrap transition-all bg-blue-600 text-white shadow-none border-0"
          >
            Terms of Service
          </Link>
          <Link 
            href="/privacy" 
            className="text-[11px] sm:text-xs px-3 sm:px-4 py-1.5 rounded-full font-medium whitespace-nowrap transition-all text-slate-600 hover:text-slate-900 bg-slate-100"
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
            These Terms of Service (the <strong>&quot;Terms&quot;</strong>) govern your access to and use of <strong>LeadsDom</strong> (the <strong>&quot;Service&quot;</strong>, <strong>&quot;Platform&quot;</strong>, <strong>&quot;we&quot;</strong>, <strong>&quot;us&quot;</strong>, <strong>&quot;our&quot;</strong>), a US-focused real estate lead intelligence and territory access platform. By creating an account, topping up your wallet, purchasing lead credits, unlocking territory packs, or accessing any data on LeadsDom, you agree to be bound by these Terms. If you do not agree to these Terms, you must not use or access the Service. This is version 2026-09-20 of these Terms.
          </p>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">1. Nature of the Service</h2>
            <p>
              LeadsDom is an automated software and data tool that aggregates, structures, and indexes publicly available business contact information of licensed real estate agents, brokers, and real estate brokerages operating across all 50 US States and Washington D.C.
            </p>
            <p>
              A delivered record may include publicly available business information such as the agent&apos;s full name, brokerage affiliation, direct cell phone number, office phone, email address, license number, licensing state, production volume, transaction counts, office address, city, state, zip code, and data verification status.
            </p>
            <p>
              <strong>Lead Unlocking &amp; Custom Volume Selection:</strong> LeadsDom operates primarily on an on-demand territory access model. Users may select specific US states and choose the exact volume of deliverable leads they wish to unlock.
            </p>
            <p>
              <strong>Publicly Available Information:</strong> The data delivered through LeadsDom is compiled from public directories, licensing databases, web listings, and publicly accessible records. LeadsDom claims no proprietary ownership over any third-party business listing, trademark, brokerage brand name, or public registry data, and is not affiliated with or endorsed by Google, MLS boards, or any third-party real estate portal.
            </p>
            <p>
              <strong>Not a Consumer Reporting Agency (FCRA Disclaimer):</strong> LeadsDom does not sell consumer personal information and is <strong>not</strong> a consumer reporting agency under the Fair Credit Reporting Act (FCRA). You strictly agree that you will <strong>not</strong> use any data obtained from the Service for any FCRA-regulated purpose, including evaluating eligibility for personal credit, employment, housing, insurance, or tenant screening.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">2. Eligibility and Account Security</h2>
            <p>
              You must be at least 18 years old (or the age of majority in your jurisdiction) and, where acting on behalf of a company or entity, have full legal authority to bind that entity to these Terms. You are responsible for keeping your login credentials secure and for all activity that occurs under your account.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">3. Acceptable Use Policy</h2>
            <p>You agree that you will not, and will not permit anyone else to:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-neutral-600">
              <li>Use the Service or data for any unlawful purpose, fraud, harassment, defamation, or deceptive marketing;</li>
              <li>Violate the Telephone Consumer Protection Act (TCPA), CAN-SPAM Act, state Do-Not-Call (DNC) rules, data protection laws (including CCPA/CPRA, GDPR where applicable), or any telemarketing regulations;</li>
              <li>Resell, sublicense, redistribute, or republish raw LeadsDom datasets as a standalone competing commercial database;</li>
              <li>Infringe the intellectual property or other rights of LeadsDom or any third party;</li>
              <li>Interfere with, overload, probe, reverse-engineer, or circumvent the security mechanisms or access controls of the Platform;</li>
              <li>Attempt to automate scraping or access the Service through unauthorized third-party bots or tools outside of the provided export features.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">4. Marketing Compliance Responsibilities (TCPA &amp; CAN-SPAM)</h2>
            <p>
              LeadsDom is a B2B contact intelligence platform. <strong>LeadsDom is not a compliance, legal, or marketing-consent advisory service.</strong>
            </p>
            <p>
              You are solely responsible for ensuring that your outreach (via phone calls, SMS, cold email, or direct mail) complies with all applicable federal, state, and local laws.
            </p>
            <p>
              <strong>Do-Not-Call (DNC) Scrubbing:</strong> LeadsDom does <strong>not</strong> scrub phone numbers against the National Do-Not-Call Registry, state DNC registries, or internal corporate suppression lists, nor does LeadsDom collect consumer outreach consent on your behalf. You agree that you will perform all required DNC scrubbing and obtain all necessary legal consents prior to placing calls or sending SMS messages to any phone number.
            </p>
            <p>
              <strong>Email Outreach:</strong> You agree that any commercial emails you send will strictly comply with the US CAN-SPAM Act, including maintaining accurate header information, providing clear opt-out / unsubscribe mechanisms, and honoring unsubscribe requests promptly.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">5. Pricing, Wallet, and Billing</h2>
            <p>
              <strong>Prepaid Volume Pricing:</strong> LeadsDom operates on a transparent volume-based model starting at <strong>$0.019 per deliverable lead</strong> ($19.00 per 1,000 leads) or as indicated on the active checkout screen.
            </p>
            <p>
              <strong>Payment Processing:</strong> All payments and wallet top-ups are securely processed through our authorized third-party payment provider, Lemon Squeezy (our Merchant of Record and authorized payment reseller).
            </p>
            <p>
              <strong>Automated Zero-Lead Credit:</strong> If an automated order results in zero deliverable leads due to selected filters, the corresponding deducted funds will automatically be restored to your account wallet balance.
            </p>
            <p>
              <strong>Refund Policy:</strong> Due to the instant delivery nature of digital data and unmasked contact files, all completed purchases and lead exports are <strong>final and non-refundable</strong> once delivered. Unused wallet balances on voluntary account closures are non-refundable.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">6. Data Accuracy &amp; &quot;As-Is&quot; Disclaimer</h2>
            <p>
              While LeadsDom utilizes email verification and SMTP validation techniques to filter invalid addresses, real estate contact data and licensing statuses fluctuate constantly in the real world.
            </p>
            <p>
              All data, deliverability indicators, phone classifications, and lead information are provided on a strict <strong>&quot;AS-IS&quot; and &quot;AS-AVAILABLE&quot; basis</strong>. LeadsDom makes no warranties or guarantees, express or implied, that every contact record is 100% accurate, current, or responsive, or that any email will never bounce.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">7. Disclaimer of Warranties</h2>
            <p className="uppercase text-xs text-neutral-600 font-semibold tracking-wide">
              THE SERVICE AND ALL DATA ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot;, WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED OR STATUTORY, INCLUDING WITHOUT LIMITATION THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE AND NON-INFRINGEMENT.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">8. Limitation of Liability</h2>
            <p className="uppercase text-xs text-neutral-600 font-semibold tracking-wide">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, LEADSDOM, ITS OWNERS, OPERATORS, EMPLOYEES, CONTRACTORS, OR AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, DATA, OR PIPELINE DISRUPTIONS ARISING FROM YOUR USE OF THE SERVICE OR YOUR OUTREACH TO DELIVERED LEADS.
            </p>
            <p>
              LEADSDOM&apos;S TOTAL AGGREGATE LIABILITY FOR ANY AND ALL CLAIMS ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE SHALL BE STRICTLY LIMITED TO THE AMOUNT YOU ACTUALLY PAID TO LEADSDOM IN THE THIRTY (30) DAYS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">9. Indemnification</h2>
            <p>
              You agree to defend, indemnify, and hold harmless LeadsDom, its owners, operators, developers, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or related to: (a) your use or misuse of the Service or any lead data; (b) your telephone calls, text messages, emails, or marketing campaigns directed at any lead; (c) your violation of any applicable law, including the TCPA, CAN-SPAM Act, DNC rules, or privacy regulations; or (d) your breach of these Terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">10. Termination</h2>
            <p>
              You may delete your account at any time from your Account Settings. We reserve the right to suspend or terminate access for any user who violates these Terms or engages in abusive behavior. Upon voluntary account deletion, any remaining wallet credits or promotional balances are forfeited.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">11. Governing Law &amp; Dispute Resolution</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the <strong>State of Delaware, United States</strong>, without regard to its conflict-of-laws principles.
            </p>
            <p>
              <strong>Binding Arbitration:</strong> Any dispute, claim, or controversy arising out of or relating to these Terms or the Service shall be resolved through final and binding arbitration administered under the Commercial Arbitration Rules of the American Arbitration Association (AAA) seated in Delaware, USA.
            </p>
            <p>
              <strong>Class Action Waiver:</strong> You agree that all disputes must be brought solely in your individual capacity, and not as a plaintiff or class member in any purported class, consolidated, or representative proceeding.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">12. Changes to these Terms</h2>
            <p>
              We may update these Terms from time to time. Each version carries a version identifier and an effective date shown on this page. When we publish a version that materially changes your rights or obligations, you will be notified through the Service.
            </p>
          </section>

          <section className="space-y-3 pt-6 border-t border-neutral-100">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">13. Contact &amp; Questions</h2>
            <p>
              If you have any questions regarding this document or the Service, please reach out to our support team:
            </p>
            <p className="text-sm font-medium text-neutral-900">
              Email: <a href="mailto:support@leadsdom.com" className="text-neutral-900 underline underline-offset-4">support@leadsdom.com</a><br />
              Website: <a href="https://leadsdom.com" className="text-neutral-900 underline underline-offset-4">https://leadsdom.com</a>
            </p>
            <p className="text-xs text-neutral-400 pt-2">
              LeadsDom · United States · Version 2026-09-20
            </p>
          </section>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
