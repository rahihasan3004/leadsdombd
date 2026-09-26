export type VerifiedLeadSource = "google_maps" | "zillow" | "realtor_com" | "realtor" | "homes_com";

export interface VerifiedLeadPayload {
  companyName: string;
  firstName?: string;
  lastName?: string;
  brokerageName?: string;
  phone: string;
  state: string;
  zipCode: string;
  city: string;
  timezone: string;
  address: string;
  category: string;
  googleMainCategory: string;
  googleSubcategories: string;
  website: string;
  rating: number | null;
  reviewCount: number | null;
  scrapedAt: string;
  email: string;
  emailStatus: string;
  googlePlaceId: string;
  googleMapsLink: string;
}

export type VerifiedLeadValidationError = {
  field: keyof VerifiedLeadPayload;
  message: string;
  received: unknown;
};

export type ScraperBatchResult = {
  source: VerifiedLeadSource;
  leads: VerifiedLeadPayload[];
  errors: VerifiedLeadValidationError[];
  scrapedAt: string;
  durationMs: number;
};