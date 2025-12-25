function generateIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function parseErrorPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return {};
  }
  const { code, summary, detail, request_id: requestId } = payload;
  return {
    code,
    summary: summary || payload.message,
    detail,
    requestId,
  };
}

/**
 * Simple fetch wrapper that injects admin password + idempotency key headers.
 * Intended for client-side usage; call from within components/hooks.
 */
export function withIdempotency({ adminPassword, basePath = '' } = {}) {
  return async function fetchWithIdempotency(path, { method = 'GET', headers = {}, body, idempotencyKey } = {}) {
    const key = idempotencyKey || generateIdempotencyKey();
    const finalHeaders = { ...headers, 'x-idempotency-key': key };
    if (adminPassword) {
      finalHeaders['x-admin-password'] = adminPassword;
    }

    const hasJsonBody = body && typeof body === 'object' && !(body instanceof FormData);
    const init = {
      method,
      headers: {
        ...(hasJsonBody ? { 'content-type': 'application/json' } : {}),
        ...finalHeaders,
      },
      body: hasJsonBody ? JSON.stringify(body) : body,
    };

    const res = await fetch(`${basePath}${path}`, init);
    const contentType = res.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await res.json() : await res.text();
    const idemStatus = res.headers.get('Idempotency-Status');

    if (!res.ok) {
      const err = new Error('Request failed');
      err.status = res.status;
      err.statusText = res.statusText;
      try {
        err.headers = Object.fromEntries(res.headers.entries());
      } catch (e) {
        err.headers = {};
      }
      err.idempotencyKey = key;
      err.idempotencyStatus = idemStatus;
      err.payload = payload;
      err.parsed = parseErrorPayload(payload);
      throw err;
    }

    return { data: payload, idempotencyKey: key, idempotencyStatus: idemStatus };
  };
}

export function extractErrorInfo(err) {
  if (!err) return {};
  const base = err.parsed || parseErrorPayload(err.payload);
  return {
    code: base.code,
    summary: base.summary || err.message,
    detail: base.detail,
    requestId: base.requestId,
    idempotencyKey: err.idempotencyKey,
    idempotencyStatus: err.idempotencyStatus,
    status: err.status,
  };
}
