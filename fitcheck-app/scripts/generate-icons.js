/**
 * Generates all required app + web icons from the store-submitted source PNG.
 * Source: store-assets/app-icon-512.png (cream bg, "Or" black DM Sans, "This?" coral Playfair Italic)
 *
 * Run from project root: node fitcheck-app/scripts/generate-icons.js
 */
const sharp = require('D:/Users/Brandon/FitCheck/fitcheck-api/node_modules/sharp');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '../../');
const APP_ASSETS = path.join(__dirname, '../assets');
const STORE_SRC = path.join(__dirname, '../store-assets/app-icon-512.png');
const WEB_PUBLIC = path.join(ROOT, 'orthis-web/public');
const WEB_APP = path.join(ROOT, 'orthis-web/app');

/**
 * Creates a minimal valid ICO file containing a single embedded PNG image.
 * Modern browsers (Chrome, Firefox, Edge, Safari) all support PNG-in-ICO.
 */
function wrapPngAsIco(pngBuffer, width, height) {
  const ICONDIR_SIZE = 6;
  const ICONDIRENTRY_SIZE = 16;
  const imageOffset = ICONDIR_SIZE + ICONDIRENTRY_SIZE;

  const header = Buffer.alloc(ICONDIR_SIZE);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = ICO
  header.writeUInt16LE(1, 4); // count: 1 image

  const entry = Buffer.alloc(ICONDIRENTRY_SIZE);
  // Width/height: use 0 for 256px images, otherwise the actual value
  entry.writeUInt8(width >= 256 ? 0 : width, 0);
  entry.writeUInt8(height >= 256 ? 0 : height, 1);
  entry.writeUInt8(0, 2);  // colorCount: 0 = true color
  entry.writeUInt8(0, 3);  // reserved
  entry.writeUInt16LE(1, 4);  // planes
  entry.writeUInt16LE(32, 6); // bit count: 32bpp (RGBA)
  entry.writeUInt32LE(pngBuffer.length, 8);  // bytes in resource
  entry.writeUInt32LE(imageOffset, 12); // offset to image data

  return Buffer.concat([header, entry, pngBuffer]);
}

async function generate() {
  if (!fs.existsSync(STORE_SRC)) {
    throw new Error(`Source file not found: ${STORE_SRC}`);
  }

  console.log('Source:', STORE_SRC);
  const meta = await sharp(STORE_SRC).metadata();
  console.log(`  ${meta.width}×${meta.height} ${meta.format}\n`);

  // ── App assets ──────────────────────────────────────────────────────────────

  // 1. icon.png — 1024×1024, no alpha (App Store requirement)
  await sharp(STORE_SRC)
    .resize(1024, 1024, { kernel: 'lanczos3' })
    .flatten({ background: '#FBF7F4' })
    .png()
    .toFile(path.join(APP_ASSETS, 'icon.png'));
  console.log('✅ fitcheck-app/assets/icon.png (1024×1024)');

  // 2. adaptive-icon.png — 1024×1024 for Android adaptive icon foreground
  //    backgroundColor in app.json is #FBF7F4 (cream), matching the icon background
  await sharp(STORE_SRC)
    .resize(1024, 1024, { kernel: 'lanczos3' })
    .png()
    .toFile(path.join(APP_ASSETS, 'adaptive-icon.png'));
  console.log('✅ fitcheck-app/assets/adaptive-icon.png (1024×1024)');

  // 3. splash-icon.png — 200×200, Expo centers on cream background
  await sharp(STORE_SRC)
    .resize(200, 200, { kernel: 'lanczos3' })
    .png()
    .toFile(path.join(APP_ASSETS, 'splash-icon.png'));
  console.log('✅ fitcheck-app/assets/splash-icon.png (200×200)');

  // 4. favicon.png — 512×512 for Expo web favicon
  await fs.promises.copyFile(STORE_SRC, path.join(APP_ASSETS, 'favicon.png'));
  console.log('✅ fitcheck-app/assets/favicon.png (512×512, copied from source)');

  // ── Web assets ───────────────────────────────────────────────────────────────

  // 5. orthis-web/public/favicon.png — 512×512
  await fs.promises.copyFile(STORE_SRC, path.join(WEB_PUBLIC, 'favicon.png'));
  console.log('✅ orthis-web/public/favicon.png (512×512, copied from source)');

  // 6. orthis-web/public/apple-touch-icon.png — 180×180 (iOS home screen)
  await sharp(STORE_SRC)
    .resize(180, 180, { kernel: 'lanczos3' })
    .png()
    .toFile(path.join(WEB_PUBLIC, 'apple-touch-icon.png'));
  console.log('✅ orthis-web/public/apple-touch-icon.png (180×180)');

  // 7. orthis-web/app/favicon.ico — 32×32 PNG wrapped in ICO container
  const favicon32Buf = await sharp(STORE_SRC)
    .resize(32, 32, { kernel: 'lanczos3' })
    .png()
    .toBuffer();
  const icoBuffer = wrapPngAsIco(favicon32Buf, 32, 32);
  await fs.promises.writeFile(path.join(WEB_APP, 'favicon.ico'), icoBuffer);
  console.log('✅ orthis-web/app/favicon.ico (32×32 PNG-in-ICO)');

  console.log('\nAll icons generated successfully.');
  console.log('Next: run `npx expo prebuild` or rebuild the app to pick up icon changes.');
}

generate().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
