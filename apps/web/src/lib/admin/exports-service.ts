import { db } from "@fine-leads/database";
import type { ExportStatus } from "@fine-leads/database";

export interface AdminExportsQuery {
  status?: ExportStatus;
  page?: number;
  limit?: number;
}

export async function getAdminExports(query: AdminExportsQuery) {
  const { status, page = 1, limit = 25 } = query;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (status) {
    where.status = status;
  }

  const [exports, total] = await Promise.all([
    db.leadExport.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
    db.leadExport.count({ where }),
  ]);

  return {
    exports,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getExportStats() {
  const [total, processing, failed, completed] = await Promise.all([
    db.leadExport.count(),
    db.leadExport.count({ where: { status: "PROCESSING" } }),
    db.leadExport.count({ where: { status: "FAILED" } }),
    db.leadExport.count({ where: { status: "COMPLETED" } }),
  ]);

  return {
    total,
    processing,
    failed,
    completed,
  };
}