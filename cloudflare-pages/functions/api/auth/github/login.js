export async function onRequest({ env }) {
  const clientId = env.GITHUB_OAUTH_CLIENT_ID;
  const redirectUri = `${env.PAGES_BASE_URL || 'https://systemfehler.pages.dev'}/api/auth/github/callback`;
  const state = crypto.randomUUID();
  // Optionally store state in a short-lived cookie to validate in callback (omitted for brevity)
  const url = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user&state=${state}`;
  return Response.redirect(url, 302);
}
