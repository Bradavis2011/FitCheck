/**
 * generate-app-icon.mjs
 *
 * Generates Or This? app icon assets using Playfair Display Italic 700 (exact font
 * from the homepage hero logo). Downloads the TTF from Google Webfonts Helper,
 * embeds it in SVG, and renders PNG via sharp.
 *
 * Run from the fitcheck-api directory:
 *   node scripts/generate-app-icon.mjs
 *
 * Requires: sharp (already installed in fitcheck-api)
 */

import https from 'https';
import http from 'http';
import zlib from 'zlib';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(__dirname, '../../fitcheck-app/assets');
const WEB_PUBLIC = join(__dirname, '../../orthis-web/public');

// ── Fetch helpers ─────────────────────────────────────────────────────────────

function fetchBuffer(url, options = {}) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const req = proto.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', ...options.headers } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchBuffer(res.headers.location, options).then(resolve).catch(reject);
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

// ── ZIP extraction (no external deps) ────────────────────────────────────────

/**
 * Find and extract the first file in a ZIP buffer.
 * Handles DEFLATE (method 8) and STORE (method 0).
 */
function extractFirstFromZip(zipBuf) {
  let offset = 0;
  while (offset < zipBuf.length - 30) {
    if (
      zipBuf[offset] === 0x50 &&
      zipBuf[offset + 1] === 0x4b &&
      zipBuf[offset + 2] === 0x03 &&
      zipBuf[offset + 3] === 0x04
    ) {
      const compMethod = zipBuf.readUInt16LE(offset + 8);
      const compSize = zipBuf.readUInt32LE(offset + 18);
      const fnameLen = zipBuf.readUInt16LE(offset + 26);
      const extraLen = zipBuf.readUInt16LE(offset + 28);
      const fname = zipBuf.slice(offset + 30, offset + 30 + fnameLen).toString('utf8');
      const dataStart = offset + 30 + fnameLen + extraLen;
      const compressed = zipBuf.slice(dataStart, dataStart + compSize);

      let data;
      if (compMethod === 8) {
        data = zlib.inflateRawSync(compressed);
      } else if (compMethod === 0) {
        data = compressed;
      } else {
        throw new Error(`Unsupported zip compression method: ${compMethod}`);
      }

      return { name: fname, data };
    }
    offset++;
  }
  throw new Error('No local file entry found in ZIP');
}

// ── Font download ─────────────────────────────────────────────────────────────

async function getPlayfairItalicTTF() {
  // Google Webfonts Helper — provides font files in specific formats (incl. TTF)
  const url =
    'https://gwfh.mranftl.com/api/fonts/playfair-display?download=zip&subsets=latin&formats=ttf&variants=700italic';

  console.log('⬇  Downloading Playfair Display Italic 700 TTF…');
  const zipBuf = await fetchBuffer(url);
  console.log(`   ZIP downloaded: ${(zipBuf.length / 1024).toFixed(1)} KB`);

  const { name, data } = extractFirstFromZip(zipBuf);
  const magic = data.slice(0, 4).toString('hex');
  const isTTF = magic === '00010000' || magic === '74727565';
  console.log(`   Extracted: ${name} (${(data.length / 1024).toFixed(1)} KB) ${isTTF ? '✅ TTF' : '⚠️ unknown format'}`);

  if (!isTTF) {
    throw new Error(`Expected TTF, got magic: ${magic}`);
  }
  return data;
}

// ── SVG templates ─────────────────────────────────────────────────────────────

function iconSVG(size, fontB64) {
  const r = Math.round(size * 0.22); // iOS-style corner radius
  const fontSize = Math.round(size * 0.78);
  const cy = Math.round(size * 0.78);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <style>
      @font-face {
        font-family: 'PD';
        font-style: italic;
        font-weight: 700;
        src: url('data:font/ttf;base64,${fontB64}') format('truetype');
      }
    </style>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#E85D4C"/>
      <stop offset="100%" stop-color="#FF7A6B"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#g)"/>
  <text x="${size / 2}" y="${cy}"
    font-family="PD, Georgia, serif"
    font-style="italic" font-weight="700"
    font-size="${fontSize}" fill="white" text-anchor="middle">?</text>
</svg>`;
}

/** Android adaptive icon — no corner radius, Android clips to the shape mask */
function adaptiveSVG(size, fontB64) {
  const fontSize = Math.round(size * 0.72);
  const cy = Math.round(size * 0.75);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <style>
      @font-face {
        font-family: 'PD';
        font-style: italic;
        font-weight: 700;
        src: url('data:font/ttf;base64,${fontB64}') format('truetype');
      }
    </style>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#E85D4C"/>
      <stop offset="100%" stop-color="#FF7A6B"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
  <text x="${size / 2}" y="${cy}"
    font-family="PD, Georgia, serif"
    font-style="italic" font-weight="700"
    font-size="${fontSize}" fill="white" text-anchor="middle">?</text>
</svg>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🎨  Or This? Icon Generator — Playfair Display Italic\n');

  const fontBuf = await getPlayfairItalicTTF();
  const fontB64 = fontBuf.toString('base64');

  console.log('\n📱  Generating assets…\n');

  async function render(svgStr, outPath, size) {
    await sharp(Buffer.from(svgStr)).resize(size, size).png().toFile(outPath);
    console.log(`   ✅  ${outPath.split(/[\\/]/).slice(-3).join('/')}  (${size}×${size})`);
  }

  await render(iconSVG(1024, fontB64),     join(ASSETS_DIR, 'icon.png'),           1024);
  await render(adaptiveSVG(1024, fontB64), join(ASSETS_DIR, 'adaptive-icon.png'),  1024);
  await render(iconSVG(512, fontB64),      join(ASSETS_DIR, 'favicon.png'),         512);
  await render(iconSVG(200, fontB64),      join(ASSETS_DIR, 'splash-icon.png'),     200);
  await render(iconSVG(512, fontB64),      join(WEB_PUBLIC, 'favicon.png'),         512);
  await render(iconSVG(180, fontB64),      join(WEB_PUBLIC, 'apple-touch-icon.png'), 180);

  console.log('\n✅  Done.\n');
  console.log('   Review the PNGs:');
  console.log('   fitcheck-app/assets/icon.png');
  console.log('   fitcheck-app/assets/adaptive-icon.png');
  console.log('   fitcheck-app/assets/favicon.png\n');
  console.log('   Re-run any time:  node fitcheck-api/scripts/generate-app-icon.mjs\n');
}

main().catch((err) => {
  console.error('❌  Icon generation failed:', err.message);
  process.exit(1);
});
