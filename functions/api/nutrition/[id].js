import { requireAuth } from '../_auth.js';

export async function onRequestDelete(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { id } = context.params;
  await context.env.DB.prepare(
    'DELETE FROM nutrition WHERE id = ? AND user_id = ?'
  ).bind(id, auth.user_id).run();
  return Response.json({ ok: true });
}

const MEAL_TYPES = ['breakfast', 'snack-am', 'lunch', 'snack-pm', 'dinner', 'other'];

export async function onRequestPut(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { id } = context.params;
  const b = await context.request.json();
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  const num = v => Number(v);
  const ok = v => Number.isFinite(v) && v >= 0 && v <= 100000;
  const kcal = Math.round(num(b.kcal));
  const protein = num(b.protein), carbs = num(b.carbs), fat = num(b.fat);
  if (!name || !MEAL_TYPES.includes(b.meal_type) || !ok(kcal) || !ok(protein) || !ok(carbs) || !ok(fat)) {
    return Response.json({ error: 'Invalid meal' }, { status: 400 });
  }
  const quantity = typeof b.quantity === 'string' && b.quantity.trim() ? b.quantity.trim().slice(0, 60) : null;
  const res = await context.env.DB.prepare(
    `UPDATE nutrition SET name = ?, meal_type = ?, kcal = ?, protein = ?, carbs = ?, fat = ?, quantity = ?
     WHERE id = ? AND user_id = ?`
  ).bind(name, b.meal_type, kcal, protein, carbs, fat, quantity, id, auth.user_id).run();
  if (!res.meta || res.meta.changes === 0) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ ok: true });
}
