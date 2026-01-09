function getBaseUrl() {
    return process.env.NEXT_PUBLIC_API_BASE || process.env.API_BASE || 'http://localhost:18000';
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Method Not Allowed' } });
    }

    const { userId } = req.query || {};
    if (!userId) {
        return res.status(400).json({ error: { code: 'USER_ID_REQUIRED', message: 'user_id is required' } });
    }

    try {
        const base = getBaseUrl();
        const headers = {
            'content-type': 'application/json',
            accept: 'application/json',
        };

        if (req.headers['x-admin-password']) {
            headers['x-admin-password'] = req.headers['x-admin-password'];
        }
        // Idempotency key forwarding
        if (req.headers['x-idempotency-key']) {
            headers['x-idempotency-key'] = req.headers['x-idempotency-key'];
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const upstream = await fetch(`${base}/api/vault/admin/users/${encodeURIComponent(userId)}/vault/diamond-missions`, {
            method: 'POST',
            headers,
            body: JSON.stringify(req.body || {}),
            signal: controller.signal,
        });

        clearTimeout(timeout);

        const contentType = upstream.headers.get('content-type') || '';
        const body = contentType.includes('application/json') ? await upstream.json() : await upstream.text();

        // Forward Idempotency-Status header if present
        if (upstream.headers.has('Idempotency-Status')) {
            res.setHeader('Idempotency-Status', upstream.headers.get('Idempotency-Status'));
        }

        res.status(upstream.status);
        if (typeof body === 'string') return res.send(body);
        return res.json(body);
    } catch (e) {
        return res.status(502).json({ error: { code: 'UPSTREAM_ERROR', message: e?.message || 'Upstream request failed' } });
    }
}
