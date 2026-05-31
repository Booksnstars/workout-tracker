import { requireAuth } from './_auth.js';

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const result = await context.env.DB.prepare(
    "SELECT * FROM classes WHERE user_id = ? ORDER BY date DESC"
  ).bind(auth.user_id).all();
  return Response.json(result.results);
}

export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { id, class_name, date, duration } = await context.request.json();
  await context.env.DB.prepare(
    "INSERT INTO classes (id, class_name, date, duration, created_at, user_id) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(id, class_name, date, duration || null, Date.now(), auth.user_id).run();
  return Response.json({ success: true });
}
