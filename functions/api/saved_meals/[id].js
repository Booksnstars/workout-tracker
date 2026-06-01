import { requireAuth } from '../_auth.js';

export async function onRequestDelete(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { id } = context.params;
  await context.env.DB.prepare(
    'DELETE FROM saved_meals WHERE id = ? AND user_id = ?'
  ).bind(id, auth.user_id).run();
  return Response.json({ ok: true });
}
