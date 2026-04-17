const DEFAULT_MAX_JSON_BYTES = 1_000_000;

function parseAllowedOrigins(env) {
  const raw = String(env?.CORS_ALLOWED_ORIGINS || '').trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function resolveAllowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return null;

  const requestOrigin = new URL(request.url).origin;
  if (origin === requestOrigin) return origin;

  const allowlist = parseAllowedOrigins(env);
  if (allowlist.includes(origin)) return origin;
  return null;
}

export function buildCorsHeaders(request, env, options = {}) {
  const allowedOrigin = resolveAllowedOrigin(request, env);
  if (!allowedOrigin) return {};

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': options.methods || 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': options.headers || 'Content-Type, Authorization, x-turnstile-token',
    'Access-Control-Max-Age': String(options.maxAge || 86400),
    Vary: 'Origin',
  };
}

function secureHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'same-origin',
  };
}

export function jsonResponse(payload, options = {}) {
  const {
    status = 200,
    request,
    env,
    cors = false,
    corsOptions = {},
    headers = {},
  } = options;

  const responseHeaders = {
    'content-type': 'application/json; charset=utf-8',
    ...secureHeaders(),
    ...headers,
  };

  if (cors && request) {
    Object.assign(responseHeaders, buildCorsHeaders(request, env, corsOptions));
  }

  return new Response(JSON.stringify(payload), { status, headers: responseHeaders });
}

export function optionsResponse(request, env, corsOptions = {}) {
  return new Response(null, {
    status: 204,
    headers: {
      ...secureHeaders(),
      ...buildCorsHeaders(request, env, corsOptions),
    },
  });
}

export function applySecurityHeaders(response, request, env, corsOptions = null) {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  if (corsOptions && request) {
    const corsHeaders = buildCorsHeaders(request, env, corsOptions);
    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value);
    }
  }
  return response;
}

export async function readJsonBody(request, options = {}) {
  const maxBytes = Number.isFinite(options.maxBytes) ? options.maxBytes : DEFAULT_MAX_JSON_BYTES;
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return { ok: false, status: 415, error: 'Content-Type must be application/json' };
  }

  const contentLengthRaw = request.headers.get('content-length');
  if (contentLengthRaw) {
    const contentLength = Number.parseInt(contentLengthRaw, 10);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      return { ok: false, status: 413, error: 'Payload too large' };
    }
  }

  try {
    const body = await request.json();
    return { ok: true, body };
  } catch {
    return { ok: false, status: 400, error: 'Invalid JSON body' };
  }
}

export function clampPositiveInt(raw, fallback, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}
