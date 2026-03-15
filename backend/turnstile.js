const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || '';
const TURNSTILE_VERIFY_URL =
  process.env.TURNSTILE_VERIFY_URL ||
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function isTurnstileConfigured() {
  return Boolean(TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstileToken({ token, remoteIp }) {
  if (!isTurnstileConfigured()) {
    return { success: true, skipped: true };
  }

  if (!token || typeof token !== 'string') {
    return {
      success: false,
      skipped: false,
      errorCodes: ['missing-input-response'],
    };
  }

  const body = new URLSearchParams();
  body.set('secret', TURNSTILE_SECRET_KEY);
  body.set('response', token);
  if (remoteIp) {
    body.set('remoteip', remoteIp);
  }

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    return {
      success: false,
      skipped: false,
      errorCodes: [`http_${response.status}`],
    };
  }

  const payload = await response.json();
  return {
    success: Boolean(payload?.success),
    skipped: false,
    errorCodes: Array.isArray(payload?.['error-codes']) ? payload['error-codes'] : [],
  };
}
