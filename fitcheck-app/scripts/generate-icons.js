/**
 * Generates all required app + web icons.
 *
 * Design: Flat coral (#E85D4C) background + white (#FFFFFF) Playfair Display
 * Italic "?" as an extracted vector glyph path — zero font-rendering dependency.
 * Guaranteed pixel-perfect match to the logo "?" glyph.
 *
 * Run from repo root: node fitcheck-app/scripts/generate-icons.js
 */

const sharp = require('D:/Users/Brandon/FitCheck/fitcheck-api/node_modules/sharp');
const opentype = require('opentype.js');
const path = require('path');
const fs = require('fs');
const https = require('https');

const ROOT = path.join(__dirname, '../../');
const APP_ASSETS = path.join(__dirname, '../assets');
const WEB_PUBLIC = path.join(ROOT, 'orthis-web/public');
const WEB_APP = path.join(ROOT, 'orthis-web/app');

const CORAL = '#E85D4C';
const WHITE = '#FFFFFF';

// Old Android UA — Google Fonts returns TTF (not WOFF2/EOT)
const ANDROID_UA = 'Mozilla/5.0 (Linux; U; Android 2.2; en-us; Nexus One Build/FRF91) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1';

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location, headers).then(resolve, reject);
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function fetchPlayfairItalicTtf() {
  console.log('  Fetching Playfair Display Italic TTF from Google Fonts...');

  const cssUrl = 'https://fonts.googleapis.com/css?family=Playfair+Display:400italic';
  const cssBuffer = await httpsGet(cssUrl, { 'User-Agent': ANDROID_UA });
  const css = cssBuffer.toString();

  const match = css.match(/url\((https?:\/\/[^)]+)\)/);
  if (!match) {
    throw new Error(
      'Could not find font URL in Google Fonts CSS.\nCSS response:\n' + css.slice(0, 500)
    );
  }

  const ttfUrl = match[1];
  console.log('  TTF URL:', ttfUrl);

  const ttfBuffer = await httpsGet(ttfUrl, { 'User-Agent': ANDROID_UA });

  // Verify magic bytes: TTF starts with 0x00010000, OTF with 'OTTO'
  const magic = ttfBuffer.slice(0, 4).toString('hex');
  if (magic !== '00010000' && magic !== '4f54544f') {
    throw new Error(
      `Downloaded font has unexpected magic bytes: ${magic}. Expected TTF (00010000) or OTF (4f54544f).`
    );
  }

  console.log(`  Downloaded ${ttfBuffer.length} bytes (${magic === '4f54544f' ? 'OTF' : 'TTF'})`);
  return ttfBuffer;
}

/**
 * Parses the TTF buffer with opentype.js and extracts the "?" glyph.
 * Returns { font, glyph, bbox } where bbox is in font units.
 */
function extractQuestionMarkGlyph(ttfBuffer) {
  // opentype.js parse() requires an ArrayBuffer
  const ab = ttfBuffer.buffer.slice(
    ttfBuffer.byteOffset,
    ttfBuffer.byteOffset + ttfBuffer.byteLength
  );
  const font = opentype.parse(ab);

  const glyph = font.charToGlyph('?');
  if (!glyph || !glyph.path || glyph.path.commands.length === 0) {
    throw new Error('Could not extract ? glyph — path is empty. Font may not contain this glyph.');
  }

  const bbox = glyph.getBoundingBox();
  console.log(`  ? glyph bbox (font units): x1=${bbox.x1} y1=${bbox.y1} x2=${bbox.x2} y2=${bbox.y2}`);
  console.log(`  unitsPerEm: ${font.unitsPerEm}`);

  return { font, glyph, bbox };
}

/**
 * Builds SVG markup for the icon at a given pixel size.
 *
 * The glyph is scaled so its taller dimension fills 78% of the canvas,
 * then translated so its visual bounding-box center sits at (size/2, size/2).
 *
 * Coordinate maths:
 *   opentype getPath(x_origin, baseline_y, fontSize) places:
 *     SVG_x = x_origin + fontUnit_x * scale
 *     SVG_y = baseline_y - fontUnit_y * scale   ← y-axis flip
 *
 *   To put the glyph visual centre at canvas centre (cx, cy):
 *     x_origin  = cx - (bbox.x1 + glyphW/2) * scale
 *     baseline_y = cy + (bbox.y1 + glyphH/2) * scale
 */
