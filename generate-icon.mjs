/**
 * Generates Or This? app icon + favicon.
 * Approach: renders the "?" using an SVG with system-font fallback
 * + raw pixel check to verify rendering, then adjusts if needed.
 * Run: node generate-icon.mjs
 */
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const sharp = require('./fitcheck-api/node_modules/sharp');

// Read Playfair Display Italic TTF and embed as base64
const fontPath = path.join(__dirname, 'fitcheck-app/node_modules/@expo-google-fonts/playfair-display/400Regular_Italic/PlayfairDisplay_400Regular_Italic.ttf');
const fontB64 = readFileSync(fontPath).toString('base64');

/**
 * Build icon SVG.
 * Uses a generous padding to ensure the ? fits within bounds.
 * 'size' is the SVG viewport size.
 */
function makeSVG(size) {
  const padding = Math.round(size * 0.1);
  const fontSize = Math.round(size * 0.72);
  // The baseline needs to account for cap-height (~0.7 of font-size)
  // Position the glyph centred vertically: baseline = center + capHeight/2
  const capHeight = Math.round(fontSize * 0.75);
  const baseline = Math.round(size / 2 + capHeight / 2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <style>
      @font-face {
        font-family: 'PD';
        src: url('data:font/truetype;base64,${fontB64}') format('truetype');
        font-style: italic;
      }
    </style>
  </defs>
  <rect width="${size}" height="${size}" fill="#E85D4C"/>
  <text
    x="${size / 2}"
    y="${baseline}"
    text-anchor="middle"
    font-family="PD, 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif"
    font-style="italic"
    font-size="${fontSize}"
    fill="white"
    paint-order="stroke"
    stroke="white"
    stroke-width="0">?</text>
</svg>`;
}

async function writeIcon(svgStr, outPath, w, h) {
  // Render at double resolution then downscale for higher quality
  const renderSize = Math.max(w, h) * 2;
  const renderSvg = svgStr.replace(/width="\d+"/, `width="${renderSize}"`).replace(/height="\d+"/, `height="${renderSize}"`);

  await sharp(Buffer.from(svgStr))
    .resize(w, h, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(`✓  ${outPath}  (${w}×${h})`);
}

// 1024×1024 icon
const svg1024 = makeSVG(1024);
await writeIcon(svg1024, 'fitcheck-app/assets/icon.png', 1024, 1024);
await writeIcon(svg1024, 'fitcheck-app/assets/adaptive-icon.png', 1024, 1024);

// 512×512 splash icon
const svg512 = makeSVG(512);
await writeIcon(svg512, 'fitcheck-app/assets/splash-icon.png', 512, 512);

// Favicon: render at 256, output at 64
const svg256 = makeSVG(256);
await writeIcon(svg256, 'fitcheck-app/assets/favicon.png', 64, 64);

// Print a pixel check for the 1024 icon
const { data, info } = await sharp('fitcheck-app/assets/icon.png')
  .resize(64, 64)
  .raw()
  .toBuffer({ resolveWithObject: true });

let white = 0;
for (let i = 0; i < data.length; i += info.channels) {
  if (data[i] > 200 && data[i+1] > 200 && data[i+2] > 200) white++;
}
const pct = Math.round(white / (64*64) * 100);
console.log(`\nPixel check (64×64 sample): ${white} white pixels = ${pct}%`);
if (pct < 3) {
  console.warn('⚠  Very few white pixels — font may not have rendered. Check the icon manually.');
} else {
  console.log('✓  "?" appears to have rendered correctly.');
}
