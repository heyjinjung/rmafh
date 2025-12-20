import { useMemo, useState } from 'react';

const DEFAULT_USER_ID = '';

function jsonPretty(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function AdminPage() {
  const [userId, setUserId] = useState(DEFAULT_USER_ID);
  const [busyKey, setBusyKey] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const qs = useMemo(() => {
    const params = new URLSearchParams();
    if (userId) params.set('user_id', userId);
    const s = params.toString();
    return s ? `?${s}` : '';
  }, [userId]);

  async function callApi(key, path, init) {
    setBusyKey(key);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${path}${qs}`, init);
      const ct = res.headers.get('content-type') || '';
      const body = ct.includes('application/json') ? await res.json() : await res.text();
      if (!res.ok) {
        setError({ status: res.status, body });
        return;
      }
      setResult(body);
    } catch (e) {
      setError({ status: 0, body: { message: e?.message || 'Request failed' } });
    } finally {
      setBusyKey('');
    }
  }

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Noto Sans KR, sans-serif' }}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Vault Admin</h1>
      <p style={{ marginTop: 0, marginBottom: 16, color: '#444' }}>
        주의: 이 페이지는 운영용(개발/스테이징) 최소 도구입니다. 기본 호출은 Next 프록시(`/api/vault/*`)를 통해 백엔드로 전달됩니다.
      </p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ fontWeight: 600 }}>user_id</label>
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="예: 123"
          style={{ padding: '8px 10px', border: '1px solid #ccc', borderRadius: 8, minWidth: 220 }}
        />
        <span style={{ color: '#666' }}>쿼리스트링으로 `user_id`가 전달됩니다.</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginBottom: 18 }}>
        <button
          onClick={() => callApi('status', '/api/vault/status/', { method: 'GET' })}
          disabled={!!busyKey}
          style={{ padding: 12, borderRadius: 10, border: '1px solid #ddd', background: '#fff', textAlign: 'left' }}
        >
          <strong>Status 조회</strong>
          <div style={{ fontSize: 12, color: '#666' }}>GET /api/vault/status/</div>
        </button>

        <button
          onClick={() =>
            callApi('extend-shadow', '/api/vault/extend-expiry/', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ dry_run: true }),
            })
          }
          disabled={!!busyKey}
          style={{ padding: 12, borderRadius: 10, border: '1px solid #ddd', background: '#fff', textAlign: 'left' }}
        >
          <strong>만료 연장 (shadow)</strong>
          <div style={{ fontSize: 12, color: '#666' }}>POST /api/vault/extend-expiry/ (body: dry_run=true)</div>
        </button>

        <button
          onClick={() =>
            callApi('extend-real', '/api/vault/extend-expiry/', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ dry_run: false }),
            })
          }
          disabled={!!busyKey}
          style={{ padding: 12, borderRadius: 10, border: '1px solid #ddd', background: '#fff', textAlign: 'left' }}
        >
          <strong>만료 연장 (real)</strong>
          <div style={{ fontSize: 12, color: '#666' }}>POST /api/vault/extend-expiry/ (body: dry_run=false)</div>
        </button>

        <button
          onClick={() =>
            callApi('notify', '/api/vault/notify/', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({}),
            })
          }
          disabled={!!busyKey}
          style={{ padding: 12, borderRadius: 10, border: '1px solid #ddd', background: '#fff', textAlign: 'left' }}
        >
          <strong>알림 enqueue</strong>
          <div style={{ fontSize: 12, color: '#666' }}>POST /api/vault/notify/</div>
        </button>

        <button
          onClick={() =>
            callApi('referral-revive', '/api/vault/referral-revive/', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({}),
            })
          }
          disabled={!!busyKey}
          style={{ padding: 12, borderRadius: 10, border: '1px solid #ddd', background: '#fff', textAlign: 'left' }}
        >
          <strong>추천 revive</strong>
          <div style={{ fontSize: 12, color: '#666' }}>POST /api/vault/referral-revive/</div>
        </button>
      </div>

      {busyKey ? (
        <div style={{ marginBottom: 12, color: '#666' }}>요청 중: {busyKey}</div>
      ) : null}

      {error ? (
        <div style={{ border: '1px solid #f2b8b5', background: '#fff5f5', padding: 12, borderRadius: 10, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Error</div>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{jsonPretty(error)}</pre>
        </div>
      ) : null}

      {result ? (
        <div style={{ border: '1px solid #c7e3c6', background: '#f6fff5', padding: 12, borderRadius: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Result</div>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{jsonPretty(result)}</pre>
        </div>
      ) : (
        <div style={{ color: '#666' }}>Result가 여기에 표시됩니다.</div>
      )}
    </div>
  );
}
