function getBaseUrl(req) {
  // Docker(서버 사이드): http://api:8000
  // 로컬(브라우저): 프록시를 통해서만 접근하므로 여기서는 서버에서 호출 가능해야 함
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
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Method Not Allowed' } });
  }

  try {
    const base = getBaseUrl(req);
    const upstream = await fetch(`${base}/api/vault/status${buildQuery(req)}`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    });

    const contentType = upstream.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await upstream.json() : await upstream.text();

    res.status(upstream.status);
    if (typeof body === 'string') {
      return res.send(body);
    }
    return res.json(body);
  } catch (e) {
    return res.status(502).json({
      error: { code: 'UPSTREAM_ERROR', message: e?.message || 'Upstream request failed' },
    });
  }
}
