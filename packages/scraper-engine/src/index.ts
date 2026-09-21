export type {
  VerifiedLeadPayload,
  VerifiedLeadSource,
  VerifiedLeadValidationError,
  ScraperBatchResult,
} from "./types/lead.types.js";

export { parseEnv, getEnv, resolveDatabaseUrl, type ScraperEnv } from "./config/env.js";

export { MASTER_CATEGORIES, getCategories } from "./config/categories.js";

export {
  ProxyPool,
  createProxyPoolFromEnv,
  TokenBucketRateLimiter,
  UserAgentRotator,
  HeaderRandomizer,
  ResilientFetcher,
  createResilientFetcherFromEnv,
} from "./anti-ban.js";

export type {
  ProxyConfig,
  FetchResponse,
  RequestConfig,
  ResilientRequestConfig,
  RateLimiter,
} from "./anti-ban.js";

export {
  DiscoveryCrawler,
  SourceAdapter,
  expandStateQueries,
  expandCityQueries,
  US_STATES,
  STATE_TIMEZONE,
  MAJOR_CITIES,
} from "./crawler.js";

export type {
  LocationSpec,
  DiscoveryQuery,
  RawBusinessRecord,
  CrawlerResult,
  CrawlerErrorEntry,
  CrawlerErrorType,
  CrawlerProgress,
  CrawlerEvent,
} from "./crawler.js";

export { EmailFinder } from "./email-finder.js";

export type {
  EmailClassification,
  EmailCandidate,
  EmailFinderResult,
  EmailFinderOptions,
} from "./email-finder.js";

export { SmtpValidator, validateEmail } from "./smtp-validator.js";

export type {
  SmtpValidationStatus,
  SmtpValidationResult,
  SmtpValidatorOptions,
} from "./smtp-validator.js";

export { DatabaseSynchronizer } from "./db-sync.js";

export type { DatabaseSyncStats } from "./db-sync.js";

export { LeadPipeline } from "./pipeline.js";

export type { PipelineConfig, PipelineStats } from "./pipeline.js";

export { runContinuous } from "./runner.js";

export type { RunnerConfig } from "./runner.js";

export { GoogleMapsAdapter } from "./adapters/google-maps.adapter.js";