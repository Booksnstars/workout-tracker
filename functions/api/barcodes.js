import { requireAuth } from './_auth.js';

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const barcode = new URL(context.request.url).searchParams.get('code');
  if (!barcode) return Response.json(null);
  const row = await context.env.DB.prepare(
    'SELECT * FROM barcodes WHERE barcode = ? AND user_id = ?'
  ).bind(barcode, auth.user_id).first();
  return Response.json(row || null);
}

export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;
  const { barcode, name, serving_g, kcal, protein, carbs, fat } = await context.request.json();
  if (!barcode || !name) return new Response('Missing fields', { status: 400 });
  await context.env.DB.prepare(
    'INSERT OR REPLACE INTO barcodes (barcode, user_id, name, serving_g, kcal, protein, carbs, fat, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(barcode, auth.user_id, name, serving_g || 100, kcal || 0, protein || 0, carbs || 0, fat || 0, Date.now()).run();
  return Response.json({ ok: true });
}
