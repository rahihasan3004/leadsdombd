import { LandingNavbar } from "@/components/landing/navbar";
import { HeroSection } from "@/components/landing/hero-section";
import { BentoFeatures } from "@/components/landing/bento-features";
import { FeatureMatrix } from "@/components/landing/feature-matrix";
import { Testimonials } from "@/components/landing/testimonials";
import { FAQSection } from "@/components/landing/faq-section";
import { CTABanner } from "@/components/landing/cta-banner";
import { LandingFooter } from "@/components/landing/footer";
import { Suspense } from "react";

function SectionSkeleton() {
  return (
    <div className="min-h-[200px] animate-pulse bg-neutral-100" />
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col selection:bg-neutral-900 selection:text-white overflow-x-hidden w-full max-w-full">
      <Suspense fallback={<div className="h-20" />}>
        <LandingNavbar />
      </Suspense>
      <main className="flex-1">
        <HeroSection />
        <BentoFeatures />
        <FeatureMatrix />
        <Testimonials />
        <FAQSection />
        <Suspense fallback={<SectionSkeleton />}>
          <CTABanner />
        </Suspense>
      </main>
      <LandingFooter />
    </div>
  );
}
