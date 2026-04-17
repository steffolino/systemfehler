import { jsonResponse } from './_lib/http.js';

export async function onRequest(context) {
  return jsonResponse(
    { status: 'ok', timestamp: new Date().toISOString() },
    { request: context.request, env: context.env }
  );
}
