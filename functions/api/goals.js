import { requireAuth } from './_auth.js';

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const row = await context.env.DB.prepare(
    'SELECT kcal, protein, steps FROM user_goals WHERE user_id = ?'
  ).bind(auth.user_id).first();
  return Response.json(row || null);
}

export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const body = await context.request.json();
  const kcal = Math.round(Number(body.kcal));
  const protein = Math.round(Number(body.protein));
  const steps = Math.round(Number(body.steps));
  const ok = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;
  if (!ok(kcal, 500, 10000) || !ok(protein, 10, 500) || !ok(steps, 500, 100000)) {
    return Response.json({ error: 'Invalid goals' }, { status: 400 });
  }
  await context.env.DB.prepare(
    `INSERT INTO user_goals (user_id, kcal, protein, steps, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       kcal=excluded.kcal, protein=excluded.protein, steps=excluded.steps, updated_at=excluded.updated_at`
  ).bind(auth.user_id, kcal, protein, steps, Date.now()).run();
  return Response.json({ ok: true, kcal, protein, steps });
}
