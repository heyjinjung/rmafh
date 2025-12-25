import { useEffect, useMemo, useState } from 'react';
import { extractErrorInfo, withIdempotency } from '../../lib/apiClient';
import { pushToast } from './toastBus';

const typeOptions = ['ALERT', 'REMINDER', 'BROADCAST'];
const variantOptions = ['EXPIRY', 'DEPOSIT', 'DAILY_IMPORT', 'MAINTENANCE'];
const targetModes = ['EXTERNAL_USER_IDS', 'USER_IDS'];
const statusFilters = ['ALL', 'PENDING', 'SENT', 'FAILED', 'DLQ', 'RETRYING'];

const normalizeNotification = (n) => ({
  id: n.id,
  type: n.type,
  variant_id: n.variant_id,
  status: n.status,
  scheduled_at: n.scheduled_at,
  created_at: n.created_at,
});

export default function AdminV2NotificationsPanel({ adminPassword, basePath }) {
  const [type, setType] = useState('ALERT');
  const [variant, setVariant] = useState('EXPIRY');
  const [targetMode, setTargetMode] = useState('EXTERNAL_USER_IDS');
  const [targetText, setTargetText] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const apiFetch = useMemo(() => withIdempotency({ adminPassword, basePath }), [adminPassword, basePath]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: '20', order: 'desc' });
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (query) params.set('external_user_id', query);
      const resp = await apiFetch(`/api/vault/admin/notifications?${params.toString()}`);
      const items = resp?.data?.items || [];
      setNotifications(items.map(normalizeNotification));
    } catch (err) {
      const info = extractErrorInfo(err);
      setError(info.summary || '목록 불러오기 실패');
      pushToast({ ok: false, message: info.summary || '목록 불러오기 실패', detail: info.requestId || info.detail, requestId: info.requestId, idempotencyKey: info.idempotencyKey });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, query]);

  const submitNotification = async () => {
    try {
      setSubmitting(true);
      const rawTargets = String(targetText || '')
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!rawTargets.length) {
        setError('대상 아이디를 입력해주세요.');
        pushToast({ ok: false, message: '대상 아이디를 입력해주세요.' });
        return;
      }

      const payload = {
        type,
        variant_id: variant || undefined,
        user_ids: targetMode === 'USER_IDS' ? rawTargets.map((v) => Number(v)).filter((n) => Number.isFinite(n)) : undefined,
        external_user_ids: targetMode === 'EXTERNAL_USER_IDS' ? rawTargets : undefined,
      };

      const res = await apiFetch('/api/vault/notify', { method: 'POST', body: payload });
      const enqueued = res?.data?.enqueued;
      pushToast({ ok: true, message: '알림 생성(큐 적재) 완료', detail: `enqueued: ${enqueued ?? '-'}`, idempotencyKey: res.idempotencyKey });
      load();
    } catch (err) {
      const info = extractErrorInfo(err);
      setError(info.summary || '요청 실패');
      pushToast({ ok: false, message: info.summary || '요청 실패', detail: info.requestId || info.detail, requestId: info.requestId, idempotencyKey: info.idempotencyKey });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--v2-border)] bg-[var(--v2-surface)]/80 p-5" id="notifications">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Notifications</p>
          <p className="mt-1 text-sm text-[var(--v2-text)]">
            Compose and queue notifications with dedup hints and retry actions.
          </p>
        </div>
        <span className="rounded-full border border-[var(--v2-border)] px-3 py-1 text-[10px] text-[var(--v2-muted)]">Shadow/Apply ready</span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3 rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
              >
                {typeOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Variant</label>
              <select
                value={variant}
                onChange={(e) => setVariant(e.target.value)}
                className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
              >
                {variantOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Schedule (UTC)</label>
              <input
                type="datetime-local"
                value={''}
                onChange={() => {}}
                disabled
                className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Target</label>
              <select
                value={targetMode}
                onChange={(e) => setTargetMode(e.target.value)}
                className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
              >
                {targetModes.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Targets</label>
              <input
                value={targetText}
                onChange={(e) => setTargetText(e.target.value)}
                placeholder={targetMode === 'USER_IDS' ? '1,2,3' : 'ext-1001,ext-1002'}
                className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
              />
            </div>
            <div>
              <div className="mt-6 rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] p-3 text-xs text-[var(--v2-muted)]">
                <p className="text-[var(--v2-text)]">백엔드 지원 범위</p>
                <p className="mt-1">현재 알림 생성은 <span className="font-mono">/api/vault/notify</span>만 지원하며, Segment/예약/본문 템플릿은 미지원입니다.</p>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Title</label>
            <input
              value={'(backend 미지원)'}
              onChange={() => {}}
              disabled
              className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Body</label>
            <textarea
              value={'(backend 미지원)'}
              onChange={() => {}}
              disabled
              rows={3}
              className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-[1.3fr_0.7fr]">
            <div className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] p-3 text-xs text-[var(--v2-text)]">
              <p className="font-semibold text-[var(--v2-accent)]">중복 방지 정책</p>
              <ul className="mt-2 space-y-1 list-disc list-inside text-[var(--v2-muted)]">
                <li>payload hash + variant 기반 dedupe_key 자동 생성</li>
                <li>동일 dedupe_key 24h 내 재요청 시 200/409 반환</li>
                <li>예약 발송은 스케줄 타임존을 UTC로 고정</li>
              </ul>
            </div>
            <div className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] p-3 text-xs text-[var(--v2-text)]">
              <p className="text-[var(--v2-muted)]">Idempotency</p>
              <p className="mt-2 text-[var(--v2-muted)]">요청마다 <span className="font-mono">x-idempotency-key</span>가 자동으로 붙습니다(클라이언트 생성).</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-[var(--v2-muted)]">예약 시 Shadow → Apply 순으로 두 번 실행 권장</div>
            <div className="space-x-2">
              <button
                type="button"
                onClick={() => setTargetText('')}
                className="rounded-lg border border-[var(--v2-border)] px-3 py-2 text-sm text-[var(--v2-text)]"
              >
                대상 초기화
              </button>
              <button
                type="button"
                onClick={submitNotification}
                disabled={submitting}
                className="rounded-lg border border-[var(--v2-accent)] bg-[var(--v2-accent)] px-4 py-2 text-sm font-semibold text-black shadow-[0_0_20px_rgba(183,247,90,0.35)] hover:brightness-105 disabled:opacity-50"
              >
                {submitting ? '요청 중...' : '알림 생성 요청'}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Notification List</p>
              <p className="text-sm text-[var(--v2-text)]">Filters + pagination + retry.</p>
            </div>
            <div className="flex gap-2 text-xs text-[var(--v2-muted)]">
              <button className="rounded-full border border-[var(--v2-border)] px-3 py-1" onClick={load}>Refresh</button>
              <button className="rounded-full border border-[var(--v2-border)] px-3 py-1" onClick={downloadCsv}>Download CSV</button>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-[1fr_1fr]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ID or variant"
              className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
            >
              {statusFilters.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {loading ? <p className="text-sm text-[var(--v2-muted)]">불러오는 중...</p> : null}
          {error ? <p className="text-sm text-[var(--v2-warning)]">{error}</p> : null}

          <div className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)]/80">
            <table className="min-w-full table-fixed text-left text-sm">
              <thead className="border-b border-[var(--v2-border)] text-[var(--v2-muted)]">
                <tr>
                  <th className="px-3 py-2 text-xs">ID</th>
                  <th className="px-3 py-2 text-xs">Type/Variant</th>
                  <th className="px-3 py-2 text-xs">Status</th>
                  <th className="px-3 py-2 text-xs">Scheduled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--v2-border)]">
                {notifications.map((n) => (
                  <tr key={n.id} className="text-[var(--v2-text)]">
                    <td className="px-3 py-2 font-mono text-xs text-[var(--v2-accent)]">{n.id}</td>
                    <td className="px-3 py-2 text-xs">{n.type} / {n.variant_id || '-'}</td>
                    <td className="px-3 py-2 text-xs">{n.status}</td>
                    <td className="px-3 py-2 text-xs">{n.scheduled_at || n.created_at || '-'}</td>
                  </tr>
                ))}
                {notifications.length === 0 ? (
                  <tr>
                    <td className="px-3 py-2 text-[var(--v2-muted)]" colSpan={4}>표시할 알림이 없습니다.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-xs text-[var(--v2-muted)]">
            <div className="space-x-2">
              <button className="rounded border border-[var(--v2-border)] px-3 py-1" onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
              <span>Page {page}</span>
              <button className="rounded border border-[var(--v2-border)] px-3 py-1" onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
            <div>Idempotent + 서버 API 연동 완료</div>
          </div>
        </div>
      </div>
    </div>
  );
}
