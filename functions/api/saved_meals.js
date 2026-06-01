import { requireAuth } from './_auth.js';

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { results } = await context.env.DB.prepare(
    'SELECT * FROM saved_meals WHERE user_id = ? ORDER BY name ASC'
  ).bind(auth.user_id).all();
  return Response.json(results);
}

export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { id, name, meal_type, kcal, protein, carbs, fat, items } = await context.request.json();
  await context.env.DB.prepare(
    `INSERT INTO saved_meals (id, user_id, name, meal_type, kcal, protein, carbs, fat, items, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, name) DO UPDATE SET
       meal_type=excluded.meal_type, kcal=excluded.kcal,
       protein=excluded.protein, carbs=excluded.carbs, fat=excluded.fat, items=excluded.items`
  ).bind(id, auth.user_id, name, meal_type || 'other', kcal || 0, protein || 0, carbs || 0, fat || 0, items || null, Date.now()).run();
  return Response.json({ ok: true });
}
