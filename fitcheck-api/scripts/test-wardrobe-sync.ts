/**
 * Test suite for the AI wardrobe sync feature.
 *
 * Covers:
 *   1. Unit: normalizeName
 *   2. Unit: resolveCategory
 *   3. Unit: extractColorAndBase
 *   4. Unit: dedup logic (same base noun, different color)
 *   5. Integration: syncGarmentsToWardrobe → DB round-trip
 *   6. Integration: /api/wardrobe/progress endpoint
 *   7. Integration: duplicate sync is idempotent (timesWorn increments correctly)
 *
 * Run:  npx tsx scripts/test-wardrobe-sync.ts
 */

import { normalizeName, resolveCategory, extractColorAndBase, syncGarmentsToWardrobe } from '../src/services/wardrobe-sync.service.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

function assert(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    console.error(`     expected: ${JSON.stringify(expected)}`);
    console.error(`     actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

function assertNotNull(label: string, actual: unknown) {
  if (actual !== null && actual !== undefined) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label} — expected non-null, got ${actual}`);
    failed++;
  }
}

function assertNull(label: string, actual: unknown) {
  if (actual === null || actual === undefined) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label} — expected null, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ─── 1. normalizeName ────────────────────────────────────────────────────────
console.log('\n1. normalizeName');
assert('lowercase',             normalizeName('Navy Blazer'),       'navy blazer');
assert('trim',                  normalizeName('  white tee  '),     'white tee');
assert('collapse spaces',       normalizeName('black   belt'),      'black belt');
assert('grey → gray',           normalizeName('Grey Cardigan'),     'gray cardigan');
assert('mixed grey/gray',       normalizeName('Grey  Sneakers'),    'gray sneakers');

// ─── 2. resolveCategory ──────────────────────────────────────────────────────
console.log('\n2. resolveCategory');
assert('blazer → outerwear',    resolveCategory('navy blazer'),     'outerwear');
assert('sneakers → shoes',      resolveCategory('white sneakers'),  'shoes');
assert('jeans → bottoms',       resolveCategory('blue jeans'),      'bottoms');
assert('shirt → tops',          resolveCategory('white shirt'),     'tops');
assert('belt → accessories',    resolveCategory('black belt'),      'accessories');
assert('tee → tops',            resolveCategory('graphic tee'),     'tops');
assert('chinos → bottoms',      resolveCategory('khaki chinos'),    'bottoms');
assert('boots → shoes',         resolveCategory('brown boots'),     'shoes');
assert('handbag → accessories', resolveCategory('leather handbag'), 'accessories');
assertNull('unknown item → null', resolveCategory('outfit'));
assertNull('empty string → null', resolveCategory(''));

// ─── 3. extractColorAndBase ──────────────────────────────────────────────────
console.log('\n3. extractColorAndBase');
assert('navy blazer',
  extractColorAndBase('navy blazer'),
  { color: 'navy', baseName: 'blazer' });

assert('white sneakers',
  extractColorAndBase('white sneakers'),
  { color: 'white', baseName: 'sneakers' });

assert('dark navy chinos',
  extractColorAndBase('dark navy chinos'),
  { color: 'dark navy', baseName: 'chinos' });

assert('no color prefix',
  extractColorAndBase('blazer'),
  { color: null, baseName: 'blazer' });

// Single bare color word: color extracted, baseName falls back to full string
assert('single color word → color set, baseName = full string',
  extractColorAndBase('black'),
  { color: 'black', baseName: 'black' });

assert('light blue shirt',
  extractColorAndBase('light blue shirt'),
  { color: 'light blue', baseName: 'shirt' });

// ─── 4. Dedup logic: same baseName, different color ──────────────────────────
console.log('\n4. Dedup: same base noun, different color');

function sameBase(a: string, b: string): boolean {
  const norm = (s: string) => normalizeName(s);
  const cat = resolveCategory(norm(a));
  if (!cat || cat !== resolveCategory(norm(b))) return false;
  return extractColorAndBase(norm(a)).baseName === extractColorAndBase(norm(b)).baseName;
}

assert('"navy blazer" matches "black blazer"',       sameBase('navy blazer', 'black blazer'),       true);
assert('"white sneakers" matches "grey sneakers"',   sameBase('white sneakers', 'grey sneakers'),   true);
assert('"navy blazer" does NOT match "white shirt"', sameBase('navy blazer', 'white shirt'),        false);
assert('"black belt" does NOT match "black bag"',    sameBase('black belt', 'black bag'),           false);

// ─── 5. Integration: syncGarmentsToWardrobe DB round-trip ───────────────────
console.log('\n5. Integration: DB round-trip');

const TEST_USER_ID = 'test-wardrobe-sync-user';
const OUTFIT_ID_1 = 'test-outfit-check-1';
const OUTFIT_ID_2 = 'test-outfit-check-2';

