import { db } from "@fine-leads/database";

export async function getAdminOrganizations() {
  const organizations = await db.organization.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      _count: {
        select: { users: true },
      },
    },
  });

  return organizations.map((org) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    memberCount: org._count.users,
    createdAt: org.createdAt,
  }));
}