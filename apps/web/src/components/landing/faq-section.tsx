"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    question: "How does lead purchasing and state selection work?",
    answer:
      "You have total flexibility! Simply select your target state (or multiple states), choose the exact number of deliverable leads you want to unlock, and pay a transparent flat rate of $0.019 per lead. You only buy the exact volume you need.",
  },
  {
    question: "How do you guarantee 99% email deliverability?",
    answer:
      "Every email address in our database undergoes an active SMTP handshake validation directly with the recipient mail server. We automatically eliminate catch-all mailboxes, disposable domains, and inactive addresses.",
  },
  {
    question: "Are there any monthly subscriptions or hidden fees?",
    answer:
      "No recurring monthly fees or forced lock-ins. You simply top up your wallet balance or purchase specific state packs on demand.",
  },
  {
    question: "What file formats are supported for exporting leads?",
    answer:
      "You can instantly stream and download leads in CSV and Excel formats, perfectly formatted for direct import into HubSpot, Salesforce, GoHighLevel, or your favorite dialer.",
  },
  {
    question: "How frequently is the agent data refreshed?",
    answer:
      "Our automated crawler continuously scans state licensing boards, active brokerage rosters, and public registries to update production volumes, contact info, and active license statuses.",
  },
];

export function FAQSection() {
  return (
    <section id="faq" className="w-full bg-white py-20 relative">
      <div className="mx-auto max-w-3xl px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-neutral-900 text-center">
            Frequently asked questions
          </h2>
          <p className="text-sm md:text-base text-neutral-500 text-center mt-3 max-w-xl mx-auto">
            Everything you need to know about our territory unlocks, data accuracy, and pricing.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <FAQItem key={index} question={faq.question} answer={faq.answer} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-neutral-200/80 rounded-lg bg-white p-5 md:p-6 transition-all duration-200">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left cursor-pointer"
        aria-expanded={isOpen}
      >
        <span className="font-semibold text-neutral-900 text-base md:text-lg pr-4">
          {question}
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-neutral-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      <div
        style={{
          display: "grid",
          gridTemplateRows: isOpen ? "1fr" : "0fr",
          transition: "grid-template-rows 0.3s ease-out",
        }}
      >
        <div className="overflow-hidden">
          <div className="text-sm text-neutral-500 leading-relaxed mt-3 pt-3 border-t border-neutral-100">
            {answer}
          </div>
        </div>
      </div>
    </div>
  );
}
