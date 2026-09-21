import { db } from "@fine-leads/database";
import type { Prisma } from "@fine-leads/database";

export interface AdminAgentsQuery {
  q?: string;
  state?: string;
  city?: string;
  isDeliverable?: string;
  dataSource?: string;
  page?: number;
  limit?: number;
}

export interface AgentUpdateData {
  fullName?: string;
  email?: string;
  phone?: string;
  brokerageName?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  isDeliverable?: boolean;
  verificationScore?: number;
  licenseNumber?: string;
}

export interface CsvImportRow {
  fullName?: string;
  email?: string;
  phone?: string;
  state?: string;
  city?: string;
  brokerageName?: string;
  licenseNumber?: string;
  zipCode?: string;
  googlePlaceId?: string;
}

export interface ImportResult {
  importedCount: number;
  updatedCount: number;
  failedCount: number;
  errors: { row: number; message: string }[];
}

export async function getAdminAgents(query: AdminAgentsQuery) {
  const { q, state, city, isDeliverable, dataSource, page = 1, limit = 25 } = query;
  const skip = (page - 1) * limit;
  const take = Math.min(limit, 100);

  const where: Prisma.AgentWhereInput = {};
  const andConditions: Prisma.AgentWhereInput[] = [];

  if (q) {
    andConditions.push({
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { brokerageName: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (state) {
    andConditions.push({ state: state.toUpperCase() });
  }

  if (city) {
    andConditions.push({ city: { contains: city, mode: "insensitive" } });
  }

  if (isDeliverable === "true") {
    andConditions.push({ isDeliverable: true });
  } else if (isDeliverable === "false") {
    andConditions.push({ isDeliverable: false });
  }

  if (dataSource) {
    andConditions.push({ dataSource });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const [agents, total] = await Promise.all([
    db.agent.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
    }),
    db.agent.count({ where }),
  ]);

  return {
    agents,
    pagination: {
      page,
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
    },
  };
}

export async function getAdminAgentDetail(agentId: string) {
  const agent = await db.agent.findUnique({
    where: { id: agentId },
    include: {
      agentActivities: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!agent) {
    throw new Error("Agent not found");
  }

  return agent;
}

export async function updateAdminAgent(agentId: string, data: AgentUpdateData) {
  const agent = await db.agent.findUnique({ where: { id: agentId } });
  if (!agent) {
    throw new Error("Agent not found");
  }

  return db.agent.update({
    where: { id: agentId },
    data,
  });
}

export async function deleteAdminAgent(agentId: string) {
  const agent = await db.agent.findUnique({ where: { id: agentId } });
  if (!agent) {
    throw new Error("Agent not found");
  }

  await db.agent.delete({ where: { id: agentId } });
  return { deleted: true, agentId };
}

export async function importAgents(rows: CsvImportRow[]): Promise<ImportResult> {
  const errors: { row: number; message: string }[] = [];
  let importedCount = 0;
  let updatedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

if (!row.fullName?.trim()) {
        errors.push({ row: rowNum, message: "Missing fullName" });
        failedCount++;
        continue;
      }

      const hasEmail = !!row.email?.trim();
      const hasGooglePlaceId = !!row.googlePlaceId?.trim();

      if (!hasEmail && !hasGooglePlaceId) {
        errors.push({ row: rowNum, message: "Missing email and googlePlaceId" });
        failedCount++;
        continue;
      }

      try {
        const orConditions: Prisma.AgentWhereInput[] = [];
        if (hasEmail) {
          orConditions.push({ email: row.email!.trim() });
        }
        if (hasGooglePlaceId) {
          orConditions.push({ googlePlaceId: row.googlePlaceId!.trim() });
        }

        const existing = await db.agent.findFirst({
          where: { OR: orConditions },
        });

      const agentData = {
        fullName: row.fullName.trim(),
        email: row.email?.trim() || null,
        phone: row.phone?.trim() || null,
        state: row.state?.trim().toUpperCase() || null,
        city: row.city?.trim() || null,
        brokerageName: row.brokerageName?.trim() || null,
        licenseNumber: row.licenseNumber?.trim() || null,
        zipCode: row.zipCode?.trim() || null,
        googlePlaceId: row.googlePlaceId?.trim() || null,
        dataSource: "BULK_IMPORT",
        isVerified: true,
        isDeliverable: true,
      };

      if (existing) {
        await db.agent.update({
          where: { id: existing.id },
          data: agentData,
        });
        updatedCount++;
      } else {
        await db.agent.create({
          data: agentData,
        });
        importedCount++;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      errors.push({ row: rowNum, message });
      failedCount++;
    }
  }

  return { importedCount, updatedCount, failedCount, errors };
}