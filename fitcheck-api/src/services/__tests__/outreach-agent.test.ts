import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Hoisted Mocks ────────────────────────────────────────────────────────────

const mockGenerateContent = vi.hoisted(() => vi.fn());
const mockEmailSend = vi.hoisted(() => vi.fn());
const mockExecuteOrQueue = vi.hoisted(() => vi.fn());
const mockRegisterExecutor = vi.hoisted(() => vi.fn());

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

vi.mock('../agent-manager.service.js', () => ({
  executeOrQueue: mockExecuteOrQueue,
  registerExecutor: mockRegisterExecutor,
}));

// ─── Service Import (after all mocks) ─────────────────────────────────────────

import { runOutreachAgent, registerExecutors } from '../outreach-agent.service.js';

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();

  // Default Gemini response: valid JSON draft
  mockGenerateContent.mockResolvedValue({
    response: {
      text: () => '{"subject":"Great app!","body":"Check out Or This?"}',
    },
  });

  mockExecuteOrQueue.mockResolvedValue(undefined);
  mockEmailSend.mockResolvedValue({ id: 'email-oa-1' });

  vi.stubEnv('GEMINI_API_KEY', 'key');
  vi.stubEnv('RESEND_API_KEY', 're_test');
  vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── runOutreachAgent ─────────────────────────────────────────────────────────

describe('runOutreachAgent', () => {
  it('skips when GEMINI_API_KEY is not set', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');

    await runOutreachAgent();

    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(mockExecuteOrQueue).not.toHaveBeenCalled();
  });

  it('skips when RESEND_API_KEY is not set', async () => {
    vi.stubEnv('RESEND_API_KEY', '');

    await runOutreachAgent();

    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(mockExecuteOrQueue).not.toHaveBeenCalled();
  });

  it('skips when REPORT_RECIPIENT_EMAIL is not set', async () => {
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', '');

    await runOutreachAgent();

    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(mockExecuteOrQueue).not.toHaveBeenCalled();
  });

  it('calls generateContent 4 times (once per target)', async () => {
    await runOutreachAgent();

    expect(mockGenerateContent).toHaveBeenCalledTimes(4);
  });

  it('calls executeOrQueue 4 times with "high" risk level', async () => {
    await runOutreachAgent();

    expect(mockExecuteOrQueue).toHaveBeenCalledTimes(4);
    for (const call of mockExecuteOrQueue.mock.calls) {
      const [agent, actionType, riskLevel] = call;
      expect(agent).toBe('outreach-agent');
      expect(actionType).toBe('outreach_draft');
      expect(riskLevel).toBe('high');
    }
  });

  it('does not throw when generateContent fails for one target (target skipped, others continue)', async () => {
    // First target fails, others succeed
    mockGenerateContent
      .mockRejectedValueOnce(new Error('Gemini quota exceeded'))
      .mockResolvedValue({
        response: {
          text: () => '{"subject":"Great app!","body":"Check out Or This?"}',
        },
      });

    await expect(runOutreachAgent()).resolves.toBeUndefined();
    // Only 3 successful drafts → executeOrQueue called 3 times
    expect(mockExecuteOrQueue).toHaveBeenCalledTimes(3);
  });

  it('does not call executeOrQueue when Gemini returns invalid JSON (no JSON match)', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => 'Sorry, I cannot generate that right now.',
      },
    });

    await runOutreachAgent();

    expect(mockExecuteOrQueue).not.toHaveBeenCalled();
  });
});

// ─── registerExecutors ────────────────────────────────────────────────────────

describe('registerExecutors', () => {
  it('calls registerExecutor once with "outreach-agent" and "outreach_draft" args', () => {
    // Reset to isolate this test from the auto-register call at module load
    mockRegisterExecutor.mockReset();

    registerExecutors();

    expect(mockRegisterExecutor).toHaveBeenCalledOnce();
    expect(mockRegisterExecutor).toHaveBeenCalledWith(
      'outreach-agent',
      'outreach_draft',
      expect.any(Function),
    );
  });
});
