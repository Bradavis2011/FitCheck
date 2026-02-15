/**
 * STAGE 1: ACQUIRE
 * Fetch fashion images from Getty, Unsplash, and Pexels APIs
 */

import fs from 'fs';
import path from 'path';
import { ImageSource } from '../types.js';
import { config, IMAGE_QUERIES } from '../config.js';
import { Logger } from '../utils/logger.js';

export async function acquire(runId: string, dataDir: string, logger: Logger): Promise<ImageSource[]> {
  logger.stage(1, 'ACQUIRE');

  const images: ImageSource[] = [];
  const imageDir = path.join(dataDir, 'images', runId);
  fs.mkdirSync(imageDir, { recursive: true });

  // Try each source
  const sources: Array<{ name: 'getty' | 'unsplash' | 'pexels'; apiKey?: string; queries: string[] }> = [
    { name: 'getty', apiKey: config.gettyApiKey, queries: IMAGE_QUERIES.getty },
    { name: 'unsplash', apiKey: config.unsplashAccessKey, queries: IMAGE_QUERIES.unsplash },
    { name: 'pexels', apiKey: config.pexelsApiKey, queries: IMAGE_QUERIES.pexels },
  ];

  for (const source of sources) {
    if (!source.apiKey) {
      logger.warning(`${source.name.toUpperCase()} API key not configured - skipping`);
      continue;
    }

    logger.info(`Fetching from ${source.name.toUpperCase()}...`);

    try {
      const sourceImages = await fetchFromSource(source.name, source.apiKey, source.queries, config.imagesPerSource, logger);
      images.push(...sourceImages);
      logger.success(`Fetched ${sourceImages.length} images from ${source.name.toUpperCase()}`);
    } catch (error) {
      logger.error(`Failed to fetch from ${source.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Fallback to synthetic scenarios if no images fetched
  if (images.length === 0) {
    logger.warning('No image API keys configured - generating synthetic text scenarios');
    const syntheticImages = generateSyntheticScenarios(10);
    images.push(...syntheticImages);
  }

  // Save manifest
  const manifest = {
    runId,
    totalImages: images.length,
    bySource: images.reduce((acc, img) => {
      acc[img.source] = (acc[img.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    images: images.map(img => ({
      id: img.id,
      source: img.source,
      sourceUrl: img.sourceUrl,
      attribution: img.attribution,
      mimeType: img.mimeType,
    })),
  };

  fs.writeFileSync(path.join(imageDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // Save each image as separate base64 file
  for (const img of images) {
    const imgFile = path.join(imageDir, `${img.id}.json`);
    fs.writeFileSync(imgFile, JSON.stringify({ id: img.id, base64: img.base64, mimeType: img.mimeType }, null, 2));
  }

  logger.metric('Total images acquired', images.length);
  return images;
}

async function fetchFromSource(
  source: 'getty' | 'unsplash' | 'pexels',
  apiKey: string,
  queries: string[],
  perQuery: number,
  logger: Logger
): Promise<ImageSource[]> {
  const images: ImageSource[] = [];

  for (const query of queries) {
    logger.progress(images.length, queries.length * perQuery, query);

    try {
      const queryImages = await (async () => {
        switch (source) {
          case 'getty':
            return fetchGettyImages(apiKey, query, Math.ceil(perQuery / queries.length));
          case 'unsplash':
            return fetchUnsplashImages(apiKey, query, Math.ceil(perQuery / queries.length));
          case 'pexels':
            return fetchPexelsImages(apiKey, query, Math.ceil(perQuery / queries.length));
        }
      })();

      images.push(...queryImages);

      // Rate limiting between queries
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      logger.warning(`Query "${query}" failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return images.slice(0, perQuery); // Trim to requested amount
}

// Getty Images API
async function fetchGettyImages(apiKey: string, query: string, count: number): Promise<ImageSource[]> {
  // Getty API requires OAuth - simplified for now
  // In production, implement proper Getty API client with OAuth flow
  return []; // Placeholder - Getty requires complex auth
}

// Unsplash API
async function fetchUnsplashImages(apiKey: string, query: string, count: number): Promise<ImageSource[]> {
  const response = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=portrait`,
    {
      headers: {
        'Authorization': `Client-ID ${apiKey}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Unsplash API error: ${response.statusText}`);
  }

  const data = await response.json();
  const images: ImageSource[] = [];

  for (const photo of data.results || []) {
    try {
      // Download image and convert to base64
      const imageUrl = photo.urls.regular;
      const imageResponse = await fetch(imageUrl);
      const buffer = await imageResponse.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');

      images.push({
        id: `unsplash-${photo.id}`,
        source: 'unsplash',
        sourceUrl: photo.links.html,
        attribution: `Photo by ${photo.user.name} on Unsplash`,
        base64,
        mimeType: 'image/jpeg',
      });
    } catch (error) {
      // Skip failed downloads
      continue;
    }
  }

  return images;
}

// Pexels API
async function fetchPexelsImages(apiKey: string, query: string, count: number): Promise<ImageSource[]> {
  const response = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=portrait`,
    {
      headers: {
        'Authorization': apiKey,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Pexels API error: ${response.statusText}`);
  }

  const data = await response.json();
  const images: ImageSource[] = [];

  for (const photo of data.photos || []) {
    try {
      // Download image and convert to base64
      const imageUrl = photo.src.large;
      const imageResponse = await fetch(imageUrl);
      const buffer = await imageResponse.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');

      images.push({
        id: `pexels-${photo.id}`,
        source: 'pexels',
        sourceUrl: photo.url,
        attribution: `Photo by ${photo.photographer} on Pexels`,
        base64,
        mimeType: 'image/jpeg',
      });
    } catch (error) {
      // Skip failed downloads
      continue;
    }
  }

  return images;
}

// Generate synthetic text-based test scenarios when no APIs available
function generateSyntheticScenarios(count: number): ImageSource[] {
  const scenarios = [
    { occasion: ['date night'], setting: 'restaurant', weather: 'mild', vibe: 'romantic', outfit: 'Red wrap dress with black heels and gold jewelry' },
    { occasion: ['work'], setting: 'office', weather: 'mild', vibe: 'professional', outfit: 'Navy blazer, white blouse, gray trousers, black pumps' },
    { occasion: ['casual'], setting: 'coffee shop', weather: 'warm', vibe: 'relaxed', outfit: 'Light blue jeans, white t-shirt, olive bomber jacket, white sneakers' },
    { occasion: ['wedding guest'], setting: 'outdoor', weather: 'warm', vibe: 'elegant', outfit: 'Floral midi dress with nude heels and pearl earrings' },
    { occasion: ['party'], setting: 'nightclub', weather: 'mild', vibe: 'edgy', outfit: 'Black leather jacket, graphic tee, ripped jeans, ankle boots' },
    { occasion: ['brunch'], setting: 'outdoor cafe', weather: 'warm', vibe: 'casual', outfit: 'Flowy sundress with sandals and straw hat' },
    { occasion: ['job interview'], setting: 'office', weather: 'mild', vibe: 'professional', outfit: 'Charcoal suit, light pink shirt, black oxfords, simple watch' },
    { occasion: ['gym'], setting: 'fitness center', weather: 'indoor', vibe: 'sporty', outfit: 'Black leggings, sports bra, oversized hoodie, running shoes' },
    { occasion: ['cocktail party'], setting: 'rooftop bar', weather: 'mild', vibe: 'sophisticated', outfit: 'Black jumpsuit with statement necklace and heels' },
    { occasion: ['beach'], setting: 'beach', weather: 'hot', vibe: 'casual', outfit: 'Denim shorts, striped tank top, flip flops, sunglasses' },
  ];

  return scenarios.slice(0, count).map((scenario, i) => ({
    id: `synthetic-${i + 1}`,
    source: 'synthetic' as const,
    base64: '', // No actual image
    mimeType: 'text/plain',
    attribution: 'Generated test scenario',
  }));
}
