#!/usr/bin/env node

/**
 * Icon Generator Script
 * Generates PNG icons from logo.png for PWA manifest
 *
 * Usage: node scripts/generate-icons.js
 *
 * Requires: sharp (npm install sharp)
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('Sharp not installed. Please run: pnpm add -Dw sharp');
  process.exit(1);
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

const logoPath = path.join(__dirname, '../logo.png');

const apps = [
  {
    name: 'client',
    outputDir: path.join(__dirname, '../apps/client/public/icons'),
  },
  {
    name: 'driver',
    outputDir: path.join(__dirname, '../apps/driver/public/icons'),
  },
];

async function generateIcons() {
  // Check if logo exists
  if (!fs.existsSync(logoPath)) {
    console.error(`Logo not found: ${logoPath}`);
    console.log('Please add logo.png to the project root');
    process.exit(1);
  }

  console.log(`Using logo: ${logoPath}`);

  for (const app of apps) {
    console.log(`\nGenerating icons for ${app.name}...`);

    // Ensure output directory exists
    if (!fs.existsSync(app.outputDir)) {
      fs.mkdirSync(app.outputDir, { recursive: true });
    }

    // Read the logo
    const logoBuffer = fs.readFileSync(logoPath);

    for (const size of sizes) {
      const outputPath = path.join(app.outputDir, `icon-${size}x${size}.png`);

      try {
        // Create a square canvas with transparent background
        await sharp(logoBuffer)
          .resize(size, size, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          })
          .png()
          .toFile(outputPath);

        console.log(`  Created: icon-${size}x${size}.png`);
      } catch (err) {
        console.error(`  Error creating ${size}x${size}: ${err.message}`);
      }
    }

    // Create favicon.png
    const faviconPath = path.join(app.outputDir, '../favicon.png');
    try {
      await sharp(logoBuffer)
        .resize(32, 32, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(faviconPath);
      console.log(`  Created: favicon.png`);
    } catch (err) {
      console.error(`  Error creating favicon: ${err.message}`);
    }

    // Create apple-touch-icon (keep white background for iOS)
    const appleTouchIconPath = path.join(app.outputDir, '../apple-touch-icon.png');
    try {
      await sharp(logoBuffer)
        .resize(180, 180, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toFile(appleTouchIconPath);
      console.log(`  Created: apple-touch-icon.png`);
    } catch (err) {
      console.error(`  Error creating apple-touch-icon: ${err.message}`);
    }
  }

  console.log('\nIcon generation complete!');
}

generateIcons().catch(console.error);
