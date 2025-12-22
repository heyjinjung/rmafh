function getBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE || process.env.API_BASE || 'http://localhost:18000';
}

function buildQuery(req) {
  const params = new URLSearchParams();
  const query = req?.query || {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, String(v));
    } else {
      params.set(key, String(value));
    }
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export default async function handler(req, res) {
  const base = getBaseUrl();
  const headers = { 'content-type': 'application/json', accept: 'application/json' };
  if (req.headers['x-admin-password']) headers['x-admin-password'] = req.headers['x-admin-password'];

  if (req.method === 'GET') {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const upstream = await fetch(`${base}/api/vault/admin/users${buildQuery(req)}`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await upstream.json();
      return res.status(upstream.status).json(data);
    } catch (e) {
      if (e.name === 'AbortError') return res.status(504).json({ error: 'Request timeout' });
      return res.status(502).json({ error: 'Upstream error', message: e?.message || 'fetch failed' });
    }
  }

  if (req.method === 'POST') {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const upstream = await fetch(`${base}/api/vault/admin/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify(req.body || {}),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const contentType = upstream.headers.get('content-type') || '';
      const body = contentType.includes('application/json') ? await upstream.json() : await upstream.text();
      res.status(upstream.status);
      return typeof body === 'string' ? res.send(body) : res.json(body);
    } catch (e) {
      if (e.name === 'AbortError') return res.status(504).json({ error: 'Request timeout' });
      return res.status(502).json({ error: 'Upstream error', message: e?.message || 'fetch failed' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method Not Allowed' });
}
