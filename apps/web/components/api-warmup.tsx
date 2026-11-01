'use client';

import { useEffect } from 'react';

/**
 * Starts the free Render API and Neon database while the customer is already
 * viewing the web page. This is a one-time best-effort warm-up, not a keep-alive
 * loop: the services are still allowed to sleep after their free-tier idle window.
 */
export function ApiWarmup() {
  useEffect(() => {
    let cancelled = false;

    const warmApi = async () => {
      for (let attempt = 0; attempt < 3 && !cancelled; attempt += 1) {
        try {
          const response = await fetch('/api/health/ready', {
            method: 'GET',
            cache: 'no-store',
            credentials: 'same-origin',
          });

          if (response.ok) return;
        } catch {
          // Render may still be waking the API. Retry a small, bounded number of times.
        }

        if (attempt < 2 && !cancelled) {
          await new Promise<void>(resolve => setTimeout(resolve, 5000));
        }
      }
    };

    void warmApi();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
