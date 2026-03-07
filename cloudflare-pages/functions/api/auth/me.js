export async function onRequest({ request, env }) {
  const cookie = request.headers.get('cookie') || '';
  const m = cookie.match(/(?:^|; )sf_session=([^;]+)/);
  if (!m) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' }});
  const token = m[1];
  // verify token: split and verify HMAC (same logic as callback). If valid and not expired, return {login, allowed}
  // ...existing code...
}
