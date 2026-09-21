import { db } from "@fine-leads/database";

function getStartOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getStartOfWeek(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(now.getFullYear(), now.getMonth(), diff);
}

function getStartOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function getScraperStats() {
  const startOfToday = getStartOfToday();
  const startOfWeek = getStartOfWeek();
  const startOfMonth = getStartOfMonth();

  const [
    totalScraped,
    ingestedToday,
    ingestedThisWeek,
    ingestedThisMonth,
    totalWithEmail,
    deliverableAgents,
    totalWithDataQualityScore,
    dataQualityScoreSum,
  ] = await Promise.all([
    db.agent.count({ where: { dataSource: "SCRAPER_ENGINE" } }),
    db.agent.count({
      where: {
        dataSource: "SCRAPER_ENGINE",
        scrapedAt: { gte: startOfToday },
      },
    }),
    db.agent.count({
      where: {
        dataSource: "SCRAPER_ENGINE",
        scrapedAt: { gte: startOfWeek },
      },
    }),
    db.agent.count({
      where: {
        dataSource: "SCRAPER_ENGINE",
        scrapedAt: { gte: startOfMonth },
      },
    }),
    db.agent.count({
      where: {
        dataSource: "SCRAPER_ENGINE",
        email: { not: null },
      },
    }),
    db.agent.count({
      where: {
        dataSource: "SCRAPER_ENGINE",
        email: { not: null },
        isDeliverable: true,
      },
    }),
    db.agent.count({
      where: {
        dataSource: "SCRAPER_ENGINE",
        verificationScore: { gt: 0 },
      },
    }),
    db.agent.aggregate({
      where: { dataSource: "SCRAPER_ENGINE" },
      _avg: { verificationScore: true },
    }),
  ]);

  const emailDiscoveryRate =
    totalScraped > 0 ? Math.round((totalWithEmail / totalScraped) * 100) : 0;

  const smtpDeliverabilityRate =
    totalWithEmail > 0 ? Math.round((deliverableAgents / totalWithEmail) * 100) : 0;

  const avgDataQualityScore =
    dataQualityScoreSum._avg.verificationScore
      ? Math.round(dataQualityScoreSum._avg.verificationScore)
      : 0;

  return {
    totalScraped,
    ingestedToday,
    ingestedThisWeek,
    ingestedThisMonth,
    emailDiscoveryRate,
    smtpDeliverabilityRate,
    deliverableAgents,
    totalWithEmail,
    avgDataQualityScore,
  };
}

export async function getScraperDailyTrend(days = 14) {
  const trend: { date: string; count: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date();
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const count = await db.agent.count({
      where: {
        dataSource: "SCRAPER_ENGINE",
        scrapedAt: { gte: dayStart, lt: dayEnd },
      },
    });

    trend.push({
      date: dayStart.toISOString().split("T")[0] ?? "",
      count,
    });
  }

  return trend;
}

export async function getScraperCoverage() {
  const states = await db.agent.groupBy({
    by: ["state"],
    where: {
      dataSource: "SCRAPER_ENGINE",
      state: { not: null },
    },
    _count: { id: true },
    _max: { scrapedAt: true },
    orderBy: { _count: { id: "desc" } },
  });

  const US_STATES_MAP: Record<string, string> = {
    AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
    CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
    HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
    KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
    MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
    MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
    NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
    OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
    SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
    VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
    DC: "District of Columbia",
  };

  const now = new Date();
  const freshThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const moderateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  return states.map((s) => {
    const latestScrapedAt = s._max.scrapedAt;
    let freshness: "fresh" | "moderate" | "stale";

    if (!latestScrapedAt) {
      freshness = "stale";
    } else if (latestScrapedAt >= freshThreshold) {
      freshness = "fresh";
    } else if (latestScrapedAt >= moderateThreshold) {
      freshness = "moderate";
    } else {
      freshness = "stale";
    }

    return {
      stateCode: s.state,
      stateName: US_STATES_MAP[s.state!] ?? s.state ?? "Unknown",
      totalScraped: s._count.id,
      latestScrapedAt: latestScrapedAt?.toISOString() ?? null,
      freshness,
    };
  });
}

export async function getScraperFeed() {
  const agents = await db.agent.findMany({
    where: { dataSource: "SCRAPER_ENGINE" },
    orderBy: { scrapedAt: "desc" },
    take: 20,
    select: {
      id: true,
      fullName: true,
      brokerageName: true,
      city: true,
      state: true,
      email: true,
      phone: true,
      isDeliverable: true,
      scrapedAt: true,
    },
  });

  return agents;
}

export type ScraperStats = Awaited<ReturnType<typeof getScraperStats>>;
export type ScraperDailyTrend = Awaited<ReturnType<typeof getScraperDailyTrend>>;
export type ScraperCoverage = Awaited<ReturnType<typeof getScraperCoverage>>;
export type ScraperFeed = Awaited<ReturnType<typeof getScraperFeed>>;