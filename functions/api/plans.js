import { requireAuth } from './_auth.js';

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { results } = await context.env.DB.prepare(
    'SELECT id, name, days, created_at FROM workout_plans WHERE user_id = ? ORDER BY created_at ASC'
  ).bind(auth.user_id).all();
  return Response.json(results);
}

export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { id, name, days } = await context.request.json();
  if (!id || !name || !Array.isArray(days)) {
    return Response.json({ error: 'Invalid plan' }, { status: 400 });
  }
  await context.env.DB.prepare(
    `INSERT INTO workout_plans (id, user_id, name, days, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, days=excluded.days
     WHERE workout_plans.user_id = excluded.user_id`
  ).bind(id, auth.user_id, name, JSON.stringify(days), Date.now()).run();
  return Response.json({ ok: true });
}
