export async function onRequest(context) {
  const url = new URL(context.request.url);
  return new Response(
    JSON.stringify({
      service: 'systemfehler-api',
      version: '0.1.0',
      runtime: 'cloudflare-pages-functions',
      deploymentTarget: 'cloudflare-pages',
      host: url.host,
      timestamp: new Date().toISOString()
    }),
    { headers: { 'content-type': 'application/json' } }
  );
}
