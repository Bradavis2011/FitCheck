'use client';

import posthog from 'posthog-js';
import { useEffect } from 'react';

export default function PostHogInit() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) {
      console.warn('[PostHog] NEXT_PUBLIC_POSTHOG_KEY is not set — analytics disabled');
      return;
    }
    posthog.init(key, {
      api_host: 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: true,
    });
  }, []);
  return null;
}
