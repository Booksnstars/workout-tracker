export async function onRequestDelete({ params, env }) {
  await env.DB.prepare(
    "DELETE FROM workouts WHERE id = ?"
  ).bind(params.id).run();
  return Response.json({ success: true });
}

export async function onRequestPut({ params, request, env }) {
  const { date, duration, notes, exercises } = await request.json();
  await env.DB.prepare(
    "UPDATE workouts SET date = ?, duration = ?, notes = ?, exercises = ? WHERE id = ?"
  ).bind(date, duration || '', notes || '', JSON.stringify(exercises), params.id).run();
  return Response.json({ success: true });
}
