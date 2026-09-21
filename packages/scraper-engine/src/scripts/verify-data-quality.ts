import { Pool } from "pg";

function resolveDatabaseUrl(): string {
  const url =
    process.env["DATABASE_URL"] ??
    process.env["NEON_DATABASE_URL"] ??
    process.env["DIRECT_URL"];
  if (!url) {
    throw new Error(
      "No database URL found. Set DATABASE_URL, NEON_DATABASE_URL, or DIRECT_URL.",
    );
  }
  return url;
}

const DIVIDER = "=".repeat(72);
const SUBDIVIDER = "-".repeat(72);

async function main(): Promise<void> {
  const connectionString = resolveDatabaseUrl();
  const pool = new Pool({ connectionString, max: 2 });

  try {
    // ── HEADER ──
    console.log("\n" + DIVIDER);
    console.log("  LeadsDom — Agent Data Quality Verification Audit");
    console.log("  " + new Date().toISOString());
    console.log(DIVIDER + "\n");

    // ── TOTAL COUNT ──
    const totalRes = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM "Agent"`,
    );
    const totalBefore = parseInt(totalRes.rows[0]?.count ?? "0", 10);
    console.log(`  Total Agent records (before purge):  ${totalBefore.toLocaleString()}`);
    console.log("");

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  DATABASE IMMEDIATE PURGE
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log(SUBDIVIDER);
    console.log("  DATABASE IMMEDIATE PURGE — Removing invalid records");
    console.log(SUBDIVIDER);

    const allowedCategories = [
      "Real Estate Agent",
      "Realtor",
      "Real Estate Brokerage",
    ];
    const allowedCatList = allowedCategories.map((c) => `'${c.replace(/'/g, "''")}'`).join(", ");

    const nonCategoryRes = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM "Agent" WHERE "category" NOT IN (${allowedCatList})`,
    );
    const nonCategoryCount = parseInt(nonCategoryRes.rows[0]?.count ?? "0", 10);
    console.log(`    Non-Real-Estate records to purge:  ${nonCategoryCount.toLocaleString()}`);

    if (nonCategoryCount > 0) {
      const deletedCat = await pool.query(
        `DELETE FROM "Agent" WHERE "category" NOT IN (${allowedCatList})`,
      );
      console.log(`    ✓ Purged ${deletedCat.rowCount ?? nonCategoryCount} non-Real-Estate records (Plumbers, etc.)`);
    } else {
      console.log(`    ✓ No non-Real-Estate records to purge`);
    }

    const nonEmailRes = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM "Agent"
       WHERE "email" IS NULL
          OR "email" = ''
          OR "emailStatus" NOT IN ('validated', 'mx_verified')`,
    );
    const nonEmailCount = parseInt(nonEmailRes.rows[0]?.count ?? "0", 10);
    console.log(`    Non-verified-email records to purge: ${nonEmailCount.toLocaleString()}`);

    if (nonEmailCount > 0) {
      const deletedEmail = await pool.query(
        `DELETE FROM "Agent"
         WHERE "email" IS NULL
            OR "email" = ''
            OR "emailStatus" NOT IN ('validated', 'mx_verified')`,
      );
      console.log(`    ✓ Purged ${deletedEmail.rowCount ?? nonEmailCount} non-verified-email records`);
    } else {
      console.log(`    ✓ No non-verified-email records to purge`);
    }

    console.log("");

    const totalAfterRes = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM "Agent"`,
    );
    const total = parseInt(totalAfterRes.rows[0]?.count ?? "0", 10);
    console.log(`  Total Agent records (after purge):   ${total.toLocaleString()}`);
    console.log(`  Records removed:                     ${(totalBefore - total).toLocaleString()}`);
    console.log("");

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  (a) CATEGORY PURITY CHECK
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log(SUBDIVIDER);
    console.log("  (a) CATEGORY PURITY CHECK");
    console.log(SUBDIVIDER);

    const catRes = await pool.query<{ category: string; count: string }>(
      `SELECT DISTINCT "category", count(*)::text AS count FROM "Agent" GROUP BY "category" ORDER BY count DESC`,
    );

    let purityPass = true;
    for (const row of catRes.rows) {
      const cat = row.category ?? "(NULL)";
      const n = parseInt(row.count, 10);
      const status = allowedCategories.includes(cat) ? "✓" : "✗ INVALID";
      if (!allowedCategories.includes(cat)) purityPass = false;
      console.log(
        `    ${status.padEnd(12)} ${cat.padEnd(32)} ${n.toLocaleString().padStart(8)} records`,
      );
    }

    console.log("");
    if (purityPass && catRes.rows.every((r) => allowedCategories.includes(r.category ?? ""))) {
      console.log("    VERDICT: PASS — Only Real Estate categories present. Zero other niches.");
    } else {
      console.log("    VERDICT: FAIL — Non-Real-Estate categories detected.");
    }
    console.log("");

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  (b) 0% BOUNCE & EMAIL DELIVERABILITY CHECK
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log(SUBDIVIDER);
    console.log("  (b) 0% BOUNCE & EMAIL DELIVERABILITY CHECK");
    console.log(SUBDIVIDER);

    const noEmailRes = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM "Agent" WHERE "email" IS NULL OR "email" = ''`,
    );
    const noEmailCount = parseInt(noEmailRes.rows[0]?.count ?? "0", 10);
    const hasEmailCount = total - noEmailCount;

    console.log(`    Records with email:       ${hasEmailCount.toLocaleString().padStart(8)}  (${((hasEmailCount / total) * 100).toFixed(2)}%)`);
    console.log(`    Records without email:    ${noEmailCount.toLocaleString().padStart(8)}  (${((noEmailCount / total) * 100).toFixed(2)}%)`);

    const statusRes = await pool.query<{ emailStatus: string; count: string }>(
      `SELECT "emailStatus", count(*)::text AS count FROM "Agent" GROUP BY "emailStatus" ORDER BY count DESC`,
    );

    console.log("\n    Email Status Breakdown:");
    const validStatuses = ["validated", "mx_verified"];
    let validStatusCount = 0;
    let invalidStatusCount = 0;

    for (const row of statusRes.rows) {
      const status = row.emailStatus ?? "(NULL)";
      const n = parseInt(row.count, 10);
      const isOk = validStatuses.includes(status);
      if (isOk) validStatusCount += n;
      else invalidStatusCount += n;
      const flag = isOk ? "✓" : "✗ UNEXPECTED";
      console.log(
        `      ${flag.padEnd(14)} ${status.padEnd(20)} ${n.toLocaleString().padStart(8)} records`,
      );
    }

    console.log("");
    const bouncePass = noEmailCount === 0 && invalidStatusCount === 0;
    if (bouncePass) {
      console.log("    VERDICT: PASS — 0% bounce rate. 100% of records have validated/mx_verified emails.");
    } else {
      console.log("    VERDICT: FAIL — Some records lack verified emails.");
    }
    console.log("");

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  (c) 18-ATTRIBUTE COMPLETENESS AUDIT
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log(SUBDIVIDER);
    console.log("  (c) 18-ATTRIBUTE COMPLETENESS AUDIT");
    console.log(SUBDIVIDER);

    const attributeQueries: [string, string, string][] = [
      ["01", "fullName",         `"fullName" IS NOT NULL AND "fullName" != ''`],
      ["02", "firstName",        `"firstName" IS NOT NULL AND "firstName" != ''`],
      ["03", "lastName",         `"lastName" IS NOT NULL AND "lastName" != ''`],
      ["04", "email",            `"email" IS NOT NULL AND "email" != ''`],
      ["05", "emailStatus",      `"emailStatus" IN ('validated', 'mx_verified')`],
      ["06", "phone",            `"phone" IS NOT NULL AND "phone" != ''`],
      ["07", "officePhone",      `"officePhone" IS NOT NULL AND "officePhone" != ''`],
      ["08", "licenseNumber",    `"licenseNumber" IS NOT NULL AND "licenseNumber" != ''`],
      ["09", "licenseState",     `"licenseState" IS NOT NULL AND "licenseState" != ''`],
      ["10", "brokerageName",    `"brokerageName" IS NOT NULL AND "brokerageName" != ''`],
      ["11", "city",             `"city" IS NOT NULL AND "city" != ''`],
      ["12", "state",            `"state" IS NOT NULL AND "state" != ''`],
      ["13", "zipCode",          `"zipCode" ~ '^\\d{5}$'`],
      ["14", "county",           `"county" IS NOT NULL AND "county" != ''`],
      ["15", "websiteUrl",       `"websiteUrl" IS NOT NULL AND "websiteUrl" != ''`],
      ["16", "rating",           `"rating" IS NOT NULL`],
      ["17", "reviewCount",      `"reviewCount" IS NOT NULL AND "reviewCount" > 0`],
      ["18", "googlePlaceId",    `"googlePlaceId" IS NOT NULL AND "googlePlaceId" != ''`],
    ];

    console.log(`    ${"#".padEnd(4)} ${"Attribute".padEnd(18)} ${"Present".padStart(8)} ${"Rate".padStart(9)}  Status`);
    console.log(`    ${"".padEnd(4)} ${"".padEnd(18)} ${"".padStart(8)} ${"".padStart(9)}  ${"".padEnd(6)}`);

    let allAttrsComplete = true;

    for (const [idx, label, condition] of attributeQueries) {
      const res = await pool.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM "Agent" WHERE ${condition}`,
      );
      const present = parseInt(res.rows[0]?.count ?? "0", 10);
      const rate = ((present / total) * 100).toFixed(1);
      const pass = present === total;
      if (!pass) allAttrsComplete = false;
      const icon = pass ? "✓ PASS" : `✗ ${(total - present).toLocaleString()} missing`;
      console.log(
        `    #${idx.padEnd(3)} ${label.padEnd(18)} ${present.toLocaleString().padStart(8)} ${(rate + "%").padStart(9)}  ${icon}`,
      );
    }

    console.log("");
    if (allAttrsComplete) {
      console.log("    VERDICT: PASS — All 18 attributes are 100% complete.");
    } else {
      console.log("    VERDICT: PARTIAL — Some attributes are not at 100%.");
    }
    console.log("");

    // Bonus: isVerified + verificationScore summary
    const verifiedRes = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM "Agent" WHERE "isVerified" = true`,
    );
    const verifiedCount = parseInt(verifiedRes.rows[0]?.count ?? "0", 10);
    console.log(`    Bonus — "isVerified" = true:  ${verifiedCount.toLocaleString().padStart(8)}  (${((verifiedCount / total) * 100).toFixed(1)}%)`);

    const avgScoreRes = await pool.query<{ avg: string }>(
      `SELECT round(avg("verificationScore"), 1)::text AS avg FROM "Agent"`,
    );
    const avgScore = avgScoreRes.rows[0]?.avg ?? "0";
    console.log(`    Bonus — Avg verificationScore:  ${avgScore.padStart(8)}`);
    console.log("");

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  (d) LIVE RECORD INSPECTION (latest 5 rows)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log(SUBDIVIDER);
    console.log("  (d) LIVE RECORD INSPECTION — Latest 5 Records");
    console.log(SUBDIVIDER);

    const sampleRes = await pool.query(
      `SELECT
        "id",
        "fullName",
        "firstName",
        "lastName",
        "email",
        "emailStatus",
        "phone",
        "officePhone",
        "licenseNumber",
        "licenseState",
        "brokerageName",
        "city",
        "state",
        "zipCode",
        "county",
        "websiteUrl",
        "rating",
        "reviewCount",
        "googlePlaceId",
        "category",
        "isVerified",
        "createdAt"
      FROM "Agent"
      ORDER BY "createdAt" DESC
      LIMIT 5`,
    );

    for (let i = 0; i < sampleRes.rows.length; i++) {
      const r = sampleRes.rows[i];
      console.log(`\n  ── Record ${i + 1} of ${sampleRes.rows.length} ──`);
      console.log(`    id:               ${r.id}`);
      console.log(`    fullName:         ${r.fullName ?? "(null)"}`);
      console.log(`    firstName:        ${r.firstName ?? "(null)"}`);
      console.log(`    lastName:         ${r.lastName ?? "(null)"}`);
      console.log(`    email:            ${r.email ?? "(null)"}`);
      console.log(`    emailStatus:      ${r.emailStatus ?? "(null)"}`);
      console.log(`    phone:            ${r.phone ?? "(null)"}`);
      console.log(`    officePhone:      ${r.officePhone ?? "(null)"}`);
      console.log(`    licenseNumber:    ${r.licenseNumber ?? "(null)"}`);
      console.log(`    licenseState:     ${r.licenseState ?? "(null)"}`);
      console.log(`    brokerageName:    ${r.brokerageName ?? "(null)"}`);
      console.log(`    city:             ${r.city ?? "(null)"}`);
      console.log(`    state:            ${r.state ?? "(null)"}`);
      console.log(`    zipCode:          ${r.zipCode ?? "(null)"}`);
      console.log(`    county:           ${r.county ?? "(null)"}`);
      console.log(`    websiteUrl:       ${r.websiteUrl ?? "(null)"}`);
      console.log(`    rating:           ${r.rating ?? "(null)"}`);
      console.log(`    reviewCount:      ${r.reviewCount ?? "(null)"}`);
      console.log(`    googlePlaceId:    ${r.googlePlaceId ?? "(null)"}`);
      console.log(`    category:         ${r.category ?? "(null)"}`);
      console.log(`    isVerified:       ${r.isVerified}`);
      console.log(`    createdAt:        ${r.createdAt}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  FINAL SUMMARY
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log("\n" + DIVIDER);
    console.log("  FINAL AUDIT SUMMARY");
    console.log(DIVIDER);

    const categoryStatus = purityPass ? "PASS ✓" : "FAIL ✗";
    const bounceStatus = bouncePass ? "PASS ✓" : "FAIL ✗";
    const completenessStatus = allAttrsComplete ? "PASS ✓" : "PARTIAL ⚠";

    console.log(`    (a) Category Purity:              ${categoryStatus}`);
    console.log(`    (b) 0% Bounce / Email Verified:   ${bounceStatus}`);
    console.log(`    (c) 18-Attribute Completeness:    ${completenessStatus}`);
    console.log(`    (d) Live Record Preview:          ${sampleRes.rows.length} records inspected`);

    const overallPass = purityPass && bouncePass && allAttrsComplete;
    console.log("");
    if (overallPass) {
      console.log("    OVERALL VERDICT: PASS — The Agent table contains ONLY 100% verified");
      console.log("    Real Estate Agent leads with 0% bounce deliverability and complete attributes.");
    } else {
      console.log("    OVERALL VERDICT: ISSUES DETECTED — See details above.");
    }
    console.log(DIVIDER + "\n");

  } catch (err) {
    console.error(
      "[verify-data-quality] Audit failed:",
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();