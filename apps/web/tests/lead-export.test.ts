import { beforeEach, describe, expect, it, vi } from "vitest";
import { inflateRawSync } from "node:zlib";
import ExcelJS from "exceljs";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  purchase: vi.fn(),
  count: vi.fn(),
  batch: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@fine-leads/auth", () => ({ auth: m.auth }));
vi.mock("@fine-leads/database", () => ({
  db: {
    leadPurchase: { findFirst: m.purchase },
    unlockedLead: { count: m.count, findMany: m.batch },
    leadExport: { create: m.create, update: m.update },
  },
}));
import { GET } from "../app/api/exports/stream/route";
import { csvCell } from "@/lib/lead-export";
import {
  normalizeExportStates,
  parseExportOptions,
} from "@/lib/export-options";
const lead = (
  id: string,
  state: string,
  tier: "PHONE_ONLY" | "VERIFIED_EMAIL" = "VERIFIED_EMAIL",
) => ({
  id,
  purchase: { tier },
  agent: {
    fullName: "Agent",
    brokerageName: "Realty",
    phone: "2125551234",
    category: "Real Estate",
    brokerageAddress: "1 Main St",
    city: "City",
    state,
    zipCode: "02108",
    timezone: "EST",
    websiteUrl: "https://example.com",
    email: `secret-${id}@example.com`,
    emailStatus: "validated",
    isDeliverable: true,
    googlePlaceId: id,
    dataSource: "TEST",
    rating: 4.5,
    reviewCount: 3,
    scrapedAt: new Date("2026-01-01"),
    googleMapsLink: "https://maps.example",
    bio: `secret-${id}@example.com`,
    socialProfiles: { email: `secret-${id}@example.com` },
  },
});
const req = (query: string) =>
  new Request(`https://app.test/api/exports/stream?${query}`);
