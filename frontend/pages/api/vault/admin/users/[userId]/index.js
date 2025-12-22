function getBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE || process.env.API_BASE || 'http://localhost:18000';
}

export default async function handler(req, res) {
  const { userId } = req.query || {};
  if (!userId) return res.status(400).json({ error: { code: 'USER_ID_REQUIRED', message: 'user_id is required' } });

  const base = getBaseUrl();
  const headers = { 'content-type': 'application/json', accept: 'application/json' };
  if (req.headers['x-admin-password']) headers['x-admin-password'] = req.headers['x-admin-password'];

  const method = req.method?.toUpperCase();
  if (!['PATCH', 'DELETE'].includes(method)) {
    res.setHeader('Allow', ['PATCH', 'DELETE']);
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Method Not Allowed' } });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const upstream = await fetch(`${base}/api/vault/admin/users/${encodeURIComponent(userId)}`, {
      method,
      headers,
      body: method === 'DELETE' ? undefined : JSON.stringify(req.body || {}),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const contentType = upstream.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await upstream.json() : await upstream.text();
    res.status(upstream.status);
    return typeof body === 'string' ? res.send(body) : res.json(body);
  } catch (e) {
    if (e.name === 'AbortError') return res.status(504).json({ error: 'Request timeout' });
    return res.status(502).json({ error: { code: 'UPSTREAM_ERROR', message: e?.message || 'Upstream request failed' } });
  }
}
