export function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach(part => {
    const [k, ...v] = part.trim().split('=');
    cookies[k.trim()] = v.join('=').trim();
  });
  return cookies;
}

export async function requireAuth({ request, env }) {
  const cookies = parseCookies(request.headers.get('Cookie'));
  const token = cookies['session'];
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const row = await env.DB.prepare(
    `SELECT s.user_id, u.username FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?`
  ).bind(token, Date.now()).first();

  if (!row) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  return { user_id: row.user_id, username: row.username };
}
