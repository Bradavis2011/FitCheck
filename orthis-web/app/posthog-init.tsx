'use client';

import posthog from 'posthog-js';
import { useEffect } from 'react';

export default function PostHogInit() {
  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: true,
    });
  }, []);
  return null;
}
