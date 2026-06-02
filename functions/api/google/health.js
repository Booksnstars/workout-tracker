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

  // Calculate start/end of day in millis
  const startMs = new Date(date + 'T00:00:00').getTime();
  const endMs = new Date(date + 'T23:59:59.999').getTime();

  const [steps, calories] = await Promise.all([
    fetchFitData(token, 'com.google.step_count.delta', 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps', startMs, endMs),
    fetchFitData(token, 'com.google.calories.expended', 'derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended', startMs, endMs),
  ]);

  return Response.json({
    connected: true,
    date,
    steps: steps,
    calories_burned: calories,
  });
}

async function fetchFitData(token, dataTypeName, dataSourceId, startMs, endMs) {
  try {
    const res = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        aggregateBy: [{ dataTypeName, dataSourceId }],
        bucketByTime: { durationMillis: endMs - startMs + 1 },
        startTimeMillis: startMs,
        endTimeMillis: endMs,
      }),
    });

    if (!res.ok) {
      // Try without dataSourceId (some accounts have different sources)
      const res2 = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          aggregateBy: [{ dataTypeName }],
          bucketByTime: { durationMillis: endMs - startMs + 1 },
          startTimeMillis: startMs,
          endTimeMillis: endMs,
        }),
      });
      if (!res2.ok) return { value: 0 };
      const data2 = await res2.json();
      return extractValue(data2);
    }

    const data = await res.json();
    return extractValue(data);
  } catch (e) {
    return { value: 0 };
  }
}

function extractValue(data) {
  let total = 0;
  const buckets = data.bucket || [];
  for (const bucket of buckets) {
    for (const dataset of (bucket.dataset || [])) {
      for (const point of (dataset.point || [])) {
        for (const val of (point.value || [])) {
          total += val.intVal || val.fpVal || 0;
        }
      }
    }
  }
  return { value: Math.round(total) };
}
