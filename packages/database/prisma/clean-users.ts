import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanUserData() {
  console.log("🧹 Starting User & Purchase Data Cleanup...");

  // 1. Delete dependent relations first (or cascade via User delete)
  await prisma.unlockedLead.deleteMany({});
  console.log("✓ Cleared UnlockedLead table");

  await prisma.walletTransaction.deleteMany({});
  console.log("✓ Cleared WalletTransaction table");

  await prisma.leadExport.deleteMany({});
  console.log("✓ Cleared LeadExport table");

  await prisma.leadPurchase.deleteMany({});
  console.log("✓ Cleared LeadPurchase table");

  await prisma.session.deleteMany({});
  console.log("✓ Cleared Sessions");

  await prisma.account.deleteMany({});
  console.log("✓ Cleared OAuth Accounts");

  // 2. Delete all Users
  const deletedUsers = await prisma.user.deleteMany({});
  console.log(`✓ Deleted all ${deletedUsers.count} users`);

  // 3. Keep Agent table intact
  const agentCount = await prisma.agent.count();
  console.log(`🛡️ Scraped Agent records preserved: ${agentCount} agents`);

  console.log("✨ Database cleanup complete! Ready for fresh registrations.");
}

cleanUserData()
  .catch((e) => {
    console.error("Cleanup error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
