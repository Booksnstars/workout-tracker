import { parseCookies } from '../_auth.js';

export async function onRequestPost({ request, env }) {
  const cookies = parseCookies(request.headers.get('Cookie'));
  const token = cookies['session'];
  if (token) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  }
  return Response.json({ success: true }, {
    headers: {
      'Set-Cookie': 'session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
    }
  });
}
