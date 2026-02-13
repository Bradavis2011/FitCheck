/**
 * Migration Script: Move Base64 Images to S3
 *
 * This script migrates existing outfit images from PostgreSQL (base64 text)
 * to AWS S3 storage, reducing database size and improving performance.
 *
 * Usage:
 *   npm run migrate:s3
 *
 * Options:
 *   --dry-run    Show what would be migrated without making changes
 *   --batch-size Number of outfits to process at once (default: 10)
 *   --limit      Maximum number of outfits to migrate (default: all)
 *
 * Example:
 *   npm run migrate:s3 -- --dry-run
 *   npm run migrate:s3 -- --batch-size=5 --limit=100
 */

import { prisma } from '../src/utils/prisma.js';
import { uploadBuffer } from '../src/services/s3.service.js';
import sharp from 'sharp';

interface MigrationStats {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  bytesFreed: number;
}

const stats: MigrationStats = {
  total: 0,
  processed: 0,
  succeeded: 0,
  failed: 0,
  skipped: 0,
  bytesFreed: 0,
};

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const batchSize = parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '10');
const limit = parseInt(args.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '0');

async function generateThumbnail(base64Image: string): Promise<Buffer> {
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  const thumbnail = await sharp(buffer)
    .resize(200, null, { fit: 'inside' })
    .jpeg({ quality: 60 })
    .toBuffer();

  return thumbnail;
}

async function migrateOutfit(outfit: any): Promise<boolean> {
  try {
    console.log(`\n📸 Migrating outfit ${outfit.id}...`);

    let imageUrl: string | null = null;
    let thumbnailUrl: string | null = null;
    let bytesFreed = 0;

    // Migrate original image if exists
    if (outfit.imageData) {
      const base64Data = outfit.imageData.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');
      bytesFreed += outfit.imageData.length;

      if (!dryRun) {
        const originalKey = `outfits/${outfit.userId}/${outfit.id}/original.jpg`;
        imageUrl = await uploadBuffer(imageBuffer, originalKey, 'image/jpeg');
        console.log(`  ✓ Uploaded original image (${(imageBuffer.length / 1024).toFixed(1)}KB)`);
      } else {
        console.log(`  [DRY RUN] Would upload original image (${(imageBuffer.length / 1024).toFixed(1)}KB)`);
        imageUrl = `https://s3.example.com/outfits/${outfit.userId}/${outfit.id}/original.jpg`;
      }
    }

    // Migrate thumbnail if exists, otherwise generate from original
    if (outfit.thumbnailData) {
      const base64Data = outfit.thumbnailData.replace(/^data:image\/\w+;base64,/, '');
      const thumbnailBuffer = Buffer.from(base64Data, 'base64');
      bytesFreed += outfit.thumbnailData.length;

      if (!dryRun) {
        const thumbnailKey = `outfits/${outfit.userId}/${outfit.id}/thumbnail.jpg`;
        thumbnailUrl = await uploadBuffer(thumbnailBuffer, thumbnailKey, 'image/jpeg');
        console.log(`  ✓ Uploaded thumbnail (${(thumbnailBuffer.length / 1024).toFixed(1)}KB)`);
      } else {
        console.log(`  [DRY RUN] Would upload thumbnail (${(thumbnailBuffer.length / 1024).toFixed(1)}KB)`);
        thumbnailUrl = `https://s3.example.com/outfits/${outfit.userId}/${outfit.id}/thumbnail.jpg`;
      }
    } else if (outfit.imageData && imageUrl) {
      // Generate thumbnail from original
      const thumbnailBuffer = await generateThumbnail(outfit.imageData);

      if (!dryRun) {
        const thumbnailKey = `outfits/${outfit.userId}/${outfit.id}/thumbnail.jpg`;
        thumbnailUrl = await uploadBuffer(thumbnailBuffer, thumbnailKey, 'image/jpeg');
        console.log(`  ✓ Generated and uploaded thumbnail (${(thumbnailBuffer.length / 1024).toFixed(1)}KB)`);
      } else {
        console.log(`  [DRY RUN] Would generate and upload thumbnail (${(thumbnailBuffer.length / 1024).toFixed(1)}KB)`);
        thumbnailUrl = `https://s3.example.com/outfits/${outfit.userId}/${outfit.id}/thumbnail.jpg`;
      }
    }

    // Update database record
    if (!dryRun && (imageUrl || thumbnailUrl)) {
      await prisma.outfitCheck.update({
        where: { id: outfit.id },
        data: {
          imageUrl: imageUrl || outfit.imageUrl,
          thumbnailUrl: thumbnailUrl || outfit.thumbnailUrl,
          // Null out base64 data to free space
          imageData: null,
          thumbnailData: null,
        },
      });
      console.log(`  ✓ Updated database record`);
    } else if (dryRun) {
      console.log(`  [DRY RUN] Would update database and null base64 data`);
    }

    stats.bytesFreed += bytesFreed;
    console.log(`  💾 Freed ${(bytesFreed / 1024).toFixed(1)}KB from database`);

    return true;
  } catch (error) {
    console.error(`  ❌ Failed to migrate outfit ${outfit.id}:`, error);
    return false;
  }
}

