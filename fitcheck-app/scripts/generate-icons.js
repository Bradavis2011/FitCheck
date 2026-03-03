/**
 * Generates all required app + web icons.
 *
 * Design: Single oversized Playfair Display Italic "?" in Decision Coral (#E85D4C)
 * on Confidence Cream (#FBF7F4) background. Zero gradient, zero shadow.
 * Editorial fashion magazine masthead mark — one glyph, dominant, nothing else.
 *
 * Technique: Downloads Playfair Display Italic TTF from Google Fonts, base64-encodes
 * it, embeds in SVG via @font-face, renders with sharp/librsvg.
 *
 * Run from repo root: node fitcheck-app/scripts/generate-icons.js
 */

const sharp = require('D:/Users/Brandon/FitCheck/fitcheck-api/node_modules/sharp');
const path = require('path');
const fs = require('fs');
const https = require('https');

const ROOT = path.join(__dirname, '../../');
const APP_ASSETS = path.join(__dirname, '../assets');
const WEB_PUBLIC = path.join(ROOT, 'orthis-web/public');
const WEB_APP = path.join(ROOT, 'orthis-web/app');

const CORAL = '#E85D4C';
const CREAM = '#FBF7F4';

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

  // Verify magic bytes: TTF starts with 0x00010000
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
 * Builds an SVG string with the Playfair Italic ? embedded.
 * @param {number} size - Canvas width and height in pixels
 * @param {string} fontBase64 - Base64-encoded TTF/OTF data
 */
function buildIconSvg(size, fontBase64) {
  // Font size at 75% of canvas — fills the space boldly with comfortable padding
  const fontSize = Math.round(size * 0.75);
  // y at 52% centers the glyph visually (the ? has more weight in the top half)
  const y = Math.round(size * 0.52);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <style>
      @font-face {
        font-family: 'PlayfairItalic';
        font-style: italic;
        font-weight: 400;
        src: url('data:font/ttf;base64,${fontBase64}') format('truetype');
      }
    </style>
  </defs>
  <rect width="${size}" height="${size}" fill="${CREAM}"/>
  <text
    x="${Math.round(size / 2)}"
    y="${y}"
    font-family="PlayfairItalic"
    font-style="italic"
    font-weight="400"
    font-size="${fontSize}"
    fill="${CORAL}"
    text-anchor="middle"
    dominant-baseline="middle">?</text>
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
  entry.writeUInt32LE(pngBuffer.length, 8);  // bytes in resource
  entry.writeUInt32LE(imageOffset, 12);      // offset to image data

  return Buffer.concat([header, entry, pngBuffer]);
}

async function generate() {
  // Download and embed the font
  const ttf = await fetchPlayfairItalicTtf();
  const fontBase64 = ttf.toString('base64');

  console.log('\nRendering icons...');

  // ── App assets ────────────────────────────────────────────────────────────

  // 1. icon.png — 1024×1024, no alpha (App Store requirement)
  const iconSvg = buildIconSvg(1024, fontBase64);
  await sharp(Buffer.from(iconSvg))
    .resize(1024, 1024, { kernel: 'lanczos3' })
    .flatten({ background: CREAM })
    .png()
    .toFile(path.join(APP_ASSETS, 'icon.png'));
  console.log('✅ fitcheck-app/assets/icon.png (1024×1024)');

  // 2. adaptive-icon.png — 1024×1024 for Android adaptive icon foreground
  //    backgroundColor in app.json is #FBF7F4, matching the icon background
  await sharp(Buffer.from(buildIconSvg(1024, fontBase64)))
    .resize(1024, 1024, { kernel: 'lanczos3' })
    .png()
    .toFile(path.join(APP_ASSETS, 'adaptive-icon.png'));
  console.log('✅ fitcheck-app/assets/adaptive-icon.png (1024×1024)');

  // 3. splash-icon.png — 200×200, Expo centers on cream splash background
  await sharp(Buffer.from(buildIconSvg(200, fontBase64)))
    .resize(200, 200, { kernel: 'lanczos3' })
    .png()
    .toFile(path.join(APP_ASSETS, 'splash-icon.png'));
  console.log('✅ fitcheck-app/assets/splash-icon.png (200×200)');

  // 4. favicon.png — 512×512 for Expo web favicon
  await sharp(Buffer.from(buildIconSvg(512, fontBase64)))
    .resize(512, 512, { kernel: 'lanczos3' })
    .png()
    .toFile(path.join(APP_ASSETS, 'favicon.png'));
  console.log('✅ fitcheck-app/assets/favicon.png (512×512)');

  // ── Web assets ────────────────────────────────────────────────────────────

  // 5. orthis-web/public/favicon.png — 512×512
  await sharp(Buffer.from(buildIconSvg(512, fontBase64)))
    .resize(512, 512, { kernel: 'lanczos3' })
    .png()
    .toFile(path.join(WEB_PUBLIC, 'favicon.png'));
  console.log('✅ orthis-web/public/favicon.png (512×512)');

  // 6. orthis-web/public/apple-touch-icon.png — 180×180 (iOS home screen)
  await sharp(Buffer.from(buildIconSvg(180, fontBase64)))
    .resize(180, 180, { kernel: 'lanczos3' })
    .png()
    .toFile(path.join(WEB_PUBLIC, 'apple-touch-icon.png'));
  console.log('✅ orthis-web/public/apple-touch-icon.png (180×180)');

  // 7. orthis-web/app/favicon.ico — 32×32 PNG-in-ICO
  const favicon32Buf = await sharp(Buffer.from(buildIconSvg(64, fontBase64)))
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
