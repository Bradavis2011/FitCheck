/**
 * Pinterest Automation Service
 *
 * Creates pins when articles are published via the operator agent queue.
 * Uses Pinterest API v5 with Bearer token auth.
 *
 * Env vars:
 *   PINTEREST_ACCESS_TOKEN  — OAuth Bearer token from Pinterest developer portal
 *   PINTEREST_BOARD_IDS     — JSON map of niche → board ID
 *                             e.g. {"rush":"123456789","sahm_rto":"987654321","general":"111222333"}
 *
 * Feature-gated: if PINTEREST_ACCESS_TOKEN is not set, operations are no-ops.
 */

import { executeOrQueue } from './agent-manager.service.js';

const PINTEREST_API = 'https://api.pinterest.com/v5';
const SITE_URL = process.env.SITE_URL || 'https://orthis.app';

function getBoardIds(): Record<string, string> {
  const raw = process.env.PINTEREST_BOARD_IDS;
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    console.error('[Pinterest] Invalid PINTEREST_BOARD_IDS JSON');
    return {};
  }
}

interface PinPayload {
  boardId: string;
  title: string;
  description: string;
  link: string;
  imageUrl?: string;
}

async function createPin(payload: PinPayload): Promise<{ id: string } | null> {
  const token = process.env.PINTEREST_ACCESS_TOKEN;
  if (!token) {
    console.log('[Pinterest] PINTEREST_ACCESS_TOKEN not set — skipping pin creation');
    return null;
  }

  const body: Record<string, unknown> = {
    board_id: payload.boardId,
    title: payload.title,
    description: payload.description,
    link: payload.link,
  };

  if (payload.imageUrl) {
    body.media_source = {
      source_type: 'image_url',
      url: payload.imageUrl,
    };
  }

  const res = await fetch(`${PINTEREST_API}/pins`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`[Pinterest] Pin creation failed: ${res.status} ${text}`);
    return null;
  }

  const data = await res.json() as { id?: string };
  console.log(`[Pinterest] Pin created: ${data.id}`);
  return { id: data.id ?? '' };
}

/**
 * Queue a Pinterest pin via the operator agent system.
 * Medium risk → brand-guarded before auto-publishing.
 */
export async function queuePinterestPin(
  slug: string,
  title: string,
  description: string,
  niche: string,
): Promise<void> {
  const token = process.env.PINTEREST_ACCESS_TOKEN;
  if (!token) {
    console.log('[Pinterest] PINTEREST_ACCESS_TOKEN not set — skipping pin queue');
    return;
  }

  const boardIds = getBoardIds();
  const boardId = boardIds[niche] || boardIds['general'];

  if (!boardId) {
    console.log(`[Pinterest] No board ID configured for niche "${niche}" — skipping pin`);
    return;
  }

  const articleUrl = `${SITE_URL}/learn/${slug}`;
  // Truncate description to Pinterest's 500-char limit
  const shortDesc = description.slice(0, 490);

  try {
    await executeOrQueue(
      'seo-content',
      'create_pin',
      'medium',
      { slug, title, description: shortDesc, niche, boardId, articleUrl },
      async (payload) => {
        const p = payload as { title: string; description: string; boardId: string; articleUrl: string };
        const pin = await createPin({
          boardId: p.boardId,
          title: p.title,
          description: p.description,
          link: p.articleUrl,
        });
        return { pinned: pin != null, pinId: pin?.id };
      },
      title + ' ' + shortDesc,
    );
    console.log(`[Pinterest] Pin queued for "${title}" (${niche})`);
  } catch (err) {
    console.error('[Pinterest] Failed to queue pin:', err);
  }
}
