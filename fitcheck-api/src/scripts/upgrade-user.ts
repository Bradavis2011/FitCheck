// Quick script to upgrade a user to pro tier
// Run with: npx tsx src/scripts/upgrade-user.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'bradavis2011@gmail.com';

  console.log(`🔍 Looking for user: ${email}...`);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, tier: true, dailyChecksUsed: true }
  });

  if (!user) {
    console.log('❌ User not found. Available users:');
    const allUsers = await prisma.user.findMany({
      select: { email: true, tier: true }
    });
    console.log(allUsers);
    return;
  }

  console.log(`✅ Found user: ${user.email} (current tier: ${user.tier})`);
  console.log(`📊 Upgrading to PRO tier with unlimited access...`);

  const updated = await prisma.user.update({
    where: { email },
    data: {
      tier: 'pro',
      dailyChecksUsed: 0,
      subscriptionExpiresAt: new Date('2099-12-31'),
    },
    select: {
      email: true,
      tier: true,
      dailyChecksUsed: true,
      subscriptionExpiresAt: true,
    }
  });

  console.log('');
  console.log('✅ SUCCESS! User upgraded:');
  console.log('   Email:', updated.email);
  console.log('   Tier:', updated.tier);
  console.log('   Daily Checks Used:', updated.dailyChecksUsed, '(reset to 0)');
  console.log('   Subscription Expires:', updated.subscriptionExpiresAt);
  console.log('');
  console.log('🎉 You now have UNLIMITED outfit checks!');
}

main()
  .catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
