import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockHasBudget = vi.hoisted(() => vi.fn());
const mockGenerateContent = vi.hoisted(() => vi.fn());
const mockTicketCreate = vi.hoisted(() => vi.fn());
const mockEmailSend = vi.hoisted(() => vi.fn());

vi.mock('../token-budget.service.js', () => ({
  hasLearningBudget: mockHasBudget,
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: mockGenerateContent };
    }
  },
}));

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    supportTicket: { create: mockTicketCreate },
  },
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mockEmailSend };
  },
}));

import { handleSupportQuestion } from '../support-bot.service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGeminiResponse(text: string) {
  return { response: { text: () => text } };
}

beforeEach(() => {
  mockHasBudget.mockReset();
  mockGenerateContent.mockReset();
  mockTicketCreate.mockReset();
  mockEmailSend.mockReset();

  // Default: budget available, ticket creation succeeds
  mockHasBudget.mockResolvedValue(true);
  mockTicketCreate.mockResolvedValue({ id: 'ticket-1' });
  mockEmailSend.mockResolvedValue({ id: 'email-1' });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('handleSupportQuestion', () => {
  describe('budget guard', () => {
    it('returns polite fallback and escalated=false when no token budget', async () => {
      mockHasBudget.mockResolvedValue(false);

      const result = await handleSupportQuestion('user-1', 'How do I cancel?');

      expect(result.escalated).toBe(false);
      expect(result.response).toContain('temporarily unavailable');
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });
  });

  describe('normal (non-escalated) flow', () => {
    it('returns AI response with escalated=false for a normal question', async () => {
      mockGenerateContent.mockResolvedValue(
        makeGeminiResponse('Free users get 3 outfit checks per day.'),
      );

      const result = await handleSupportQuestion('user-1', 'How many checks do I get?');

      expect(result.escalated).toBe(false);
      expect(result.response).toBe('Free users get 3 outfit checks per day.');
    });

    it('persists a SupportTicket with status "open"', async () => {
      mockGenerateContent.mockResolvedValue(makeGeminiResponse('Got it.'));

      await handleSupportQuestion('user-1', 'What is the app?');

      expect(mockTicketCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'open',
            question: 'What is the app?',
          }),
        }),
      );
    });

    it('does not send an email for non-escalated tickets', async () => {
      mockGenerateContent.mockResolvedValue(makeGeminiResponse('Here is your answer.'));

      await handleSupportQuestion('user-1', 'How do streaks work?');

      expect(mockEmailSend).not.toHaveBeenCalled();
    });
  });

  describe('escalation flow', () => {
    it('returns escalated=true when AI response starts with ESCALATE', async () => {
      mockGenerateContent.mockResolvedValue(
        makeGeminiResponse('ESCALATE - This user is reporting a billing dispute.'),
      );

      const result = await handleSupportQuestion('user-1', 'I was charged twice!');

      expect(result.escalated).toBe(true);
    });

    it('is case-insensitive for ESCALATE detection', async () => {
      mockGenerateContent.mockResolvedValue(
        makeGeminiResponse('escalate - routing to human support.'),
      );

      const result = await handleSupportQuestion('user-1', 'Urgent issue!');

      expect(result.escalated).toBe(true);
    });

    it('persists a SupportTicket with status "escalated" and escalatedAt set', async () => {
      mockGenerateContent.mockResolvedValue(
        makeGeminiResponse('ESCALATE - Billing dispute.'),
      );

      await handleSupportQuestion('user-1', 'Refund please');

      expect(mockTicketCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'escalated',
            escalatedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('sends an alert email when escalated and env vars are set', async () => {
      vi.stubEnv('RESEND_API_KEY', 're_test_key');
      vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');

      mockGenerateContent.mockResolvedValue(
        makeGeminiResponse('ESCALATE - Account locked.'),
      );

      await handleSupportQuestion('user-1', 'I cannot log in');

      expect(mockEmailSend).toHaveBeenCalled();

      vi.unstubAllEnvs();
    });

    it('does not send alert email when RESEND_API_KEY is missing', async () => {
      vi.stubEnv('RESEND_API_KEY', '');
      vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');

      mockGenerateContent.mockResolvedValue(makeGeminiResponse('ESCALATE - Issue.'));

      await handleSupportQuestion('user-1', 'Urgent');

      expect(mockEmailSend).not.toHaveBeenCalled();

      vi.unstubAllEnvs();
    });
  });

  describe('Gemini error handling', () => {
    it('returns a fallback message and escalated=false when Gemini throws', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Network error'));

      const result = await handleSupportQuestion('user-1', 'Any question');

      expect(result.escalated).toBe(false);
      expect(result.response).toContain('support@orthis.app');
    });

    it('still creates a SupportTicket even when Gemini throws', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Timeout'));

      await handleSupportQuestion('user-1', 'Any question');

      expect(mockTicketCreate).toHaveBeenCalled();
    });
  });

  describe('anonymous user handling', () => {
    it('accepts null userId for anonymous support questions', async () => {
      mockGenerateContent.mockResolvedValue(makeGeminiResponse('Here is the answer.'));

      const result = await handleSupportQuestion(null, 'General question');

      expect(result.response).toBeDefined();
      expect(mockTicketCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: undefined }),
        }),
      );
    });
  });

  describe('DB error resilience', () => {
    it('still returns AI response even when ticket persistence fails', async () => {
      mockGenerateContent.mockResolvedValue(makeGeminiResponse('Your answer.'));
      mockTicketCreate.mockRejectedValue(new Error('DB connection error'));

      const result = await handleSupportQuestion('user-1', 'Question');

      expect(result.response).toBe('Your answer.');
      expect(result.escalated).toBe(false);
    });
  });
});
