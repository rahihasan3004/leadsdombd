import { describe, expect, it, vi } from "vitest";
vi.mock("@fine-leads/database", () => ({ db: {} }));
import { redactLeadForTier } from "@/lib/lead-access";
import { normalizeSocialProfiles } from "@/lib/lead-profiles";
const profiles = {
  linkedin: "https://www.linkedin.com/in/agent",
  facebook: "https://www.facebook.com/agent",
  instagram: "https://www.instagram.com/agent",
  whatsapp: "https://wa.me/12125551234",
  twitter: "https://x.com/agent",
  tiktok: "https://www.tiktok.com/@agent",
  youtube: "https://www.youtube.com/@agent",
  pinterest: "https://www.pinterest.com/agent",
};
describe("tier-exclusive social serialization", () => {
  it("redacts every flat/container alias, duplicate link, email and activities for phone packs", () => {
    const source = {
      email: "private@example.com",
      emailStatus: "validated",
      isDeliverable: true,
      socialProfiles: { ...profiles, _lobstr: { cid: "internal" } },
      linkedInProfileUrl: profiles.linkedin,
      facebook_url: profiles.facebook,
      instagram: profiles.instagram,
      twitterX: profiles.twitter,
      whatsappContact: profiles.whatsapp,
      social_links: profiles,
      digitalProfiles: profiles,
      websiteUrl: profiles.facebook,
      fullName: `Agent ${profiles.linkedin}`,
      phone: "2125551234",
      bio: "profile",
      agentActivities: [{ description: profiles.linkedin }],
    };
    const result = redactLeadForTier(source, "PHONE_ONLY");
    expect(result.email).toBeNull();
    expect(result.socialProfiles).toBeNull();
    for (const url of Object.values(profiles))
      expect(JSON.stringify(result)).not.toContain(url);
    expect(result.phone).toBe(source.phone);
    expect(result.websiteUrl).toBe("");
    expect(source.socialProfiles.linkedin).toBe(profiles.linkedin);
  });
  it("preserves safe available profiles for paid outreach, without returning raw metadata", () => {
    const result = redactLeadForTier(
      {
        email: "verified@example.com",
        emailStatus: "validated",
        isDeliverable: true,
        socialProfiles: {
          ...profiles,
          _lobstr: { nameForEmails: "internal-only" },
          email: "unverified@example.com",
        },
      },
      "VERIFIED_EMAIL",
    );
    expect(result.socialProfiles).toEqual(profiles);
    expect(result.email).toBe("verified@example.com");
    expect(JSON.stringify(result.socialProfiles)).not.toContain(
      "internal-only",
    );
    expect(JSON.stringify(result.socialProfiles)).not.toContain(
      "unverified@example.com",
    );
  });
  it("merges historical flattened and alternate-container profiles into the canonical full-tier payload", () => {
    const result = redactLeadForTier(
      {
        email: null,
        linkedInProfileUrl: profiles.linkedin,
        social_links: {
          Facebook: { url: profiles.facebook },
          Instagram: profiles.instagram,
        },
      },
      "VERIFIED_EMAIL",
    );
    expect(result.socialProfiles).toEqual({
      linkedin: profiles.linkedin,
      facebook: profiles.facebook,
      instagram: profiles.instagram,
    });
  });
  it("handles missing profiles and rejects non-http, credentials, arrays and oversized URLs", () => {
    expect(
      normalizeSocialProfiles(null, [], {
        email: "private@example.com",
        _lobstr: { twitter: profiles.twitter },
        linkedin: "javascript:alert(1)",
        facebook: "https://user:secret@facebook.com/agent",
        instagram: "data:text/html,bad",
        youtube: "https://youtube.com/" + "x".repeat(2048),
      }),
    ).toBeNull();
    expect(
      normalizeSocialProfiles({
        LinkedIn_Profile_URL: profiles.linkedin,
        X: profiles.twitter,
      }),
    ).toEqual({ linkedin: profiles.linkedin, twitter: profiles.twitter });
  });
});