async function main() {
  console.log('\n🚀 S3 Migration Script');
  console.log('======================\n');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  console.log(`Settings:`);
  console.log(`  Batch size: ${batchSize}`);
  console.log(`  Limit: ${limit || 'all'}`);
  console.log('');

  // Verify S3 is configured
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET) {
    console.error('❌ S3 is not configured. Please set AWS environment variables in .env');
    process.exit(1);
  }

  console.log('✓ S3 configuration found\n');

  // Find outfits that need migration
  const where = {
    OR: [
      { imageData: { not: null } },
      { thumbnailData: { not: null } },
    ],
    AND: [
      { imageUrl: null },
      { thumbnailUrl: null },
    ],
  };

  stats.total = await prisma.outfitCheck.count({ where });

  console.log(`Found ${stats.total} outfits to migrate\n`);

  if (stats.total === 0) {
    console.log('✨ No outfits need migration. All done!');
    process.exit(0);
  }

  // Process in batches
  const maxToProcess = limit > 0 ? Math.min(limit, stats.total) : stats.total;
  let offset = 0;

  while (offset < maxToProcess) {
    const batch = await prisma.outfitCheck.findMany({
      where,
      take: batchSize,
      skip: offset,
      select: {
        id: true,
        userId: true,
        imageData: true,
        thumbnailData: true,
        imageUrl: true,
        thumbnailUrl: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (batch.length === 0) break;

    console.log(`\n📦 Processing batch ${Math.floor(offset / batchSize) + 1} (${offset + 1}-${offset + batch.length} of ${maxToProcess})`);

    for (const outfit of batch) {
      stats.processed++;

      // Skip if already has S3 URLs
      if (outfit.imageUrl && outfit.thumbnailUrl) {
        console.log(`⏭️  Skipping ${outfit.id} (already has S3 URLs)`);
        stats.skipped++;
        continue;
      }

      // Skip if no data to migrate
      if (!outfit.imageData && !outfit.thumbnailData) {
        console.log(`⏭️  Skipping ${outfit.id} (no image data)`);
        stats.skipped++;
        continue;
      }

      const success = await migrateOutfit(outfit);
      if (success) {
        stats.succeeded++;
      } else {
        stats.failed++;
      }

      // Progress update
      const progress = ((stats.processed / maxToProcess) * 100).toFixed(1);
      console.log(`Progress: ${stats.processed}/${maxToProcess} (${progress}%)`);
    }

    offset += batch.length;
  }

  // Final summary
  console.log('\n\n📊 Migration Summary');
  console.log('===================');
  console.log(`Total found:       ${stats.total}`);
  console.log(`Processed:         ${stats.processed}`);
  console.log(`Succeeded:         ${stats.succeeded} ✓`);
  console.log(`Failed:            ${stats.failed} ✗`);
  console.log(`Skipped:           ${stats.skipped} ⏭️`);
  console.log(`Database freed:    ${(stats.bytesFreed / 1024 / 1024).toFixed(2)}MB`);

  if (dryRun) {
    console.log('\n💡 This was a dry run. Run without --dry-run to perform the migration.');
  } else {
    console.log('\n✨ Migration complete!');
    console.log('\n⚠️  Remember to run VACUUM FULL on your database to reclaim space:');
    console.log('   psql $DATABASE_URL -c "VACUUM FULL outfit_checks;"');
  }
}

main()
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
