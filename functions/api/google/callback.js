export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    return new Response('Missing code or state', { status: 400 });
  }

  // Verify the session token from state
  const session = await context.env.DB.prepare(
    'SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?'
  ).bind(state, Date.now()).first();

  if (!session) {
    return new Response('Invalid session. Please log in and try again.', { status: 401 });
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: context.env.GOOGLE_CLIENT_ID,
      client_secret: context.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: 'https://workout.sardine.dev/api/google/callback',
      grant_type: 'authorization_code',
    }),
  });

  const tokens = await tokenRes.json();

  if (!tokens.access_token) {
    return new Response('Failed to get tokens from Google: ' + JSON.stringify(tokens), { status: 500 });
  }

  const expiresAt = Date.now() + (tokens.expires_in * 1000);

  await context.env.DB.prepare(
    'INSERT OR REPLACE INTO google_tokens (user_id, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(session.user_id, tokens.access_token, tokens.refresh_token || '', expiresAt).run();

  // Redirect back to the app
  return new Response('<html><body><script>window.location.href="/";</script>Connected! Redirecting...</body></html>', {
    headers: { 'Content-Type': 'text/html' },
  });
}
