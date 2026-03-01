import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockGenerateContent = vi.hoisted(() => vi.fn());
const mockHasBudget = vi.hoisted(() => vi.fn());
const mockAsoFindMany = vi.hoisted(() => vi.fn());
const mockPublishBus = vi.hoisted(() => vi.fn());
const mockEmailSend = vi.hoisted(() => vi.fn());

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
    asoSnapshot: { findMany: mockAsoFindMany },
  },
}));

vi.mock('../intelligence-bus.service.js', () => ({
  publishToIntelligenceBus: mockPublishBus,
}));

vi.mock('../token-budget.service.js', () => ({
  hasLearningBudget: mockHasBudget,
}));

import { runCompetitiveIntel } from '../competitive-intel.service.js';

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockGenerateContent.mockReset();
  mockHasBudget.mockReset();
  mockAsoFindMany.mockReset();
  mockPublishBus.mockReset();
  mockEmailSend.mockReset();

  // Default: budget available, no ASO data, Gemini returns analysis
  mockHasBudget.mockResolvedValue(true);
  mockAsoFindMany.mockResolvedValue([]);
  mockGenerateContent.mockResolvedValue({
    response: { text: () => 'Target keyword: outfit checker. Differentiate via AI accuracy.' },
  });
  mockPublishBus.mockResolvedValue(undefined);
  mockEmailSend.mockResolvedValue({ id: 'email-1' });

  // Default: GEMINI_API_KEY is set
  vi.stubEnv('GEMINI_API_KEY', 'gemini-key-test');
});

// Restore env stubs after each test
afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runCompetitiveIntel', () => {
  describe('early-exit guards', () => {
    it('skips when token budget is insufficient', async () => {
      mockHasBudget.mockResolvedValue(false);

      await runCompetitiveIntel();

      expect(mockGenerateContent).not.toHaveBeenCalled();
      expect(mockPublishBus).not.toHaveBeenCalled();
    });

    it('skips when GEMINI_API_KEY is not set', async () => {
      vi.stubEnv('GEMINI_API_KEY', '');

      await runCompetitiveIntel();

      expect(mockGenerateContent).not.toHaveBeenCalled();
      expect(mockPublishBus).not.toHaveBeenCalled();
    });
  });

  describe('Gemini analysis', () => {
    it('calls generateContent with a prompt containing all four competitor names', async () => {
      await runCompetitiveIntel();

      const prompt = mockGenerateContent.mock.calls[0][0] as string;
      expect(prompt).toContain('Stylebook');
      expect(prompt).toContain('Combyne');
      expect(prompt).toContain('Smart Closet');
      expect(prompt).toContain('Cladwell');
    });

    it('calls generateContent once', async () => {
      await runCompetitiveIntel();

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('publishes the analysis text to the intelligence bus', async () => {
      mockGenerateContent.mockResolvedValue({
        response: { text: () => 'Focus on "outfit feedback" keyword gap.' },
      });

      await runCompetitiveIntel();

      const payload = mockPublishBus.mock.calls[0][2];
      expect(payload.analysis).toBe('Focus on "outfit feedback" keyword gap.');
    });

    it('publishes the list of tracked competitors', async () => {
      await runCompetitiveIntel();

      const payload = mockPublishBus.mock.calls[0][2];
      expect(payload.competitors).toContain('Stylebook');
      expect(payload.competitors).toHaveLength(4);
    });
  });

  describe('Gemini failure handling', () => {
    it('does not throw when Gemini call fails', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Network timeout'));

      await expect(runCompetitiveIntel()).resolves.toBeUndefined();
    });

    it('still publishes to bus with fallback text when Gemini fails', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Network timeout'));

      await runCompetitiveIntel();

      expect(mockPublishBus).toHaveBeenCalled();
      const payload = mockPublishBus.mock.calls[0][2];
      expect(payload.analysis).toContain('Unable to generate');
    });
  });

  describe('ASO context', () => {
    it('queries asoSnapshot 5 times (1 for Or This? + 4 competitors)', async () => {
      await runCompetitiveIntel();

      expect(mockAsoFindMany).toHaveBeenCalledTimes(5);
    });

    it('falls back to hardcoded context when no ASO snapshots exist', async () => {
      mockAsoFindMany.mockResolvedValue([]);

      await runCompetitiveIntel();

      // Should not throw and should still call Gemini
      expect(mockGenerateContent).toHaveBeenCalled();
    });

    it('includes ASO data in the prompt when snapshots exist', async () => {
      mockAsoFindMany.mockResolvedValueOnce([
        { keyword: 'outfit feedback', store: 'ios', difficulty: 3.2, traffic: 8.5, currentRank: 5 },
      ]);
      // remaining 4 competitors return empty
      mockAsoFindMany.mockResolvedValue([]);

      await runCompetitiveIntel();

      const prompt = mockGenerateContent.mock.calls[0][0] as string;
      expect(prompt).toContain('outfit feedback');
    });
  });

  describe('email', () => {
    it('sends a weekly intel email when Resend is configured', async () => {
      vi.stubEnv('RESEND_API_KEY', 're_test');
      vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');

      await runCompetitiveIntel();

      expect(mockEmailSend).toHaveBeenCalledTimes(1);
    });

    it('does not send email when RESEND_API_KEY is not set', async () => {
      vi.stubEnv('RESEND_API_KEY', '');

      await runCompetitiveIntel();

      expect(mockEmailSend).not.toHaveBeenCalled();
    });

    it('does not throw when email sending fails', async () => {
      vi.stubEnv('RESEND_API_KEY', 're_test');
      vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');
      mockEmailSend.mockRejectedValue(new Error('Resend 500'));

      await expect(runCompetitiveIntel()).resolves.toBeUndefined();
    });
  });

  describe('bus publish failure', () => {
    it('does not throw when bus publish fails', async () => {
      mockPublishBus.mockRejectedValue(new Error('Bus unavailable'));

      await expect(runCompetitiveIntel()).resolves.toBeUndefined();
    });
  });
});
