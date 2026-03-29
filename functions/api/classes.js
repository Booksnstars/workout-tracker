export async function onRequestGet({ env }) {
  const result = await env.DB.prepare(
    "SELECT * FROM classes ORDER BY date DESC"
  ).all();
  return Response.json(result.results);
}

export async function onRequestPost({ request, env }) {
  const { id, class_name, date } = await request.json();
  await env.DB.prepare(
    "INSERT INTO classes (id, class_name, date, created_at) VALUES (?, ?, ?, ?)"
  ).bind(id, class_name, date, Date.now()).run();
  return Response.json({ success: true });
}
