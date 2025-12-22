export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ detail: 'Method not allowed' });
  }

  try {
    const apiRes = await fetch('http://api:8000/api/vault/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    const data = await apiRes.json();

    if (!apiRes.ok) {
      return res.status(apiRes.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Login proxy error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
}
