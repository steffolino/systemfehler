export async function onRequest({ request, env }) {
  // Clear session cookie and redirect to home
  return new Response('', {
    status: 302,
    headers: {
      'Set-Cookie': 'sf_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
      'Location': '/'
    }
  });
}
