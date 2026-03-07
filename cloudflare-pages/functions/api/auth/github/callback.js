// Uses Web Crypto to sign a simple JWT (HMAC-SHA256)
async function hmacSign(secret, msg) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

export async function onRequest({ request, env }) {
  // ...existing code for exchanging code, fetching user, allowlist check, issuing JWT cookie...
}
