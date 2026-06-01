import { requireAuth } from './_auth.js';

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { results } = await context.env.DB.prepare(
    'SELECT * FROM activities WHERE user_id = ? ORDER BY date DESC'
  ).bind(auth.user_id).all();
  return Response.json(results);
}

export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { id, date, activity_name, duration, calories, avg_hr, distance, steps, source } = await context.request.json();
  await context.env.DB.prepare(
    'INSERT INTO activities (id, user_id, date, activity_name, duration, calories, avg_hr, distance, steps, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, auth.user_id, date, activity_name, duration || null, calories || null, avg_hr || null, distance || null, steps || null, source || 'manual', Date.now()).run();
  return Response.json({ ok: true });
}
