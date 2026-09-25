import { GoogleMapsAdapter } from "./adapters/google-maps.adapter.js";
import {
  EmailFinder,
  SmtpValidator,
  DatabaseSynchronizer,
  createResilientFetcherFromEnv,
} from "./index.js";

async function main() {
  console.log("=".repeat(64));
  console.log("  LeadsDom — Google Maps E2E Pipeline Test");
  console.log("=".repeat(64));
  console.log();

  const CATEGORY = "Plumber";
  const CITY = "Miami";
  const STATE = "FL";
  const LIMIT = 15;

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------

  console.log("[init] Creating ResilientFetcher...");
  const fetcher = createResilientFetcherFromEnv();
  console.log("[init] ResilientFetcher initialized.");
  console.log("[init] Proxy stats:", JSON.stringify(fetcher.getProxyStats()));

  console.log("[init] Connecting to database...");
  const dbSync = new DatabaseSynchronizer();
  const dbHealthy = await dbSync.healthCheck();
  if (!dbHealthy) {
    console.error("[init] Database health check FAILED. Aborting.");
    process.exit(1);
  }
  const initialCount = await dbSync.getAgentCount();
  console.log(`[init] Database healthy. Current Agent count: ${initialCount}`);
  console.log();

  // -----------------------------------------------------------------------
  // Step 1 — GoogleMapsAdapter: fetch raw business records
  // -----------------------------------------------------------------------

  console.log("-".repeat(64));
  console.log(`[step-1] GoogleMapsAdapter searching "${CATEGORY}" in ${CITY}, ${STATE} (limit: ${LIMIT})...`);
  console.log();

  const adapter = new GoogleMapsAdapter();
  const records = await collectRecords(adapter, {
    category: CATEGORY,
    location: { city: CITY, state: STATE },
    limit: LIMIT,
    fetcher,
  });

  console.log(`[step-1] Leads found: ${records.length}`);
  for (let i = 0; i < records.length; i++) {
    const r = records[i]!;
    console.log(`  [${i + 1}] ${r.companyName || "(no name)"}`);
    console.log(`      placeId: ${r.googlePlaceId}`);
    console.log(`      address: ${r.address}, ${r.city}, ${r.state} ${r.zipCode}`);
    console.log(`      phone:   ${r.phone || "(none)"}`);
    console.log(`      website: ${r.website || "(none)"}`);
    console.log(`      rating:  ${r.rating} (${r.reviewCount} reviews)`);
  }

  if (records.length === 0) {
    console.log("[step-1] No leads found. Pipeline stops here.");
    await dbSync.close();
    return;
  }

  console.log();

  // -----------------------------------------------------------------------
  // Step 2 — EmailFinder: crawl websites for candidate emails
  // -----------------------------------------------------------------------

  console.log("-".repeat(64));
  console.log("[step-2] EmailFinder crawling websites for candidate emails...");
  console.log();

  const emailFinder = new EmailFinder(fetcher);
  const smtpValidator = new SmtpValidator();

  const dbInserted: Array<{
    placeId: string;
    agentId: string;
    fullName: string;
    email: string;
  }> = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i]!;
    if (!record.website) {
      console.log(`  [${i + 1}] ${record.companyName}: no website — skipping email crawl`);
      console.log();
      continue;
    }

    console.log(`  [${i + 1}] ${record.companyName} — crawling ${record.website}...`);

    try {
      const emailResult = await emailFinder.findEmails(record.website);
      console.log(`      Pages crawled:  ${emailResult.totalPagesCrawled}`);
      console.log(`      Emails found:   ${emailResult.totalEmailsFound}`);

      if (emailResult.candidates.length === 0) {
        console.log("      No candidate emails found.");
        console.log();
        continue;
      }

      for (let j = 0; j < emailResult.candidates.length; j++) {
        const candidate = emailResult.candidates[j]!;
        console.log(`      candidate[${j}]: ${candidate.email}`);
        console.log(`          classification: ${candidate.classification} | confidence: ${candidate.confidence}`);
        console.log(`          sourceUrl:      ${candidate.sourceUrl}`);
      }

      // -------------------------------------------------------------------
      // Step 3 — SmtpValidator: validate every candidate email
      // -------------------------------------------------------------------

      let validatedEmail = "";
      let finalStatus = "";

      for (let j = 0; j < emailResult.candidates.length; j++) {
        const candidate = emailResult.candidates[j]!;
        console.log();
        console.log(`  [step-3] SMTP validating candidate[${j}]: ${candidate.email}...`);

        try {
          const smtpResult = await smtpValidator.validate(candidate.email);
          console.log(`      MX host:      ${smtpResult.mxHost ?? "(none)"}`);
          console.log(`      RCPT TO code: ${smtpResult.smtpCode ?? "(none)"}`);
          console.log(`      RCPT TO msg:  ${smtpResult.smtpMessage ?? "(none)"}`);
          console.log(`      Status:       ${smtpResult.status}`);
          console.log(`      Deliverable:  ${smtpResult.isDeliverable}`);
          console.log(`      Catch-all:    ${smtpResult.isCatchAll}`);
          console.log(`      Duration:     ${smtpResult.durationMs}ms`);

          if (smtpResult.isDeliverable) {
            validatedEmail = candidate.email;
            finalStatus = "validated";
            break;
          } else if (smtpResult.status === "catch-all") {
            validatedEmail = candidate.email;
            finalStatus = "catch-all";
            break;
          }
        } catch (err) {
          console.log(`      SMTP error: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // -------------------------------------------------------------------
      // Step 4 — DatabaseSynchronizer: upsert if email found
      // -------------------------------------------------------------------

      if (validatedEmail) {
        console.log();
        console.log(`  [step-4] Upserting into Agent table (email: ${validatedEmail}, status: ${finalStatus})...`);

        const syncResult = await dbSync.upsertLead({
          companyName: record.companyName,
          phone: record.phone,
          state: record.state,
          zipCode: record.zipCode,
          city: record.city,
          timezone: record.timezone,
          address: record.address,
          category: record.category,
          googleMainCategory: record.googleMainCategory,
          googleSubcategories: record.googleSubcategories,
          website: record.website,
          rating: record.rating,
          reviewCount: record.reviewCount,
          scrapedAt: record.scrapedAt,
          email: validatedEmail,
          emailStatus: finalStatus,
          googlePlaceId: record.googlePlaceId,
          googleMapsLink: record.googleMapsLink,
        });

        console.log(`      DB status:    ${syncResult.status}`);
        console.log(`      placeId:      ${record.googlePlaceId}`);
        if (syncResult.error) {
          console.log(`      DB error:     ${syncResult.error}`);
        } else {
          const agent = await dbSync.getAgentByPlaceId(record.googlePlaceId);
          if (agent) {
            console.log(`      Agent email:  ${agent.email}`);
            console.log(`      Agent status: ${agent.emailStatus}`);
            dbInserted.push({
              placeId: record.googlePlaceId,
              agentId: "see-below",
              fullName: record.companyName,
              email: validatedEmail,
            });
          }
        }
      } else {
        console.log();
        console.log(`  [step-4] Skipped — no deliverable/catch-all email found for ${record.companyName}.`);
      }
    } catch (err) {
      console.log(`      EmailFinder error: ${err instanceof Error ? err.message : String(err)}`);
    }

    console.log();
  }

  // -----------------------------------------------------------------------
  // Verification — query latest inserted Agent rows
  // -----------------------------------------------------------------------

  console.log("=".repeat(64));
  console.log("[verify] Querying latest inserted Agent rows from database...");
  console.log();

  const finalCount = await dbSync.getAgentCount();
  console.log(`  Initial count: ${initialCount}`);
  console.log(`  Final count:   ${finalCount}`);
  console.log(`  Delta:         ${finalCount - initialCount}`);
  console.log();

  const latestAgents = await dbSync.getLatestAgents(10);
  console.log(`[verify] Latest ${latestAgents.length} Agent rows (SCRAPER_ENGINE source):`);
  console.log("-".repeat(64));

  if (latestAgents.length === 0) {
    console.log("  (no rows found)");
  } else {
    for (let i = 0; i < latestAgents.length; i++) {
      const a = latestAgents[i]!;
      console.log(`  [${i + 1}] Agent ID:      ${a.id}`);
      console.log(`      googlePlaceId: ${a.googlePlaceId ?? "(none)"}`);
      console.log(`      fullName:      ${a.fullName}`);
      console.log(`      email:         ${a.email ?? "(none)"}`);
      console.log(`      emailStatus:   ${a.emailStatus ?? "(none)"}`);
      console.log(`      phone:         ${a.phone ?? "(none)"}`);
      console.log(`      websiteUrl:    ${a.websiteUrl ?? "(none)"}`);
      console.log(`      isVerified:    ${a.isVerified}`);
      console.log(`      createdAt:     ${a.createdAt}`);
      console.log();
    }
  }

  console.log("=".repeat(64));
  if (finalCount >= initialCount) {
    console.log("[verify] PASS — Agent table count maintained or increased.");
  } else {
    console.log("[verify] WARN — Agent table count decreased unexpectedly.");
  }

  console.log(`[done] E2E pipeline test complete. ${dbInserted.length} leads inserted/updated with validated emails.`);
  console.log("=".repeat(64));

  await dbSync.close();
}

async function collectRecords(
  adapter: GoogleMapsAdapter,
  params: Parameters<GoogleMapsAdapter["search"]>[0],
) {
  const results: Awaited<ReturnType<GoogleMapsAdapter["search"]>> extends AsyncIterable<infer T> ? T[] : never[] = [];

  for await (const record of adapter.search(params)) {
    results.push(record as never);
  }

  return results;
}

main().catch((err) => {
  console.error("[fatal] E2E test failed:", err);
  process.exit(1);
});