function unzipRaw(bytes: Buffer) {
  const entries = new Map<string, Buffer>();
  let end = bytes.length - 22;
  while (end >= 0 && bytes.readUInt32LE(end) !== 0x06054b50) end--;
  expect(end).toBeGreaterThanOrEqual(0);
  const total = bytes.readUInt16LE(end + 10);
  let position = bytes.readUInt32LE(end + 16);
  for (let i = 0; i < total; i++) {
    expect(bytes.readUInt32LE(position)).toBe(0x02014b50);
    const method = bytes.readUInt16LE(position + 10),
      size = bytes.readUInt32LE(position + 20),
      nameLength = bytes.readUInt16LE(position + 28),
      extra = bytes.readUInt16LE(position + 30),
      comment = bytes.readUInt16LE(position + 32),
      local = bytes.readUInt32LE(position + 42);
    const name = bytes
      .subarray(position + 46, position + 46 + nameLength)
      .toString();
    expect(bytes.readUInt32LE(local)).toBe(0x04034b50);
    const offset =
      local +
      30 +
      bytes.readUInt16LE(local + 26) +
      bytes.readUInt16LE(local + 28);
    const raw = bytes.subarray(offset, offset + size);
    entries.set(name, method === 8 ? inflateRawSync(raw) : raw);
    position += 46 + nameLength + extra + comment;
  }
  return entries;
}
function unzip(bytes: Buffer) {
  return new Map(
    [...unzipRaw(bytes)].map(([name, bytes]) => [name, bytes.toString()]),
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ user: { id: "user" } });
  m.purchase.mockResolvedValue({ id: "p1" });
  m.count.mockResolvedValue(2);
  m.batch.mockResolvedValue([lead("u1", "TX", "PHONE_ONLY"), lead("u2", "GA")]);
  m.create.mockResolvedValue({ id: "export1" });
  m.update.mockResolvedValue({});
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
describe("multi-state safe lead exports", () => {
  it.each(["state=TX,GA", "states=tx,ga", "state=TX&state=GA"])(
    "combines %s in one correctly named CSV",
    async (query) => {
      const response = await GET(req(`${query}&purchaseId=p1`));
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe(
        "text/csv; charset=utf-8",
      );
      expect(response.headers.get("Content-Disposition")).toMatch(
        /leadsdom-export-all-\d+\.csv/,
      );
      const csv = await response.text();
      expect(csv).toContain('"TX"');
      expect(csv).toContain('"GA"');
      expect(csv).not.toContain("secret-u1@example.com");
      expect(csv).toContain("secret-u2@example.com");
      expect(m.batch.mock.calls[0]![0].where).toMatchObject({
        userId: "user",
        purchaseId: "p1",
        purchase: { status: "COMPLETED" },
        agent: { state: { in: ["TX", "GA"] } },
      });
    },
  );
  it.each(["ALL", "All States", "all_states"])(
    "accepts %s without a two-character state crash",
    async (state) => {
      const response = await GET(
        req(`state=${encodeURIComponent(state)}&purchaseId=p1`),
      );
      expect(response.status).toBe(200);
      await response.text();
      expect(m.count.mock.calls[0]![0].where.agent).toBeUndefined();
      expect(m.count.mock.calls[0]![0].where.purchaseId).toBe("p1");
    },
  );
  it("allows an owned purchase-only URL and retains exact order scope", async () => {
    const response = await GET(req("purchaseId=p1"));
    expect(response.status).toBe(200);
    await response.text();
    expect(m.count.mock.calls[0]![0].where).toEqual({
      userId: "user",
      purchaseId: "p1",
      purchase: { status: "COMPLETED" },
    });
  });
  it("produces a valid combined JSON array with per-row tier redaction", async () => {
    const response = await GET(req("states=TX,GA&purchaseId=p1&format=json"));
    expect(response.headers.get("Content-Type")).toBe(
      "application/json; charset=utf-8",
    );
    const rows = await response.json();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      email: null,
      leadTier: "PHONE_ONLY",
      zipCode: "02108",
    });
    expect(rows[1].email).toBe("secret-u2@example.com");
    expect(JSON.stringify(rows[0])).not.toContain("secret-u1@example.com");
    expect(rows[0].bio).toBeUndefined();
    expect(rows[0].socialProfiles).toBeUndefined();
  });
  it.each(["csv", "json"])(
    "creates a valid split ZIP containing redacted %s files",
    async (format) => {
      const response = await GET(
        req(`states=TX,GA&purchaseId=p1&format=${format}&grouping=split`),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/zip");
      const bytes = Buffer.from(await response.arrayBuffer());
      expect(Number(response.headers.get("Content-Length"))).toBe(bytes.length);
      const files = unzip(bytes);
      expect([...files.keys()].sort()).toEqual([
        `Georgia.${format}`,
        `Texas.${format}`,
      ]);
      expect(files.get(`Texas.${format}`)).not.toContain(
        "secret-u1@example.com",
      );
      expect(files.get(`Georgia.${format}`)).toContain("secret-u2@example.com");
      if (format === "json")
        expect(JSON.parse(files.get("Texas.json")!)[0].email).toBeNull();
      expect(m.create.mock.calls[0]![0].data.searchQuery.container).toBe("ZIP");
    },
  );
  it("streams a fully prepared file without further database reads", async () => {
    const response = await GET(req("state=ALL"));
    const calls = m.batch.mock.calls.length;
    m.batch.mockRejectedValue(new Error("DB unavailable after preparation"));
    const bytes = await response.arrayBuffer();
    expect(bytes.byteLength).toBe(
      Number(response.headers.get("Content-Length")),
    );
    expect(m.batch).toHaveBeenCalledTimes(calls);
  });
  it("returns a safe JSON error before attachment headers on a later-page database failure", async () => {
    m.count.mockResolvedValue(1001);
    m.batch
      .mockResolvedValueOnce(
        Array.from({ length: 1000 }, (_, i) => lead(`u${i}`, "TX")),
      )
      .mockRejectedValueOnce(new Error("secret database detail"));
    const response = await GET(req("state=ALL"));
    expect(response.status).toBe(503);
    expect(response.headers.get("Content-Disposition")).toBeNull();
    expect(JSON.stringify(await response.json())).not.toContain(
      "secret database detail",
    );
    expect(m.update).toHaveBeenCalledWith({
      where: { id: "export1" },
      data: { status: "FAILED" },
    });
  });
  it("retries a transient database page error without duplicating rows", async () => {
    m.batch
      .mockRejectedValueOnce({ code: "P1001" })
      .mockResolvedValueOnce([lead("u1", "TX"), lead("u2", "GA")]);
    const response = await GET(req("state=ALL&format=json"));
    expect(await response.json()).toHaveLength(2);
    expect(m.batch).toHaveBeenCalledTimes(2);
  });
  it("does not cut off a valid file if audit completion tracking fails", async () => {
    m.update.mockRejectedValue(new Error("audit down"));
    const response = await GET(req("state=ALL"));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("secret-u2@example.com");
  });
  it("detects a shrinking inventory before returning a partial attachment", async () => {
    m.count.mockResolvedValue(3);
    const response = await GET(req("state=ALL"));
    expect(response.status).toBe(409);
    expect(response.headers.get("Content-Disposition")).toBeNull();
  });
  it.each([
    "state=ZZ",
    "state=ALL,ZZ",
    "state=TX&format=exe",
    "state=TX&grouping=../../etc",
  ])("rejects invalid options %s before database work", async (query) => {
    expect((await GET(req(query))).status).toBe(400);
    expect(m.count).not.toHaveBeenCalled();
  });
  it("requires authentication and refuses foreign or incomplete orders", async () => {
    m.auth.mockResolvedValueOnce(null);
    expect((await GET(req("state=ALL"))).status).toBe(401);
    m.purchase.mockResolvedValue(null);
    expect((await GET(req("state=ALL&purchaseId=foreign"))).status).toBe(403);
    expect(m.count).not.toHaveBeenCalled();
  });
  it("bounds exports instead of risking temporary disk exhaustion", async () => {
    m.count.mockResolvedValue(100001);
    expect((await GET(req("state=ALL"))).status).toBe(413);
    expect(m.batch).not.toHaveBeenCalled();
  });
  it("sanitizes formula cells and rejects missing unscoped state parameters", () => {
    expect(csvCell('=HYPERLINK("bad")')).toContain("'=HYPERLINK");
    expect(csvCell("@SUM(1+1)")).toBe('"\'@SUM(1+1)"');
    expect(() => parseExportOptions(new URLSearchParams())).toThrow();
    expect(normalizeExportStates(["tx,TX, ga"])).toEqual({
      all: false,
      states: ["TX", "GA"],
    });
  });
  it("preserves authorized unknown states in a safe ZIP entry without path injection", async () => {
    m.count.mockResolvedValue(1);
    m.batch.mockResolvedValue([lead("u1", "../../outside", "PHONE_ONLY")]);
    const response = await GET(req("state=ALL&format=json&grouping=split"));
    expect(response.status).toBe(200);
    const files = unzip(Buffer.from(await response.arrayBuffer()));
    expect([...files.keys()]).toEqual(["Unknown-State.json"]);
    expect(files.get("Unknown-State.json")).not.toContain(
      "secret-u1@example.com",
    );
  });

  it.each(["csv", "json"])(
    "strips duplicate contact emails from allowed phone-only text fields in %s",
    async (format) => {
      const record = lead("u1", "TX", "PHONE_ONLY");
      record.agent.brokerageName = "Realty secret-u1@example.com";
      record.agent.websiteUrl =
        "https://example.com?contact=secret-u1%40example.com";
      m.count.mockResolvedValue(1);
      m.batch.mockResolvedValue([record]);
      const response = await GET(req("state=TX&format=" + format));
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).not.toContain("secret-u1@example.com");
      expect(text).not.toContain("secret-u1%40example.com");
      expect(text).toContain("Realty");
    },
  );
  it.each([
    ["PHONE_ONLY", "csv", "combined"],
    ["PHONE_ONLY", "csv", "split"],
    ["PHONE_ONLY", "json", "combined"],
    ["PHONE_ONLY", "json", "split"],
    ["VERIFIED_EMAIL", "csv", "combined"],
    ["VERIFIED_EMAIL", "csv", "split"],
    ["VERIFIED_EMAIL", "json", "combined"],
    ["VERIFIED_EMAIL", "json", "split"],
  ] as const)(
    "enforces %s bonus access in %s %s exports",
    async (tier, format, grouping) => {
      const bonus = {
        linkedin: "https://linkedin.com/in/customer",
        facebook: "https://facebook.com/customer",
        instagram: "https://instagram.com/customer",
        whatsapp: "https://wa.me/12125551234",
        twitter: "https://x.com/customer",
        tiktok: "https://tiktok.com/@customer",
        youtube: "https://youtube.com/@customer",
      };
      const source = lead("social", "TX", tier);
      const record = {
        ...source,
        agent: {
          ...source.agent,
          socialProfiles: {
            ...bonus,
            _lobstr: { nameForEmails: "internal-only@example.com" },
            email: "hidden-metadata@example.com",
          },
        },
      };
      m.purchase.mockResolvedValue({ id: "p1", tier });
      m.count.mockResolvedValue(1);
      m.batch.mockResolvedValue([record]);
      const response = await GET(
        req(
          "purchaseId=p1&state=TX&format=" +
            format +
            "&grouping=" +
            grouping +
            "&tier=VERIFIED_EMAIL&includeSocial=true",
        ),
      );
      expect(response.status).toBe(200);
      const text =
        grouping === "split"
          ? unzip(Buffer.from(await response.arrayBuffer())).get(
              "Texas." + format,
            )!
          : await response.text();
      expect(text).not.toContain("internal-only@example.com");
      expect(text).not.toContain("hidden-metadata@example.com");
      if (tier === "PHONE_ONLY") {
        for (const url of Object.values(bonus)) expect(text).not.toContain(url);
        expect(text).not.toContain("secret-social@example.com");
        if (format === "csv")
          expect(text.split(String.fromCharCode(10))[0]).not.toContain(
            "LinkedIn",
          );
        else expect(JSON.parse(text)[0]).not.toHaveProperty("socialProfiles");
      } else {
        for (const url of Object.values(bonus)) expect(text).toContain(url);
        expect(text).toContain("secret-social@example.com");
        if (format === "csv") expect(text).toContain("LinkedIn Profile");
        else expect(JSON.parse(text)[0].socialProfiles).toEqual(bonus);
      }
    },
  );
  it.each(["csv", "json"])(
    "keeps phone rows empty and full rows enriched in mixed-tier %s exports",
    async (format) => {
      const phone = lead("p", "TX", "PHONE_ONLY"),
        full = lead("f", "GA");
      m.batch.mockResolvedValue([
        {
          ...phone,
          agent: {
            ...phone.agent,
            socialProfiles: {
              linkedin: "https://linkedin.com/in/phone-private",
            },
          },
        },
        {
          ...full,
          agent: {
            ...full.agent,
            socialProfiles: {
              linkedin: "https://linkedin.com/in/full-visible",
            },
          },
        },
      ]);
      const response = await GET(req("state=ALL&format=" + format));
      const text = await response.text();
      expect(text).not.toContain("phone-private");
      expect(text).toContain("full-visible");
      if (format === "json")
        expect(JSON.parse(text)[0]).not.toHaveProperty("socialProfiles");
    },
  );
  it.each(["PHONE_ONLY", "VERIFIED_EMAIL"] as const)(
    "enforces %s access in Excel, split Excel ZIP and Google Sheets TSV",
    async (tier) => {
      const record = lead("excel", "TX", tier);
      const profiles = {
        linkedin: "https://linkedin.com/in/bonus",
        facebook: "https://facebook.com/bonus",
      };
      m.purchase.mockResolvedValue({ id: "p1", tier });
      m.count.mockResolvedValue(1);
      m.batch.mockResolvedValue([
        { ...record, agent: { ...record.agent, socialProfiles: profiles } },
      ]);
      for (const grouping of ["combined", "split"] as const) {
        const response = await GET(
          req(`purchaseId=p1&format=xlsx&grouping=${grouping}`),
        );
        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toBe(
          grouping === "split"
            ? "application/zip"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        let bytes: Buffer = Buffer.from(await response.arrayBuffer());
        if (grouping === "split") bytes = unzipRaw(bytes).get("Texas.xlsx")!;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(
          bytes as unknown as Parameters<typeof workbook.xlsx.load>[0],
        );
        const sheet = workbook.worksheets[0]!;
        expect(sheet.name).toBe("Leads");
        expect(sheet.rowCount).toBe(2);
        expect(sheet.getCell("G2").value).toBe("02108");
        expect(sheet.getCell("B2").type).toBe(ExcelJS.ValueType.String);
        expect(sheet.getCell("N2").value).toBe(3);
        expect(sheet.getCell("O2").value).toBe(4.5);
        expect(sheet.getCell("P2").value).toBeInstanceOf(Date);
        expect(sheet.views[0]?.state).toBe("frozen");
        const values = JSON.stringify(sheet.getSheetValues());
        if (tier === "PHONE_ONLY") {
          expect(values).not.toContain("secret-excel@example.com");
          expect(values).not.toContain("linkedin.com");
          expect(sheet.columnCount).toBe(17);
        } else {
          expect(values).toContain("secret-excel@example.com");
          expect(values).toContain(profiles.linkedin);
          expect(sheet.columnCount).toBe(28);
        }
      }
      const response = await GET(req("purchaseId=p1&format=tsv"));
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe(
        "text/tab-separated-values; charset=utf-8",
      );
      const table = await response.text();
      const rows = table
        .replace(/\r\n$/, "")
        .split("\r\n")
        .map((line) => line.split("\t"));
      expect(rows[1]![6]).toBe("'02108");
      expect(rows[0]!.length).toBe(rows[1]!.length);
      if (tier === "PHONE_ONLY") {
        expect(table).not.toContain("secret-excel@example.com");
        expect(table).not.toContain("linkedin.com");
      } else {
        expect(table).toContain("secret-excel@example.com");
        expect(table).toContain(profiles.linkedin);
      }
    },
  );
  it("stores Excel as EXCEL and builds distinct state workbooks in one ZIP", async () => {
    const response = await GET(req("state=ALL&format=xlsx&grouping=split"));
    const files = unzipRaw(Buffer.from(await response.arrayBuffer()));
    expect([...files.keys()].sort()).toEqual(["Georgia.xlsx", "Texas.xlsx"]);
    expect(m.create.mock.calls[0]![0].data.format).toBe("EXCEL");
    for (const bytes of files.values()) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(
        bytes as unknown as Parameters<typeof wb.xlsx.load>[0],
      );
      expect(wb.worksheets[0]!.rowCount).toBe(2);
    }
  });
  it("keeps Excel formula-looking text literal and TSV rows/columns safe", async () => {
    const record = lead("literal", "TX");
    record.agent.brokerageName = '=HYPERLINK("bad")';
    record.agent.brokerageAddress = "Line one\tInjected\nRow two";
    m.count.mockResolvedValue(1);
    m.batch.mockResolvedValue([record]);
    const response = await GET(req("purchaseId=p1&format=xlsx"));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(
      Buffer.from(await response.arrayBuffer()) as unknown as Parameters<
        typeof wb.xlsx.load
      >[0],
    );
    expect(wb.worksheets[0]!.getCell("A2").type).toBe(ExcelJS.ValueType.String);
    expect(wb.worksheets[0]!.getCell("A2").value).toBe(
      record.agent.brokerageName,
    );
    const tsv = await (await GET(req("purchaseId=p1&format=tsv"))).text();
    const rows = tsv.replace(/\r\n$/, "").split("\r\n");
    expect(rows).toHaveLength(2);
    expect(rows[1]!.split("\t")[0]).toBe("'" + record.agent.brokerageName);
    expect(rows[1]!.split("\t")[3]).toBe("Line one Injected Row two");
  });
  it("bounds clipboard copies and refuses split TSV before DB work", async () => {
    m.count.mockResolvedValue(10001);
    expect((await GET(req("purchaseId=p1&format=tsv"))).status).toBe(413);
    expect(m.batch).not.toHaveBeenCalled();
    m.count.mockClear();
    expect(
      (await GET(req("purchaseId=p1&format=tsv&grouping=split"))).status,
    ).toBe(400);
    expect(m.count).not.toHaveBeenCalled();
  });
  it("returns a safe pre-header error when Excel staging queries fail", async () => {
    m.batch.mockRejectedValue(new Error("database secret"));
    const response = await GET(req("purchaseId=p1&format=xlsx"));
    expect(response.status).toBe(503);
    expect(response.headers.get("Content-Disposition")).toBeNull();
    expect(await response.text()).not.toContain("database secret");
  });
  it("fails oversized Excel cells safely before attachment headers", async () => {
    const record = lead("oversized", "TX");
    record.agent.brokerageName = "x".repeat(32768);
    m.count.mockResolvedValue(1);
    m.batch.mockResolvedValue([record]);
    const response = await GET(req("purchaseId=p1&format=xlsx"));
    expect(response.status).toBe(413);
    expect(response.headers.get("Content-Disposition")).toBeNull();
    expect((await response.json()).error).toContain("cell size limit");
  });
});
