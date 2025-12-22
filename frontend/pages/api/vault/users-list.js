// GET 전체 회원 리스트 조회 프록시 (검색 지원)
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
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const backendUrl = `${getBaseUrl()}/api/vault/admin/users${buildQuery(req)}`;
    const headers = { 'Content-Type': 'application/json' };

    if (req.headers['x-admin-password']) {
      headers['x-admin-password'] = req.headers['x-admin-password'];
    }

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timeout' });
    }
    console.error('users-list proxy error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
