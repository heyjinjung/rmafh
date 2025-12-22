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
  // CORS 프리플라이트 OPTIONS 요청 처리
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', ['POST', 'OPTIONS']);
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'OPTIONS']);
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Method Not Allowed' } });
  }

  try {
    const base = getBaseUrl();
    const headers = {
      'content-type': 'application/json',
      accept: 'application/json',
    };
    
    // 어드민 인증 헤더 전달
    if (req.headers['x-admin-password']) {
      headers['x-admin-password'] = req.headers['x-admin-password'];
    }
    
    // 타임아웃 설정 (30초)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    
    const upstream = await fetch(`${base}/api/vault/compensation-enqueue${buildQuery(req)}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body || {}),
      signal: controller.signal,
    });
    
    clearTimeout(timeout);

    const contentType = upstream.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await upstream.json() : await upstream.text();

    res.status(upstream.status);
    if (typeof body === 'string') return res.send(body);
    return res.json(body);
  } catch (e) {
    if (e.name === 'AbortError') {
      return res.status(504).json({ error: { code: 'GATEWAY_TIMEOUT', message: 'Request timeout after 30 seconds' } });
    }
    return res.status(502).json({ error: { code: 'UPSTREAM_ERROR', message: e?.message || 'Upstream request failed' } });
  }
}
