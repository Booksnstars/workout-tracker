import { requireAuth } from '../_auth.js';

export async function onRequestDelete(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  await context.env.DB.prepare(
    "DELETE FROM workouts WHERE id = ? AND user_id = ?"
  ).bind(context.params.id, auth.user_id).run();
  return Response.json({ success: true });
}

export async function onRequestPut(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { date, duration, notes, exercises } = await context.request.json();
  await context.env.DB.prepare(
    "UPDATE workouts SET date = ?, duration = ?, notes = ?, exercises = ? WHERE id = ? AND user_id = ?"
  ).bind(date, duration || '', notes || '', JSON.stringify(exercises), context.params.id, auth.user_id).run();
  return Response.json({ success: true });
}