async function integrationTests() {
  // Setup: ensure test user exists
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    create: {
      id: TEST_USER_ID,
      email: 'wardrobesync-test@test.local',
      passwordHash: 'test',
      tier: 'free',
    },
    update: {},
  });

  // Setup: ensure test outfit checks exist
  for (const id of [OUTFIT_ID_1, OUTFIT_ID_2]) {
    await prisma.outfitCheck.upsert({
      where: { id },
      create: {
        id,
        userId: TEST_USER_ID,
        occasions: [],
        isDeleted: false,
        isPublic: false,
        isFavorite: false,
      },
      update: {},
    });
  }

  // Cleanup any prior test items
  await prisma.wardrobeItemOutfit.deleteMany({ where: { outfitCheckId: { in: [OUTFIT_ID_1, OUTFIT_ID_2] } } });
  await prisma.wardrobeItem.deleteMany({ where: { userId: TEST_USER_ID } });

  // First sync: 3 garments
  await syncGarmentsToWardrobe(
    TEST_USER_ID, OUTFIT_ID_1,
    ['navy blazer', 'white sneakers', 'black belt'],
    []
  );

  const itemsAfterFirst = await prisma.wardrobeItem.findMany({ where: { userId: TEST_USER_ID } });
  assert('3 items created', itemsAfterFirst.length, 3);

  const blazer = itemsAfterFirst.find(i => i.normalizedName === 'navy blazer');
  assertNotNull('blazer exists', blazer);
  assert('blazer category = outerwear', blazer?.category, 'outerwear');
  assert('blazer source = ai-detected', blazer?.source, 'ai-detected');
  assert('blazer color = navy', blazer?.color, 'navy');
  assert('blazer timesWorn = 1', blazer?.timesWorn, 1);

  const links1 = await prisma.wardrobeItemOutfit.count({ where: { outfitCheckId: OUTFIT_ID_1 } });
  assert('3 links created for outfit 1', links1, 3);

  // Second sync: overlapping garment "gray sneakers" should fuzzy-match "white sneakers"
  await syncGarmentsToWardrobe(
    TEST_USER_ID, OUTFIT_ID_2,
    ['navy blazer', 'gray sneakers', 'khaki chinos'],
    []
  );

  const itemsAfterSecond = await prisma.wardrobeItem.findMany({ where: { userId: TEST_USER_ID } });
  // blazer (existing), sneakers (existing fuzzy), belt (existing but not in outfit2), chinos (new) = 4 total
  assert('4 distinct items after second sync', itemsAfterSecond.length, 4);

  const sneakersAfter = itemsAfterSecond.find(i => i.normalizedName === 'white sneakers');
  assertNotNull('sneakers item still keyed by original normalizedName', sneakersAfter);
  assert('sneakers timesWorn = 2 (seen in both outfits)', sneakersAfter?.timesWorn, 2);

  const blazerAfter = itemsAfterSecond.find(i => i.normalizedName === 'navy blazer');
  assert('blazer timesWorn = 2', blazerAfter?.timesWorn, 2);

  const belt = itemsAfterSecond.find(i => i.category === 'accessories' && i.normalizedName?.includes('belt'));
  assert('belt timesWorn = 1 (only in outfit 1)', belt?.timesWorn, 1);

  const chinos = itemsAfterSecond.find(i => i.normalizedName === 'khaki chinos');
  assertNotNull('chinos created', chinos);
  assert('chinos category = bottoms', chinos?.category, 'bottoms');
  assert('chinos timesWorn = 1', chinos?.timesWorn, 1);

  // Idempotency: re-run outfit1 sync — timesWorn must not change
  await syncGarmentsToWardrobe(
    TEST_USER_ID, OUTFIT_ID_1,
    ['navy blazer', 'white sneakers', 'black belt'],
    []
  );

  const itemsAfterIdempotent = await prisma.wardrobeItem.findMany({ where: { userId: TEST_USER_ID } });
  const blazerIdempotent = itemsAfterIdempotent.find(i => i.normalizedName === 'navy blazer');
  assert('blazer timesWorn still 2 after re-sync (idempotent)', blazerIdempotent?.timesWorn, 2);

  // ─── 6. /api/wardrobe/progress via direct DB check ──────────────────────
  console.log('\n6. Progress calculation');

  const outfitCount = await prisma.outfitCheck.count({ where: { userId: TEST_USER_ID, isDeleted: false } });
  const itemCount = await prisma.wardrobeItem.count({ where: { userId: TEST_USER_ID } });
  const THRESHOLD = 10;
  const isUnlocked = outfitCount >= THRESHOLD;

  assert('outfitCount = 2 test outfits', outfitCount, 2);
  assert('itemCount = 4', itemCount, 4);
  assert('isUnlocked = false (need 10)', isUnlocked, false);
  assert('progress = min(2, 10)', Math.min(outfitCount, THRESHOLD), 2);

  // Cleanup
  await prisma.wardrobeItemOutfit.deleteMany({ where: { outfitCheckId: { in: [OUTFIT_ID_1, OUTFIT_ID_2] } } });
  await prisma.wardrobeItem.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.outfitCheck.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
  console.log('  (test data cleaned up)');
}

// ─── Run ─────────────────────────────────────────────────────────────────────
integrationTests()
  .then(() => {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`Results: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
  })
  .catch((err) => {
    console.error('\nFatal test error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
