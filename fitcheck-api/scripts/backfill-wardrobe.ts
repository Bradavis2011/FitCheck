/**
 * One-time backfill script: syncs garments from all existing StyleDNA records
 * into the wardrobe_items + wardrobe_item_outfits tables.
 *
 * Run after `npx prisma migrate deploy`:
 *   npx ts-node --esm scripts/backfill-wardrobe.ts
 * or via tsx:
 *   npx tsx scripts/backfill-wardrobe.ts
 *
 * Idempotent — safe to re-run.
 */

import { PrismaClient } from '@prisma/client';
import { syncGarmentsToWardrobe } from '../src/services/wardrobe-sync.service.js';

const prisma = new PrismaClient();

async function main() {
  console.log('[Backfill] Starting wardrobe backfill from StyleDNA records...');

  const records = await prisma.styleDNA.findMany({
    select: {
      outfitCheckId: true,
      userId: true,
      garments: true,
      dominantColors: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`[Backfill] Found ${records.length} StyleDNA records to process`);

  let processed = 0;
  let errors = 0;

  for (const record of records) {
    try {
      if (record.garments && record.garments.length > 0) {
        await syncGarmentsToWardrobe(
          record.userId,
          record.outfitCheckId,
          record.garments,
          record.dominantColors
        );
        processed++;
        if (processed % 50 === 0) {
          console.log(`[Backfill] Processed ${processed}/${records.length}`);
        }
      }
    } catch (err) {
      errors++;
      console.error(`[Backfill] Error on outfitCheckId=${record.outfitCheckId}:`, err);
    }
  }

  console.log(`[Backfill] Done. Processed: ${processed}, Errors: ${errors}`);
}

main()
  .catch((err) => {
    console.error('[Backfill] Fatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
