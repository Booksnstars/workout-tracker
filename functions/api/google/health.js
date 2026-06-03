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
  const startDate = { year, month, day };
  // End date is exclusive, so next day
  const nextDay = new Date(year, month - 1, day + 1);
  const endDate = { year: nextDay.getFullYear(), month: nextDay.getMonth() + 1, day: nextDay.getDate() };

  const [steps, calories] = await Promise.all([
    fetchHealthData(token, 'steps', startDate, endDate),
    fetchHealthData(token, 'total-calories', startDate, endDate),
  ]);

  if (debug) {
    return Response.json({ connected: true, date, startDate, endDate, steps, calories });
  }

  return Response.json({
    connected: true,
    date,
    steps: { value: steps.value },
    calories_burned: { value: calories.value },
  });
}

async function fetchHealthData(token, dataType, startDate, endDate) {
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
          range: {
            start: { date: startDate },
            end: { date: endDate },
          },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return { value: 0, error: err };
    }

    const data = await res.json();
    const points = data.rollupDataPoints || data.dataPoints || [];
    if (points.length === 0) return { value: 0 };

    // Extract value from the first rollup point
    const point = points[0];
    // The response nests values like: steps.countSum, totalCalories.kcalSum, etc.
    let total = 0;
    for (const [key, val] of Object.entries(point)) {
      if (key === 'civilStartTime' || key === 'civilEndTime') continue;
      if (typeof val === 'object' && val !== null) {
        for (const v of Object.values(val)) {
          const num = parseFloat(v);
          if (!isNaN(num)) total += num;
        }
      }
    }
    return { value: Math.round(total) };
  } catch (e) {
    return { value: 0, error: e.message };
  }
}
