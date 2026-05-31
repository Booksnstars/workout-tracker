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

export async function onRequestPost({ request, env }) {
  const { username, password } = await request.json();

  const u = (username || '').toLowerCase().trim();
  if (!/^[a-z0-9_]{3,30}$/.test(u)) {
    return Response.json({ error: 'Username must be 3–30 characters (letters, numbers, underscores).' }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }

  const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(u).first();
  if (existing) {
    return Response.json({ error: 'Username already taken.' }, { status: 409 });
  }

  const saltHex = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await hashPassword(password, saltHex);
  const userId = Date.now();
  await env.DB.prepare(
    'INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(userId, u, hash, saltHex, userId).run();

  const token = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const now = Date.now();
  await env.DB.prepare(
    'INSERT INTO sessions (id, user_id, token, created_at, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(now, userId, token, now, now + 30 * 24 * 60 * 60 * 1000).run();

  return Response.json({ username: u }, {
    headers: {
      'Set-Cookie': `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000`
    }
  });
}
