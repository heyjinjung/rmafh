import { useEffect, useMemo, useState } from 'react';
import { extractErrorInfo, withIdempotency } from '../../lib/apiClient';
import { pushToast } from './toastBus';

const typeOptions = ['ALERT', 'REMINDER', 'BROADCAST'];
const variantOptions = ['EXPIRY', 'DEPOSIT', 'DAILY_IMPORT', 'MAINTENANCE'];
const targetModes = ['EXTERNAL_USER_IDS', 'USER_IDS'];
const statusFilters = ['ALL', 'PENDING', 'SENT', 'FAILED', 'DLQ', 'RETRYING', 'CANCELED'];

const typeLabel = (t) => {
  switch (t) {
    case 'ALERT':
      return '경고';
    case 'REMINDER':
      return '리마인더';
    case 'BROADCAST':
      return '공지';
    default:
      return String(t || '');
  }
};

const variantLabel = (v) => {
  switch (v) {
    case 'EXPIRY':
      return '만료';
    case 'DEPOSIT':
      return '입금';
    case 'DAILY_IMPORT':
      return '일일 가져오기';
    case 'MAINTENANCE':
      return '점검';
    default:
      return String(v || '');
  }
};

const targetModeLabel = (m) => {
  switch (m) {
    case 'EXTERNAL_USER_IDS':
      return '외부 사용자 ID';
    case 'USER_IDS':
      return 'user_id';
    default:
      return String(m || '');
  }
};

