const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const agents = await prisma.agent.findMany({
      take: 15,
      orderBy: { createdAt: 'desc' },
      select: {
        state: true,
        city: true,
        email: true,
        isDeliverable: true,
        createdAt: true,
        fullName: true,
        id: true,
        googleMapsLink: true,
        brokerageAddress: true,
        dataSource: true,
        scrapedAt: true,
        googlePlaceId: true,
      }
    });
    console.log(JSON.stringify(agents, null, 2));
  } catch (e) {
    console.error('ERROR:', e);
  } finally {
    await prisma.$disconnect();
  }
})();
