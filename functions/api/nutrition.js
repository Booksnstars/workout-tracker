import { requireAuth } from './_auth.js';

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { results } = await context.env.DB.prepare(
    'SELECT * FROM nutrition WHERE user_id = ? ORDER BY date DESC, created_at DESC'
  ).bind(auth.user_id).all();
  return Response.json(results);
}

export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { id, date, meal_type, name, kcal, protein, carbs, fat } = await context.request.json();
  await context.env.DB.prepare(
    'INSERT INTO nutrition (id, user_id, date, meal_type, name, kcal, protein, carbs, fat, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, auth.user_id, date, meal_type || 'other', name, kcal || 0, protein || 0, carbs || 0, fat || 0, Date.now()).run();
  return Response.json({ ok: true });
}
