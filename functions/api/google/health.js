import { requireAuth } from '../_auth.js';

async function getValidToken(context, userId) {
  const row = await context.env.DB.prepare(
    'SELECT * FROM google_tokens WHERE user_id = ?'
  ).bind(userId).first();

  if (!row) return null;

  if (row.expires_at > Date.now() + 60000) {
    return row.access_token;
  }

  if (!row.refresh_token) return null;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: context.env.GOOGLE_CLIENT_ID,
      client_secret: context.env.GOOGLE_CLIENT_SECRET,
      refresh_token: row.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const data = await res.json();
  if (!data.access_token) return null;

  const expiresAt = Date.now() + (data.expires_in * 1000);
  await context.env.DB.prepare(
    'UPDATE google_tokens SET access_token = ?, expires_at = ? WHERE user_id = ?'
  ).bind(data.access_token, expiresAt, userId).run();

  return data.access_token;
}

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  const token = await getValidToken(context, auth.user_id);
  if (!token) {
    return Response.json({ connected: false });
  }

  const url = new URL(context.request.url);
  const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
  const debug = url.searchParams.get('debug') === '1';

  const [year, month, day] = date.split('-').map(Number);
  const dateObj = { year, month, day };

  const [steps, calories] = await Promise.all([
    fetchHealthData(token, 'steps', dateObj),
    fetchHealthData(token, 'caloriesBurned', dateObj),
  ]);

  if (debug) {
    return Response.json({ connected: true, date, dateObj, steps, calories });
  }

  return Response.json({
    connected: true,
    date,
    steps: { value: steps.value },
    calories_burned: { value: calories.value },
  });
}

async function fetchHealthData(token, dataType, dateObj) {
  try {
    const res = await fetch(
      `https://health.googleapis.com/v4/users/me/dataTypes/${dataType}/dataPoints:dailyRollUp`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: dateObj,
          endDate: dateObj,
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return { value: 0, error: err };
    }

    const data = await res.json();
    const points = data.dataPoints || [];
    if (points.length === 0) return { value: 0, raw: data };

    // Extract value from first data point
    const point = points[0];
    const values = point.values || point.value || [];
    if (Array.isArray(values) && values.length > 0) {
      const v = values[0];
      return { value: Math.round(v.intVal || v.floatVal || v.integer || v.float || 0) };
    }
    // Try direct fields
    return { value: Math.round(point.intVal || point.floatVal || 0), raw: point };
  } catch (e) {
    return { value: 0, error: e.message };
  }
}
