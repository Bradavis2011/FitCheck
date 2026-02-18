import { PostHog } from 'posthog-node';

let _client: PostHog | null = null;

function getClient(): PostHog | null {
  if (_client) return _client;
  const key = process.env.POSTHOG_API_KEY;
  if (!key) return null;
  _client = new PostHog(key, {
    host: 'https://us.i.posthog.com',
    flushAt: 20,
    flushInterval: 10000,
  });
  return _client;
}

export function trackServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
): void {
  try {
    const client = getClient();
    if (!client) return;
    client.capture({ distinctId, event, properties: properties ?? {} });
  } catch {
    // analytics never crashes the server
  }
}

export async function shutdownPostHog(): Promise<void> {
  try {
    if (_client) await _client.shutdown();
  } catch {
    // ignore
  }
}
