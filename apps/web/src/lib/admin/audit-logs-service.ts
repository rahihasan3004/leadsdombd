import { db, type Prisma } from "@fine-leads/database";

export interface AdminAuditLogsQuery {
  action?: string;
  resource?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export async function getAdminAuditLogs(query: AdminAuditLogsQuery) {
  const { action, resource, search, page = 1, limit = 25 } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.AuditLogWhereInput = {};

  if (action) {
    where.action = action;
  }

  if (resource) {
    where.resource = resource;
  }

  if (search) {
    const matchedUsers = await db.user.findMany({
      where: { email: { contains: search, mode: "insensitive" } },
      select: { id: true },
    });

    const matchedUserIds = matchedUsers.map((u) => u.id);

    where.OR = [
      { ipAddress: { contains: search, mode: "insensitive" } },
      { resourceId: { contains: search, mode: "insensitive" } },
    ];

    if (matchedUserIds.length > 0) {
      (where.OR as Prisma.AuditLogWhereInput[]).push({
        userId: { in: matchedUserIds },
      });
    }
  }

  const [auditLogs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    db.auditLog.count({ where }),
  ]);

  const userIds = [...new Set(auditLogs.map((log) => log.userId).filter(Boolean))] as string[];

  const users =
    userIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true, image: true },
        })
      : [];

  const userMap = new Map(users.map((u) => [u.id, u]));

  const enrichedLogs = auditLogs.map((log) => ({
    ...log,
    user: log.userId ? userMap.get(log.userId) ?? null : null,
  }));

  return {
    auditLogs: enrichedLogs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}