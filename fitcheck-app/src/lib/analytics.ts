import PostHog from 'posthog-react-native';

// All tracked event names — add new ones here to keep tracking type-safe
export type AnalyticsEvent =
  | 'app_opened'
  | 'outfit_check_started'
  | 'outfit_check_completed'
  | 'feedback_given'
  | 'upgrade_screen_viewed'
  | 'upgrade_completed'
  | 'feature_used'
  | 'share_tapped'
  | 'follow_up_asked';

// Per-event property shapes
export type EventProperties = {
  app_opened: Record<string, never>;
  outfit_check_started: { source: 'camera' | 'gallery' };
  outfit_check_completed: { score: number; occasion?: string };
  feedback_given: { outfit_id: string; score: number };
  upgrade_screen_viewed: { current_tier: string };
  upgrade_completed: { new_tier: string; product_id?: string; billing?: string };
  feature_used: { feature: string };
  share_tapped: { score: number; method?: string };
  follow_up_asked: { outfit_id: string; question_number: number };
};

let _client: PostHog | null = null;

export function initAnalytics(): void {
  try {
    const key = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
    if (!key) return; // No-op in dev without key
    if (_client) return; // Already initialized
    _client = new PostHog(key, {
      host: 'https://us.i.posthog.com',
      // Disable session replay and autocapture for React Native — just event tracking
      enableSessionReplay: false,
    });
  } catch {
    // analytics never crashes the app
  }
}

export function identify(userId: string, traits?: Record<string, unknown>): void {
  try {
    if (!_client) return;
    _client.identify(userId, traits as any);
  } catch {
    // ignore
  }
}

export function track<E extends AnalyticsEvent>(
  event: E,
  properties?: EventProperties[E]
): void {
  try {
    if (!_client) return;
    _client.capture(event, (properties as any) ?? {});
  } catch {
    // ignore
  }
}

export function reset(): void {
  try {
    if (!_client) return;
    _client.reset();
  } catch {
    // ignore
  }
}
