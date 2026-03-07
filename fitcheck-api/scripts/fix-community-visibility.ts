/**
 * One-time backfill: set user.isPublic = true for any user who has
 * at least one outfit with isPublic = true but whose own profile is still private.
 *
 * Run once: npx ts-node scripts/fix-community-visibility.ts
 */
import { prisma } from '../src/utils/prisma.js';

async function main() {
  // Find all users who have at least one public outfit but isPublic = false on their profile
  const usersWithPublicOutfits = await prisma.user.findMany({
    where: {
      isPublic: false,
      outfitChecks: {
        some: { isPublic: true, isDeleted: false },
      },
    },
    select: { id: true, username: true },
  });

  console.log(`Found ${usersWithPublicOutfits.length} user(s) to fix.`);

  if (usersWithPublicOutfits.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  const ids = usersWithPublicOutfits.map((u) => u.id);
  const result = await prisma.user.updateMany({
    where: { id: { in: ids } },
    data: { isPublic: true },
  });

  console.log(`Updated ${result.count} user(s):`);
  usersWithPublicOutfits.forEach((u) => console.log(`  - ${u.username || u.id}`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
