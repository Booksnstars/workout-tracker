import { requireAuth } from '../_auth.js';

async function getValidToken(context, userId) {
  const row = await context.env.DB.prepare(
    'SELECT * FROM google_tokens WHERE user_id = ?'
  ).bind(userId).first();

  if (!row) return null;

  // If token is still valid (with 60s buffer)
  if (row.expires_at > Date.now() + 60000) {
    return row.access_token;
  }

  // Refresh the token
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

  // Fetch daily calories burned and steps
  const [caloriesData, stepsData] = await Promise.all([
    fetchDailyData(token, 'caloriesBurned', date),
    fetchDailyData(token, 'steps', date),
  ]);

  return Response.json({
    connected: true,
    date,
    calories_burned: caloriesData,
    steps: stepsData,
  });
}

async function fetchDailyData(token, dataType, date) {
  const startDate = date;
  const endDate = date;

  try {
    const res = await fetch(
      `https://health.googleapis.com/v4/users/me/dataTypes/${dataType}/dataPoints:dailyRollUp`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: { year: parseInt(startDate.split('-')[0]), month: parseInt(startDate.split('-')[1]), day: parseInt(startDate.split('-')[2]) },
          endDate: { year: parseInt(endDate.split('-')[0]), month: parseInt(endDate.split('-')[1]), day: parseInt(endDate.split('-')[2]) },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return { error: err, value: 0 };
    }

    const data = await res.json();
    // Extract the rolled-up value
    const points = data.dataPoints || [];
    if (points.length === 0) return { value: 0 };

    const point = points[0];
    const val = point.intVal || point.floatVal || point.values?.[0]?.intVal || point.values?.[0]?.floatVal || 0;
    return { value: Math.round(typeof val === 'number' ? val : 0) };
  } catch (e) {
    return { value: 0, error: e.message };
  }
}
