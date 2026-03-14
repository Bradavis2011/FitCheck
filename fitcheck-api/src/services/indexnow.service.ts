/**
 * IndexNow Service
 *
 * Submits URLs to Bing and Yandex via the IndexNow protocol whenever new
 * content is published. Google is excluded — use Search Console manually.
 *
 * Key file lives at: https://orthis.app/13334acc9b0f8e60c3cf48d4c1364a28.txt
 */

const INDEXNOW_KEY = '13334acc9b0f8e60c3cf48d4c1364a28';
const HOST = 'orthis.app';
const KEY_LOCATION = `https://${HOST}/${INDEXNOW_KEY}.txt`;

/**
 * Submit one or more URLs to IndexNow (Bing + Yandex).
 * Non-fatal — logs on failure but never throws.
 */
export async function submitToIndexNow(slugs: string | string[]): Promise<void> {
  const urlList = (Array.isArray(slugs) ? slugs : [slugs]).map(slug =>
    slug.startsWith('https://') ? slug : `https://${HOST}/learn/${slug}`,
  );

  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOST, key: INDEXNOW_KEY, keyLocation: KEY_LOCATION, urlList }),
      signal: AbortSignal.timeout(10_000),
    });

    if (res.status === 200 || res.status === 202) {
      console.log(`[IndexNow] Submitted ${urlList.length} URL(s) — HTTP ${res.status}`);
    } else {
      console.warn(`[IndexNow] Unexpected response HTTP ${res.status} for ${urlList.join(', ')}`);
    }
  } catch (err) {
    console.warn(`[IndexNow] Submission failed (non-fatal): ${(err as Error).message}`);
  }
}
