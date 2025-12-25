import { useEffect, useMemo, useState } from 'react';
import { extractErrorInfo, withIdempotency } from '../../lib/apiClient';
import { pushToast } from './toastBus';

const typeOptions = ['ALERT', 'REMINDER', 'BROADCAST'];
const variantOptions = ['EXPIRY', 'DEPOSIT', 'DAILY_IMPORT', 'MAINTENANCE'];
const targetModes = ['SEGMENT', 'UPLOADED_IDS', 'FILTER_SCOPE'];
const statusFilters = ['ALL', 'PENDING', 'SENT', 'FAILED'];

const normalizeNotification = (n) => ({
  id: n.id || n.notification_id,
  type: n.type,
  variant: n.variant || n.template,
  status: n.status,
  scheduled: n.scheduled_at || n.scheduled || n.created_at,
  request_id: n.request_id || n.idempotency_key,
});

export default function AdminV2NotificationsPanel({ adminPassword, basePath }) {
  const [type, setType] = useState('ALERT');
  const [variant, setVariant] = useState('EXPIRY');
  const [targetMode, setTargetMode] = useState('SEGMENT');
  const [segmentId, setSegmentId] = useState('');
  const [uploadedIds, setUploadedIds] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [title, setTitle] = useState('만료 임박 안내');
  const [body, setBody] = useState('만료 3일 전입니다. Shadow 체크 후 Apply 해주세요.');
  const [dedupeKey, setDedupeKey] = useState('auto-generate');
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
      const params = new URLSearchParams({ limit: '20', offset: String((page - 1) * 20) });
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (query) params.set('q', query);
      const resp = await apiFetch(`/api/vault/admin/notifications?${params.toString()}`);
      const items = resp?.data?.items || resp?.data?.notifications || resp?.data || [];
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
    const payload = {
      type,
      variant,
      target_mode: targetMode,
      segment_id: segmentId || undefined,
      uploaded_ids: uploadedIds ? uploadedIds.split(/[,\s]+/).filter(Boolean) : undefined,
      schedule_at: scheduleAt || null,
      title,
      body,
      dedupe_key: dedupeKey === 'auto-generate' ? undefined : dedupeKey,
    };
    try {
      setSubmitting(true);
      const res = await apiFetch('/api/vault/admin/notifications', {
        method: 'POST',
        body: payload,
      });
      pushToast({ ok: true, message: '알림 생성 요청 완료', detail: res.idempotencyKey });
      load();
    } catch (err) {
      const info = extractErrorInfo(err);
      setError(info.summary || '요청 실패');
      pushToast({ ok: false, message: info.summary || '요청 실패', detail: info.requestId || info.detail, requestId: info.requestId, idempotencyKey: info.idempotencyKey });
    } finally {
      setSubmitting(false);
    }
  };

  const actOnNotification = async (id, action) => {
    try {
      const res = await apiFetch(`/api/vault/admin/notifications/${id}/${action}`, { method: 'POST' });
      pushToast({ ok: true, message: `${action} 요청 완료`, detail: res.idempotencyKey });
      load();
    } catch (err) {
      const info = extractErrorInfo(err);
      setError(info.summary || `${action} 실패`);
      pushToast({ ok: false, message: info.summary || `${action} 실패`, detail: info.requestId || info.detail, requestId: info.requestId, idempotencyKey: info.idempotencyKey });
    }
  };

  const downloadCsv = () => {
    const params = new URLSearchParams();
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    if (query) params.set('q', query);
    const url = `${basePath || ''}/api/vault/admin/notifications/export?${params.toString()}`;
    if (typeof window !== 'undefined') window.open(url, '_blank');
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
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
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
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Segment</label>
              <input
                value={segmentId}
                onChange={(e) => setSegmentId(e.target.value)}
                placeholder="segment_id or saved filter"
                className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Upload IDs</label>
              <input
                value={uploadedIds}
                onChange={(e) => setUploadedIds(e.target.value)}
                placeholder="user1,user2,user3"
                className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
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
              <label className="text-[var(--v2-muted)]">Dedupe Key</label>
              <input
                value={dedupeKey}
                onChange={(e) => setDedupeKey(e.target.value)}
                className="mt-2 w-full rounded border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-2 py-1 text-sm"
              />
              <p className="mt-2 text-[var(--v2-muted)]">비워두면 서버에서 자동 생성합니다.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-[var(--v2-muted)]">예약 시 Shadow → Apply 순으로 두 번 실행 권장</div>
            <div className="space-x-2">
              <button
                type="button"
                onClick={() => setDedupeKey('auto-generate')}
                className="rounded-lg border border-[var(--v2-border)] px-3 py-2 text-sm text-[var(--v2-text)]"
              >
                Dedupe Key 재설정
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
                  <th className="px-3 py-2 text-xs">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--v2-border)]">
                {notifications.map((n) => (
                  <tr key={n.id} className="text-[var(--v2-text)]">
                    <td className="px-3 py-2 font-mono text-xs text-[var(--v2-accent)]">{n.id}</td>
                    <td className="px-3 py-2 text-xs">{n.type} / {n.variant}</td>
                    <td className="px-3 py-2 text-xs">{n.status}</td>
                    <td className="px-3 py-2 text-xs">{n.scheduled}</td>
                    <td className="px-3 py-2 text-xs">
                      <div className="flex gap-2">
                        <button className="rounded border border-[var(--v2-border)] px-2 py-1" onClick={() => actOnNotification(n.id, 'retry')}>Retry</button>
                        <button className="rounded border border-[var(--v2-border)] px-2 py-1" onClick={() => actOnNotification(n.id, 'cancel')}>Cancel</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {notifications.length === 0 ? (
                  <tr>
                    <td className="px-3 py-2 text-[var(--v2-muted)]" colSpan={5}>표시할 알림이 없습니다.</td>
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
