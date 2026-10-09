import { db } from "@fine-leads/database";
import { SmtpValidator } from "../../../packages/scraper-engine/src/smtp-validator";
import { processNextFulfillment } from "../src/lib/scraper/order-fulfillment";

// Run on a persistent host with outbound SMTP port 25, not a Vercel request.
const validator = new SmtpValidator({ port: 25, timeout: 6_000 });
let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});
async function main() {
  try {
    do {
      try {
        const result = await processNextFulfillment({
          verifyEmail: (email) => validator.validate(email),
        });
        console.log(JSON.stringify(result)); // Status/IDs only; no scraped PII or credentials.
        if (process.argv.includes("--once")) break;
        await new Promise((resolve) =>
          setTimeout(resolve, result.worked ? 500 : 5_000),
        );
      } catch {
        console.error(
          "Lobstr worker failed; durable lease/retry will recover the job",
        );
        if (process.argv.includes("--once")) {
          process.exitCode = 1;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 5_000));
      }
    } while (!stopping);
  } finally {
    await db.$disconnect();
  }
}
void main().catch(() => {
  process.exitCode = 1;
});
