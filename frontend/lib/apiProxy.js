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

function pickForwardHeaders(req) {
  const headers = {
    accept: req.headers?.accept || 'application/json',
  };

  if (req.headers['x-admin-password']) headers['x-admin-password'] = req.headers['x-admin-password'];
  if (req.headers['x-idempotency-key']) headers['x-idempotency-key'] = req.headers['x-idempotency-key'];

  return headers;
}

export async function proxyToUpstream(req, res, { upstreamPath, allowedMethods, timeoutMs = 30000 } = {}) {
  const method = String(req.method || 'GET').toUpperCase();
  const allow = allowedMethods?.length ? allowedMethods : ['GET'];

  if (!allow.includes(method)) {
    res.setHeader('Allow', allow);
    return res.status(405).json({
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Method Not Allowed' },
    });
  }

  const base = getBaseUrl();
  const upstreamUrl = `${base}${upstreamPath}${buildQuery(req)}`;

  try {
    const headers = pickForwardHeaders(req);

    const hasBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const isJsonBody = hasBody && req.body && typeof req.body === 'object' && !(req.body instanceof Buffer);
    if (hasBody && isJsonBody) headers['content-type'] = req.headers['content-type'] || 'application/json';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const upstream = await fetch(upstreamUrl, {
      method,
      headers,
      body: hasBody ? (isJsonBody ? JSON.stringify(req.body || {}) : req.body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const contentType = upstream.headers.get('content-type') || '';
    const disposition = upstream.headers.get('content-disposition');
    const idemStatus = upstream.headers.get('Idempotency-Status') || upstream.headers.get('idempotency-status');

    if (disposition) res.setHeader('Content-Disposition', disposition);
    if (idemStatus) res.setHeader('Idempotency-Status', idemStatus);
    if (contentType) res.setHeader('Content-Type', contentType);

    res.status(upstream.status);

    if (contentType.includes('application/json')) {
      const data = await upstream.json();
      return res.json(data);
    }

    const ab = await upstream.arrayBuffer();
    return res.send(Buffer.from(ab));
  } catch (e) {
    if (e?.name === 'AbortError') {
      return res.status(504).json({
        error: {
          code: 'UPSTREAM_TIMEOUT',
          message: 'Request timeout',
          upstream: { base, path: upstreamPath, url: upstreamUrl, method },
        },
      });
    }
    return res.status(502).json({
      error: {
        code: 'UPSTREAM_ERROR',
        message: e?.message || 'Upstream request failed',
        upstream: { base, path: upstreamPath, url: upstreamUrl, method },
      },
    });
  }
}