const statusLabel = (s) => {
  switch (s) {
    case 'ALL':
      return '전체';
    case 'PENDING':
      return '대기';
    case 'SENT':
      return '발송됨';
    case 'FAILED':
      return '실패';
    case 'DLQ':
      return 'DLQ';
    case 'RETRYING':
      return '재시도 중';
    case 'CANCELED':
      return '취소됨';
    default:
      return String(s || '');
  }
};

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
  const [scheduledAtLocal, setScheduledAtLocal] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const apiFetch = useMemo(() => withIdempotency({ adminPassword, basePath }), [adminPassword, basePath]);

      const escape = (v) => {
        const s = String(v ?? '');
        if (/[\n\r,"]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
        return s;
      };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: '1', page_size: '10', order: 'desc' });
      const resp = await apiFetch(`/api/vault/admin/notifications?${params.toString()}`);
      const items = resp?.data?.items || [];
      setNotifications(items.map(normalizeNotification));
    } catch (err) {
      setError('알림 목록 불러오기 실패');
    } finally {
      setLoading(false);
    }
  };
    }
  };

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
      setError(null);
      const rawTargets = String(targetText || '')
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!rawTargets.length) {
        setError('대상 아이디를 입력해주세요.');
        pushToast({ ok: false, message: '대상 아이디를 입력해주세요.' });
        return;
      }

      let scheduledAtIso;
      if (String(scheduledAtLocal || '').trim()) {
        const d = new Date(scheduledAtLocal);
        if (!Number.isFinite(d.getTime())) {
          setError('scheduled_at 형식이 올바르지 않습니다.');
          pushToast({ ok: false, message: 'scheduled_at 형식이 올바르지 않습니다.' });
          return;
        }
        scheduledAtIso = d.toISOString();
      }

      const payload = {
        type,
        variant_id: variant || undefined,
        scheduled_at: scheduledAtIso,
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

  const retryNotification = async (notificationId) => {
    try {
      setError(null);
      await apiFetch(`/api/vault/admin/notifications/${notificationId}/retry`, { method: 'POST' });
      pushToast({ ok: true, message: '재시도 요청 완료', detail: String(notificationId) });
      load();
    } catch (err) {
      const info = extractErrorInfo(err);
      setError(info.summary || '재시도 실패');
      pushToast({ ok: false, message: info.summary || '재시도 실패', detail: info.requestId || info.detail, requestId: info.requestId, idempotencyKey: info.idempotencyKey });
    }
  };

  const cancelNotification = async (notificationId) => {
    try {
      setError(null);
      await apiFetch(`/api/vault/admin/notifications/${notificationId}/cancel`, { method: 'POST' });
      pushToast({ ok: true, message: '취소 완료', detail: String(notificationId) });
      load();
    } catch (err) {
      const info = extractErrorInfo(err);
      setError(info.summary || '취소 실패');
      pushToast({ ok: false, message: info.summary || '취소 실패', detail: info.requestId || info.detail, requestId: info.requestId, idempotencyKey: info.idempotencyKey });
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--v2-border)] bg-[var(--v2-surface)]/80 p-5" id="notifications">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">알림</p>
          <p className="mt-1 text-sm text-[var(--v2-text)]">
            중복 방지 힌트와 재시도/취소 기능으로 알림을 생성하고 큐에 적재합니다.
          </p>
        </div>
        <span className="rounded-full border border-[var(--v2-border)] px-3 py-1 text-[10px] text-[var(--v2-muted)]">Shadow/Apply 준비됨</span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3 rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">유형</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
              >
                {typeOptions.map((opt) => (
                  <option key={opt} value={opt}>{typeLabel(opt)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">분류</label>
              <select
                value={variant}
                onChange={(e) => setVariant(e.target.value)}
                className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
              >
                {variantOptions.map((opt) => (
                  <option key={opt} value={opt}>{variantLabel(opt)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">예약 시간</label>
              <input
                type="datetime-local"
                value={scheduledAtLocal}
                onChange={(e) => setScheduledAtLocal(e.target.value)}
                className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">타겟 종류</label>
              <select
                value={targetMode}
                onChange={(e) => setTargetMode(e.target.value)}
                className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
              >
                {targetModes.map((opt) => (
                  <option key={opt} value={opt}>{targetModeLabel(opt)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">타겟 목록</label>
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
                <p className="mt-1">현재 알림 생성은 <span className="font-mono">/api/vault/notify</span>(예약 <span className="font-mono">scheduled_at</span> 포함)만 지원하며, Segment/본문 템플릿은 미지원입니다.</p>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">제목</label>
            <input
              value={'(backend 미지원)'}
              onChange={() => {}}
              disabled
              className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">본문</label>
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
                <li>페이로드 해시 + variant 기반으로 dedupe_key 자동 생성</li>
                <li>동일 dedupe_key 기준, 24h 내 재요청 시 200/409 반환</li>
                <li>예약 발송은 스케줄 타임존을 UTC로 고정</li>
              </ul>
            </div>
            <div className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] p-3 text-xs text-[var(--v2-text)]">
              <p className="text-[var(--v2-muted)]">멱등성</p>
              <p className="mt-2 text-[var(--v2-muted)]">요청마다 <span className="font-mono">x-idempotency-key</span>가 자동으로 붙습니다(클라이언트 생성).</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-[var(--v2-muted)]">예약 시 Shadow(미리보기) → Apply(적용) 순으로 두 번 실행 권장</div>
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
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">알림 목록</p>
              <p className="text-sm text-[var(--v2-text)]">필터/페이지/재시도</p>
            </div>
            <div className="flex gap-2 text-xs text-[var(--v2-muted)]">
              <button className="rounded-full border border-[var(--v2-border)] px-3 py-1" onClick={load}>새로고침</button>
              <button className="rounded-full border border-[var(--v2-border)] px-3 py-1" onClick={downloadCsv}>CSV 다운로드</button>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-[1fr_1fr]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="외부 사용자 ID 검색"
              className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
            >
              {statusFilters.map((s) => (
                <option key={s} value={s}>{statusLabel(s)}</option>
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
                  <th className="px-3 py-2 text-xs">유형/분류</th>
                  <th className="px-3 py-2 text-xs">상태</th>
                  <th className="px-3 py-2 text-xs">예약/생성</th>
                  <th className="px-3 py-2 text-xs">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--v2-border)]">
                {notifications.map((n) => (
                  (() => {
                    const canRetry = n.status === 'FAILED' || n.status === 'DLQ';
                    const canCancel = n.status === 'PENDING' || n.status === 'RETRYING';
                    return (
                  <tr key={n.id} className="text-[var(--v2-text)]">
                    <td className="px-3 py-2 font-mono text-xs text-[var(--v2-accent)]">{n.id}</td>
                    <td className="px-3 py-2 text-xs">{typeLabel(n.type)} / {n.variant_id ? variantLabel(n.variant_id) : '-'}</td>
                    <td className="px-3 py-2 text-xs">{statusLabel(n.status)}</td>
                    <td className="px-3 py-2 text-xs">{n.scheduled_at || n.created_at || '-'}</td>
                    <td className="px-3 py-2 text-xs">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded border border-[var(--v2-border)] px-2 py-1 disabled:opacity-40"
                          disabled={!canRetry}
                          onClick={() => retryNotification(n.id)}
                          title={canRetry ? 'FAILED/DLQ 상태에서 재시도' : 'FAILED/DLQ에서만 재시도 가능'}
                        >
                          재시도
                        </button>
                        <button
                          className="rounded border border-[var(--v2-border)] px-2 py-1 disabled:opacity-40"
                          disabled={!canCancel}
                          onClick={() => cancelNotification(n.id)}
                          title={canCancel ? 'PENDING/RETRYING 상태에서 취소' : 'PENDING/RETRYING에서만 취소 가능'}
                        >
                          취소
                        </button>
                      </div>
                    </td>
                  </tr>
                    );
                  })()
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
              <button className="rounded border border-[var(--v2-border)] px-3 py-1" onClick={() => setPage((p) => Math.max(1, p - 1))}>이전</button>
              <span>페이지 {page}</span>
              <button className="rounded border border-[var(--v2-border)] px-3 py-1" onClick={() => setPage((p) => p + 1)}>다음</button>
            </div>
            <div>멱등 처리 + 서버 API 연동 완료</div>
          </div>
        </div>
      </div>
    </div>
  );
}
