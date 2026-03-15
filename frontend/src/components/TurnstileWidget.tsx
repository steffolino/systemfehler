import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      execute: (widgetId: string) => void;
      reset: (widgetId: string) => void;
      remove?: (widgetId: string) => void;
    };
    __systemfehlerTurnstileLoader?: Promise<void>;
  }
}

const TURNSTILE_SCRIPT_ID = 'systemfehler-turnstile-script';

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (window.__systemfehlerTurnstileLoader) return window.__systemfehlerTurnstileLoader;

  window.__systemfehlerTurnstileLoader = new Promise((resolve, reject) => {
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Turnstile')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Turnstile'));
    document.head.appendChild(script);
  });

  return window.__systemfehlerTurnstileLoader;
}

export default function TurnstileWidget({
  siteKey,
  onReady,
}: {
  siteKey: string;
  onReady: (getToken: (() => Promise<string>) | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const resolveRef = useRef<((token: string) => void) | null>(null);
  const rejectRef = useRef<((error: Error) => void) | null>(null);

  useEffect(() => {
    let active = true;

    async function setup() {
      if (!containerRef.current || !siteKey) {
        onReady(null);
        return;
      }

      await loadTurnstileScript();
      if (!active || !window.turnstile || !containerRef.current) return;

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        size: 'invisible',
        callback: (token: string) => {
          resolveRef.current?.(token);
          resolveRef.current = null;
          rejectRef.current = null;
        },
        'error-callback': () => {
          rejectRef.current?.(new Error('Bot protection challenge failed.'));
          resolveRef.current = null;
          rejectRef.current = null;
        },
        'expired-callback': () => {
          rejectRef.current?.(new Error('Bot protection challenge expired.'));
          resolveRef.current = null;
          rejectRef.current = null;
        },
      });

      onReady(() => {
        return new Promise<string>((resolve, reject) => {
          if (!window.turnstile || !widgetIdRef.current) {
            reject(new Error('Turnstile is not ready.'));
            return;
          }

          resolveRef.current = resolve;
          rejectRef.current = reject;
          window.turnstile.reset(widgetIdRef.current);
          window.turnstile.execute(widgetIdRef.current);
        });
      });
    }

    void setup().catch(() => {
      if (active) onReady(null);
    });

    return () => {
      active = false;
      onReady(null);
      resolveRef.current = null;
      rejectRef.current = null;
      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.remove?.(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [onReady, siteKey]);

  return <div ref={containerRef} className="hidden" aria-hidden="true" />;
}
