import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Hoisted Mocks ────────────────────────────────────────────────────────────

const mockGenerateContent = vi.hoisted(() => vi.fn());
const mockEmailSend = vi.hoisted(() => vi.fn());
const mockStyleDNAFindMany = vi.hoisted(() => vi.fn());
const mockOutfitFindMany = vi.hoisted(() => vi.fn());

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: mockGenerateContent };
    }
  },
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mockEmailSend };
  },
}));

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    styleDNA: {
      findMany: mockStyleDNAFindMany,
    },
    outfitCheck: {
      findMany: mockOutfitFindMany,
    },
  },
}));

// ─── Service Import (after all mocks) ─────────────────────────────────────────

import { runContentCalendar, getTrendData } from '../content-calendar.service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SAMPLE_POSTS = [
  {
    day: 'Monday',
    platform: 'Instagram',
    caption: 'Test caption 1',
    hashtags: ['#fashion', '#style'],
    imageDescription: 'A stylish outfit',
    postTime: '7:00 PM ET',
  },
  {
    day: 'Tuesday',
    platform: 'TikTok',
    caption: 'Test caption 2',
    hashtags: ['#ootd', '#outfit'],
    imageDescription: 'Casual look',
    postTime: '6:00 PM ET',
  },
  {
    day: 'Wednesday',
    platform: 'Twitter/X',
    caption: 'Test caption 3',
    hashtags: ['#minimalist'],
    imageDescription: 'Clean aesthetic',
    postTime: '12:00 PM ET',
  },
  {
    day: 'Thursday',
    platform: 'Instagram',
    caption: 'Test caption 4',
    hashtags: ['#streetwear'],
    imageDescription: 'Urban look',
    postTime: '5:00 PM ET',
  },
  {
    day: 'Friday',
    platform: 'Instagram',
    caption: 'Test caption 5',
    hashtags: ['#classic', '#preppy'],
    imageDescription: 'Polished style',
    postTime: '8:00 PM ET',
  },
];

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();

  // getTrendData defaults
  mockStyleDNAFindMany.mockResolvedValue([
    { styleArchetypes: ['casual', 'minimalist'], dominantColors: ['navy', 'white'] },
    { styleArchetypes: ['casual', 'streetwear'], dominantColors: ['black', 'beige'] },
  ]);
  mockOutfitFindMany.mockResolvedValue([
    { occasions: ['Work', 'Casual'] },
    { occasions: ['Date night', 'Casual'] },
  ]);

  // Gemini returns valid 5-post JSON array
  mockGenerateContent.mockResolvedValue({
    response: {
      text: () => JSON.stringify(SAMPLE_POSTS),
    },
  });

  mockEmailSend.mockResolvedValue({ id: 'email-cc-1' });

  vi.stubEnv('RESEND_API_KEY', 're_test');
  vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');
  vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── runContentCalendar ───────────────────────────────────────────────────────

describe('runContentCalendar', () => {
  it('skips when RESEND_API_KEY is not set', async () => {
    vi.stubEnv('RESEND_API_KEY', '');

    await runContentCalendar();

    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('skips when REPORT_RECIPIENT_EMAIL is not set', async () => {
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', '');

    await runContentCalendar();

    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('calls Gemini once to generate post ideas', async () => {
    await runContentCalendar();

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    const [promptArg] = mockGenerateContent.mock.calls[0];
    expect(typeof promptArg).toBe('string');
    expect(promptArg).toContain('Or This?');
    expect(promptArg).toContain('5 social media post ideas');
  }, 15000);

  it('calls resend.emails.send with content calendar email', async () => {
    await runContentCalendar();

    expect(mockEmailSend).toHaveBeenCalledOnce();
    const args = mockEmailSend.mock.calls[0][0];
    expect(args.subject).toContain('Or This? Content Calendar');
    expect(args.to).toBe('founder@orthis.app');
    expect(args.html).toContain('Monday');
  });

  it('does not throw when Gemini fails', async () => {
    mockGenerateContent.mockRejectedValue(new Error('Gemini unavailable'));

    await expect(runContentCalendar()).resolves.toBeUndefined();
    expect(mockEmailSend).not.toHaveBeenCalled();
  });
});

// ─── getTrendData ─────────────────────────────────────────────────────────────

describe('getTrendData', () => {
  it('returns fallback data when prisma throws', async () => {
    mockStyleDNAFindMany.mockRejectedValue(new Error('DB connection failed'));

    const result = await getTrendData();

    expect(result.topStyles).toEqual(['casual', 'minimalist', 'classic', 'streetwear', 'preppy']);
    expect(result.popularOccasions).toEqual(['Work', 'Casual', 'Date night', 'Weekend brunch']);
    expect(result.colorTrends).toEqual(['navy', 'white', 'black', 'beige', 'olive']);
  });

  it('returns top styles and occasions computed from DB data', async () => {
    // 3× casual, 2× minimalist, 1× streetwear in styleDNA
    mockStyleDNAFindMany.mockResolvedValue([
      { styleArchetypes: ['casual', 'minimalist'], dominantColors: ['navy'] },
      { styleArchetypes: ['casual', 'minimalist'], dominantColors: ['white'] },
      { styleArchetypes: ['casual', 'streetwear'], dominantColors: ['black'] },
    ]);
    // 2× Work, 1× Casual in outfitChecks
    mockOutfitFindMany.mockResolvedValue([
      { occasions: ['Work', 'Casual'] },
      { occasions: ['Work'] },
    ]);

    const result = await getTrendData();

    expect(result.topStyles[0]).toBe('casual'); // most common archetype
    expect(result.popularOccasions[0]).toBe('Work'); // most common occasion
    expect(result.colorTrends).toContain('navy');
  });
});
