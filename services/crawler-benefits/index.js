// Cloudflare Workers-compatible handler for the crawler (stub/example).
export default {
  async fetch(request, env, ctx) {
    // Implement your crawler logic here if you want to expose it as a Worker endpoint.
    // For most use cases, the crawler runs as a Node.js script, not as a Worker.
    return new Response(
      JSON.stringify({ ok: false, error: "Crawler is not available as a Worker endpoint." }),
      { status: 501, headers: { "Content-Type": "application/json" } }
    );
  }
}
