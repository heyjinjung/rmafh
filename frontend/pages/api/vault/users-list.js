// GET 전체 회원 리스트 조회 프록시
export default async function handler(req, res) {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

  // 메서드 검증
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 백엔드 호출
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const backendUrl = `${API_BASE}/api/vault/admin/users`;
    const headers = {
      'Content-Type': 'application/json',
    };

    // x-admin-password 헤더 전달
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
