/**
 * Generates all required app icons from SVG source
 * Run from project root: node scripts/generate-icons.js
 */
const sharp = require('D:/Users/Brandon/FitCheck/fitcheck-api/node_modules/sharp');
const path = require('path');
const fs = require('fs');

const assetsDir = path.join(__dirname, '../assets');

// App icon SVG — white italic "?" on coral gradient, rounded square
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#E85D4C"/>
      <stop offset="100%" stop-color="#FF7A6B"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#grad)"/>
  <text
    x="512"
    y="720"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="700"
    font-style="italic"
    font-weight="900"
    fill="white"
    fill-opacity="0.95"
    text-anchor="middle"
    letter-spacing="-20">?</text>
</svg>`;

// Adaptive icon foreground — same but with padding for Android safe zone
const adaptiveSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <text
    x="512"
    y="700"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="640"
    font-style="italic"
    font-weight="900"
    fill="#E85D4C"
    fill-opacity="0.95"
    text-anchor="middle"
    letter-spacing="-18">?</text>
</svg>`;

// Splash icon SVG — "Or This?" wordmark on cream background
const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <text
    x="512"
    y="540"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="160"
    font-weight="700"
    fill="#1A1A1A"
    text-anchor="middle">Or </text>
  <text
    x="680"
    y="540"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="160"
    font-style="italic"
    font-weight="700"
    fill="#E85D4C"
    text-anchor="middle">This?</text>
</svg>`;

async function generate() {
  console.log('Generating app icons...\n');

  // 1. Main app icon (1024x1024, no alpha — App Store requirement)
  await sharp(Buffer.from(iconSvg))
    .resize(1024, 1024)
    .flatten({ background: '#E85D4C' }) // No transparency for App Store
    .png()
    .toFile(path.join(assetsDir, 'icon.png'));
  console.log('✅ icon.png (1024x1024)');

  // 2. Android adaptive icon foreground (1024x1024, transparent bg)
  await sharp(Buffer.from(adaptiveSvg))
    .resize(1024, 1024)
    .png()
    .toFile(path.join(assetsDir, 'adaptive-icon.png'));
  console.log('✅ adaptive-icon.png (1024x1024)');

  // 3. Splash icon (200x200 on transparent — Expo centers on cream bg)
  await sharp(Buffer.from(iconSvg))
    .resize(200, 200)
    .png()
    .toFile(path.join(assetsDir, 'splash-icon.png'));
  console.log('✅ splash-icon.png (200x200)');

  // 4. Favicon (48x48)
  await sharp(Buffer.from(iconSvg))
    .resize(48, 48)
    .png()
    .toFile(path.join(assetsDir, 'favicon.png'));
  console.log('✅ favicon.png (48x48)');

  console.log('\nAll icons generated in fitcheck-app/assets/');
}

generate().catch(console.error);
