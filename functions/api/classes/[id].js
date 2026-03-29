export async function onRequestDelete({ params, env }) {
  await env.DB.prepare(
    "DELETE FROM classes WHERE id = ?"
  ).bind(params.id).run();
  return Response.json({ success: true });
}
