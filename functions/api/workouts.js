export async function onRequestGet({ env }) {
  const result = await env.DB.prepare(
    "SELECT * FROM workouts ORDER BY date DESC"
  ).all();
  return Response.json(result.results);
}

export async function onRequestPost({ request, env }) {
  const { id, date, duration, notes, exercises } = await request.json();
  await env.DB.prepare(
    "INSERT INTO workouts (id, date, duration, notes, exercises, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(id, date, duration || '', notes || '', JSON.stringify(exercises), Date.now()).run();
  return Response.json({ success: true });
}
