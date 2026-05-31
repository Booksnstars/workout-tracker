import { requireAuth } from '../_auth.js';

export async function onRequestDelete(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  await context.env.DB.prepare(
    "DELETE FROM classes WHERE id = ? AND user_id = ?"
  ).bind(context.params.id, auth.user_id).run();
  return Response.json({ success: true });
}
