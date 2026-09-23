import { LandingNavbar } from "@/components/landing/navbar";
import { HeroSection } from "@/components/landing/hero-section";
import { BentoFeatures } from "@/components/landing/bento-features";
import { FeatureMatrix } from "@/components/landing/feature-matrix";
import { Testimonials } from "@/components/landing/testimonials";
import { FAQSection } from "@/components/landing/faq-section";
import { CTABanner } from "@/components/landing/cta-banner";
import { LandingFooter } from "@/components/landing/footer";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col selection:bg-neutral-900 selection:text-white">
      <LandingNavbar />
      <main className="flex-1">
        <HeroSection />
        <BentoFeatures />
        <FeatureMatrix />
        <Testimonials />
        <FAQSection />
        <CTABanner />
        <LandingFooter />
      </main>
    </div>
  );
}
