// TurnstileWidget.tsx
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
  const pendingRef = useRef(false);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    let active = true;

    async function setup() {
      try {
        if (!containerRef.current || !siteKey) {
          onReadyRef.current(null);
          return;
        }

        await loadTurnstileScript();

        if (!active || !window.turnstile || !containerRef.current) return;

        if (widgetIdRef.current) {
          window.turnstile.remove?.(widgetIdRef.current);
          widgetIdRef.current = null;
        }

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => {
            pendingRef.current = false;
            resolveRef.current?.(token);
            resolveRef.current = null;
            rejectRef.current = null;
          },
          'error-callback': () => {
            pendingRef.current = false;
            rejectRef.current?.(new Error('Bot protection challenge failed.'));
            resolveRef.current = null;
            rejectRef.current = null;
          },
          'expired-callback': () => {
            pendingRef.current = false;
            rejectRef.current?.(new Error('Bot protection challenge expired.'));
            resolveRef.current = null;
            rejectRef.current = null;
          },
        });

        const getToken = () =>
          new Promise<string>((resolve, reject) => {
            if (!window.turnstile || !widgetIdRef.current) {
              reject(new Error('Turnstile is not ready.'));
              return;
            }

            if (pendingRef.current) {
              reject(new Error('Turnstile request already in progress.'));
              return;
            }

            pendingRef.current = true;

            const timeoutId = window.setTimeout(() => {
              if (pendingRef.current) {
                pendingRef.current = false;
                rejectRef.current?.(new Error('Turnstile timed out.'));
                resolveRef.current = null;
                rejectRef.current = null;
              }
            }, 30000);

            resolveRef.current = (token: string) => {
              window.clearTimeout(timeoutId);
              resolve(token);
            };

            rejectRef.current = (error: Error) => {
              window.clearTimeout(timeoutId);
              reject(error);
            };

            window.turnstile.reset(widgetIdRef.current);
            window.turnstile.execute(widgetIdRef.current);
          });

        onReadyRef.current(getToken);
      } catch (error) {
        console.error('Turnstile setup failed:', error);
        pendingRef.current = false;
        if (active) onReadyRef.current(null);
      }
    }

    void setup();

    return () => {
      active = false;
      pendingRef.current = false;

      if (rejectRef.current) {
        rejectRef.current(new Error('Turnstile widget was unmounted.'));
      }

      resolveRef.current = null;
      rejectRef.current = null;

      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.remove?.(widgetIdRef.current);
      }

      widgetIdRef.current = null;
    };
  }, [siteKey]);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute -left-[9999px] top-0 h-px w-px overflow-hidden opacity-0"
      aria-hidden="true"
    />
  );
}