function toHex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const saltBytes = Uint8Array.from(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)));
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return toHex(bits);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function onRequestPost({ request, env }) {
  const { username, password } = await request.json();
  const u = (username || '').toLowerCase().trim();

  const user = await env.DB.prepare(
    'SELECT id, password_hash, salt FROM users WHERE username = ?'
  ).bind(u).first();

  // Always hash even if user not found, to prevent timing-based user enumeration
  const saltHex = user ? user.salt : toHex(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await hashPassword(password || '', saltHex);

  if (!user || !timingSafeEqual(user.password_hash, hash)) {
    return Response.json({ error: 'Invalid username or password.' }, { status: 401 });
  }

  // Clean up expired sessions for this user
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at < ?').bind(user.id, Date.now()).run();

  const token = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const now = Date.now();
  await env.DB.prepare(
    'INSERT INTO sessions (id, user_id, token, created_at, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(now, user.id, token, now, now + 30 * 24 * 60 * 60 * 1000).run();

  return Response.json({ username: u }, {
    headers: {
      'Set-Cookie': `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000`
    }
  });
}
