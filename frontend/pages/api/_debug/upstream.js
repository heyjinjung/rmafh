function getBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE || process.env.API_BASE || 'http://localhost:18000';
}

async function fetchWithTimeout(url, { timeoutMs = 5000, init } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...(init || {}), signal: controller.signal });
    const contentType = res.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await res.json() : await res.text();
    return { ok: res.ok, status: res.status, contentType, body };
  } finally {
    clearTimeout(timeoutId);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Method Not Allowed' } });
  }

  const base = getBaseUrl();
  const healthUrl = `${base}/health`;

  try {
    const health = await fetchWithTimeout(healthUrl, { timeoutMs: 5000 });
    return res.status(200).json({
      time: new Date().toISOString(),
      base,
      healthUrl,
      health,
    });
  } catch (e) {
    const isTimeout = e?.name === 'AbortError';
    return res.status(200).json({
      time: new Date().toISOString(),
      base,
      healthUrl,
      health: null,
      error: {
        code: isTimeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_ERROR',
        message: e?.message || 'fetch failed',
      },
    });
  }
}
