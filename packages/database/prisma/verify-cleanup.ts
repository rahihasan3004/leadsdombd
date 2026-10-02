import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verify() {
  const users = await prisma.user.count();
  const purchases = await prisma.leadPurchase.count();
  const unlocked = await prisma.unlockedLead.count();
  const wallets = await prisma.walletTransaction.count();
  const exports = await prisma.leadExport.count();
  const agents = await prisma.agent.count();

  console.log("📊 Post-Cleanup Verification:");
  console.log(`  Users:            ${users}`);
  console.log(`  LeadPurchases:    ${purchases}`);
  console.log(`  UnlockedLeads:    ${unlocked}`);
  console.log(`  WalletTxns:       ${wallets}`);
  console.log(`  LeadExports:      ${exports}`);
  console.log(`  Agents (kept):    ${agents}`);

  const allZero = users === 0 && purchases === 0 && unlocked === 0 && wallets === 0 && exports === 0;
  console.log(allZero ? "✅ All user data cleared, agents preserved." : "❌ Something is not zero.");
  process.exit(allZero ? 0 : 1);
}

verify().finally(() => prisma.$disconnect());
