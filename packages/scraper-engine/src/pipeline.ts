import {
  DiscoveryCrawler,
  type SourceAdapter,
  type DiscoveryQuery,
} from "./crawler.js";
import { EmailFinder } from "./email-finder.js";
import { SmtpValidator } from "./smtp-validator.js";
import { DatabaseSynchronizer } from "./db-sync.js";
import {
  createResilientFetcherFromEnv,
  type ResilientFetcher,
} from "./anti-ban.js";
import type { VerifiedLeadPayload } from "./types/lead.types.js";

export interface PipelineConfig {
  sourceAdapter: SourceAdapter;
  query: DiscoveryQuery;
  fetcher?: ResilientFetcher;
  dbSync?: DatabaseSynchronizer;
  concurrency?: number;
}

export interface PipelineStats {
  totalScraped: number;
  websitesCrawled: number;
  emailsFound: number;
  emailsValidated: number;
  duplicatesSkipped: number;
  leadsSavedToDb: number;
  skippedNoEmail: number;
  errorsEncountered: number;
  startTime: number;
  endTime: number;
  totalRunTimeMs: number;
}

function createEmptyStats(): PipelineStats {
  const now = Date.now();
  return {
    totalScraped: 0,
    websitesCrawled: 0,
    emailsFound: 0,
    emailsValidated: 0,
    duplicatesSkipped: 0,
    leadsSavedToDb: 0,
    skippedNoEmail: 0,
    errorsEncountered: 0,
    startTime: now,
    endTime: now,
    totalRunTimeMs: 0,
  };
}

export class LeadPipeline {
  private emailFinder: EmailFinder;
  private smtpValidator: SmtpValidator;

  constructor(fetcher?: ResilientFetcher) {
    const f = fetcher ?? createResilientFetcherFromEnv();
    this.emailFinder = new EmailFinder(f);
    this.smtpValidator = new SmtpValidator();
  }

  async run(config: PipelineConfig): Promise<PipelineStats> {
    const fetcher = config.fetcher ?? createResilientFetcherFromEnv();
    const dbSync = config.dbSync ?? new DatabaseSynchronizer();
    const ownDbSync = !config.dbSync;

    const crawler = new DiscoveryCrawler({
      adapter: config.sourceAdapter,
      fetcher,
      concurrency: config.concurrency,
    });

    const stats = createEmptyStats();

    try {
      for await (const event of crawler.crawl(config.query)) {
        if (event.type === "progress") {
          continue;
        }

        if (event.type === "error") {
          stats.errorsEncountered++;
          continue;
        }

        if (event.type !== "record" || !event.data?.record) {
          continue;
        }

        stats.totalScraped++;

        try {
          const record = event.data.record;
          let email = "";
          let emailStatus = "none";
          let hasDeliverableEmail = false;
          let extractedZipCode = "";

          if (record.website && record.website.length > 0) {
            stats.websitesCrawled++;

            try {
              const emailResult = await this.emailFinder.findEmails(record.website);
              if (emailResult.candidates.length > 0) {
                stats.emailsFound++;
                const topCandidate = emailResult.candidates[0]!;

                try {
                  const smtpResult = await this.smtpValidator.validate(
                    topCandidate.email,
                  );
                  const isDeliverable =
                    smtpResult.isDeliverable &&
                    (smtpResult.status === "deliverable" ||
                      smtpResult.status === "validated" ||
                      smtpResult.status === "mx_verified");
                  if (isDeliverable) {
                    email = topCandidate.email;
                    emailStatus = smtpResult.status === "deliverable"
                      ? "validated"
                      : smtpResult.status;
                    stats.emailsValidated++;
                    hasDeliverableEmail = true;
                  } else {
                    emailStatus = smtpResult.status;
                  }
                } catch {
                  emailStatus = "smtp_error";
                }
              }

              if (emailResult.zipCode) {
                extractedZipCode = emailResult.zipCode;
              }
            } catch {
              emailStatus = "email_find_error";
            }
          }

          if (!hasDeliverableEmail) {
            stats.skippedNoEmail++;
            continue;
          }

          const lead: VerifiedLeadPayload = {
            companyName: record.companyName,
            firstName: record.firstName,
            lastName: record.lastName,
            brokerageName: record.brokerageName,
            phone: record.phone,
            state: record.state,
            zipCode: record.zipCode || extractedZipCode,
            city: record.city,
            timezone: record.timezone,
            address: record.address,
            category: record.category,
            googleMainCategory: record.googleMainCategory,
            googleSubcategories: record.googleSubcategories,
            website: record.website,
            rating: record.rating,
            reviewCount: record.reviewCount,
            scrapedAt: record.scrapedAt || new Date().toISOString(),
            email,
            emailStatus,
            googlePlaceId: record.googlePlaceId,
            googleMapsLink: record.googleMapsLink,
          };

          const syncResult = await dbSync.upsertLead(lead);
          if (syncResult.status === "skipped_duplicate") {
            stats.duplicatesSkipped++;
          } else if (syncResult.status === "error") {
            stats.errorsEncountered++;
          } else {
            stats.leadsSavedToDb++;
          }
        } catch {
          stats.errorsEncountered++;
        }
      }
    } finally {
      if (ownDbSync) {
        await dbSync.close();
      }
      stats.endTime = Date.now();
      stats.totalRunTimeMs = stats.endTime - stats.startTime;
    }

    return stats;
  }
}