import { jsonResponse } from './_lib/http.js';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  return jsonResponse(
    {
      service: 'systemfehler-api',
      version: '0.1.0',
      runtime: 'cloudflare-pages-functions',
      deploymentTarget: 'cloudflare-pages',
      host: url.host,
      timestamp: new Date().toISOString()
    },
    { request: context.request, env: context.env }
  );
}