function buildIconSvg(size, font, glyph, bbox) {
  const glyphW = bbox.x2 - bbox.x1;
  const glyphH = bbox.y2 - bbox.y1;

  // Scale so the larger dimension fills 78% of the canvas
  const scale = (size * 0.78) / Math.max(glyphH, glyphW);
  const fontSize = scale * font.unitsPerEm;

  const cx = size / 2;
  const cy = size / 2;

  const x_origin  = cx - (bbox.x1 + glyphW / 2) * scale;
  const baseline_y = cy + (bbox.y1 + glyphH / 2) * scale;

  const pathData = glyph.getPath(x_origin, baseline_y, fontSize).toPathData(2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${CORAL}"/>
  <path d="${pathData}" fill="${WHITE}"/>
</svg>`;
}

/**
 * Builds the static orthis-web/app/icon.svg — a 512×512 viewBox with
 * embedded vector path and no font-family reference.
 */
function buildStaticIconSvg(font, glyph, bbox) {
  const size = 512;
  const glyphW = bbox.x2 - bbox.x1;
  const glyphH = bbox.y2 - bbox.y1;

  const scale = (size * 0.78) / Math.max(glyphH, glyphW);
  const fontSize = scale * font.unitsPerEm;

  const cx = size / 2;
  const cy = size / 2;

  const x_origin  = cx - (bbox.x1 + glyphW / 2) * scale;
  const baseline_y = cy + (bbox.y1 + glyphH / 2) * scale;

  const pathData = glyph.getPath(x_origin, baseline_y, fontSize).toPathData(2);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${CORAL}"/>
  <!-- Playfair Display Italic ? — extracted vector glyph, no font dependency -->
  <path d="${pathData}" fill="${WHITE}"/>
</svg>`;
}

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
  entry.writeUInt8(width >= 256 ? 0 : width, 0);
  entry.writeUInt8(height >= 256 ? 0 : height, 1);
  entry.writeUInt8(0, 2);  // colorCount: 0 = true color
  entry.writeUInt8(0, 3);  // reserved
  entry.writeUInt16LE(1, 4);   // planes
  entry.writeUInt16LE(32, 6);  // bit count: 32bpp (RGBA)
  entry.writeUInt32LE(pngBuffer.length, 8);   // bytes in resource
  entry.writeUInt32LE(imageOffset, 12);       // offset to image data

  return Buffer.concat([header, entry, pngBuffer]);
}

async function generate() {
  // Step 1: Download font
  const ttf = await fetchPlayfairItalicTtf();

  // Step 2: Extract ? glyph as vector path
  console.log('\nExtracting ? glyph path from Playfair Display Italic...');
  const { font, glyph, bbox } = extractQuestionMarkGlyph(ttf);

  console.log('\nRendering icons...');

  // Helper: SVG buffer at given size
  const svg = (size) => Buffer.from(buildIconSvg(size, font, glyph, bbox));

  // ── Static vector icon.svg (no font dependency) ────────────────────────
  const iconSvgContent = buildStaticIconSvg(font, glyph, bbox);
  await fs.promises.writeFile(path.join(WEB_APP, 'icon.svg'), iconSvgContent);
  console.log('✅ orthis-web/app/icon.svg (512×512 vector)');

  // ── App assets ─────────────────────────────────────────────────────────

  // 1. icon.png — 1024×1024, no alpha (App Store requirement)
  await sharp(svg(1024))
    .resize(1024, 1024, { kernel: 'lanczos3' })
    .flatten({ background: CORAL })
    .png()
    .toFile(path.join(APP_ASSETS, 'icon.png'));
  console.log('✅ fitcheck-app/assets/icon.png (1024×1024)');

  // 2. adaptive-icon.png — 1024×1024 Android adaptive foreground
  await sharp(svg(1024))
    .resize(1024, 1024, { kernel: 'lanczos3' })
    .png()
    .toFile(path.join(APP_ASSETS, 'adaptive-icon.png'));
  console.log('✅ fitcheck-app/assets/adaptive-icon.png (1024×1024)');

  // 3. splash-icon.png — 200×200 (Expo centers on splash background)
  await sharp(svg(200))
    .resize(200, 200, { kernel: 'lanczos3' })
    .png()
    .toFile(path.join(APP_ASSETS, 'splash-icon.png'));
  console.log('✅ fitcheck-app/assets/splash-icon.png (200×200)');

  // 4. favicon.png — 512×512 for Expo web favicon
  await sharp(svg(512))
    .resize(512, 512, { kernel: 'lanczos3' })
    .png()
    .toFile(path.join(APP_ASSETS, 'favicon.png'));
  console.log('✅ fitcheck-app/assets/favicon.png (512×512)');

  // ── Web assets ─────────────────────────────────────────────────────────

  // 5. orthis-web/public/favicon.png — 512×512
  await sharp(svg(512))
    .resize(512, 512, { kernel: 'lanczos3' })
    .png()
    .toFile(path.join(WEB_PUBLIC, 'favicon.png'));
  console.log('✅ orthis-web/public/favicon.png (512×512)');

  // 6. orthis-web/public/apple-touch-icon.png — 180×180 (iOS home screen)
  await sharp(svg(180))
    .resize(180, 180, { kernel: 'lanczos3' })
    .png()
    .toFile(path.join(WEB_PUBLIC, 'apple-touch-icon.png'));
  console.log('✅ orthis-web/public/apple-touch-icon.png (180×180)');

  // 7. orthis-web/app/favicon.ico — 32×32 PNG-in-ICO
  const favicon32Buf = await sharp(svg(64))
    .resize(32, 32, { kernel: 'lanczos3' })
    .png()
    .toBuffer();
  const icoBuffer = wrapPngAsIco(favicon32Buf, 32, 32);
  await fs.promises.writeFile(path.join(WEB_APP, 'favicon.ico'), icoBuffer);
  console.log('✅ orthis-web/app/favicon.ico (32×32 PNG-in-ICO)');

  console.log('\nAll icons generated successfully.');
  console.log('Next: run `npx expo prebuild` or rebuild the app to pick up icon changes.');
}

generate().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
