import { useEffect, useMemo, useState } from 'react';
import { withIdempotency } from '../../lib/apiClient';
import { pushToast } from './toastBus';

const typeOptions = ['ALERT', 'REMINDER', 'BROADCAST'];
const variantOptions = ['EXPIRY', 'DEPOSIT', 'MAINTENANCE'];

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
    case 'MAINTENANCE':
      return '점검';
    default:
      return String(v || '');
  }
};

const statusLabel = (s) => {
  switch (s) {
    case 'PENDING':
      return '대기';
    case 'SENT':
      return '발송됨';
    case 'FAILED':
      return '실패';
    case 'DLQ':
      return 'DLQ';
    default:
      return String(s || '');
  }
};

export default function AdminV2NotificationsPanel({ adminPassword, basePath }) {
  const [type, setType] = useState('ALERT');
  const [variant, setVariant] = useState('EXPIRY');
  const [targetText, setTargetText] = useState('');
  const [scheduledAtLocal, setScheduledAtLocal] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const apiFetch = useMemo(() => withIdempotency({ adminPassword, basePath }), [adminPassword, basePath]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: '1', page_size: '10', order: 'desc' });
      const resp = await apiFetch(`/api/vault/admin/notifications?${params.toString()}`);
      const items = Array.isArray(resp?.items) ? resp.items : [];
      setNotifications(items);
    } catch (err) {
      setError('알림 목록 불러오기 실패');
      console.error('Load notifications error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submitNotification = async () => {
    try {
      setSubmitting(true);
      setError(null);

      if (!targetText.trim()) {
        setError('대상을 입력하세요.');
        return;
      }

      const rawTargets = targetText
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      if (rawTargets.length === 0) {
        setError('올바른 대상을 입력하세요.');
        return;
      }

      let scheduledAtIso;
      if (String(scheduledAtLocal || '').trim()) {
        const d = new Date(scheduledAtLocal);
        if (!Number.isFinite(d.getTime())) {
          setError('예약 시간 형식이 올바르지 않습니다.');
          return;
        }
        scheduledAtIso = d.toISOString();
      }

      const payload = {
        type,
        variant_id: variant || undefined,
        scheduled_at: scheduledAtIso,
        external_user_ids: rawTargets,
      };

      await apiFetch('/api/vault/notify', { method: 'POST', body: payload });
      setTargetText('');
      setScheduledAtLocal('');
      load();
      pushToast({ ok: true, message: '알림 생성 완료' });
    } catch (err) {
      setError('알림 생성 실패');
      pushToast({ ok: false, message: '알림 생성 실패' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--v2-border)] bg-[var(--v2-surface)]/90 p-5" id="notifications">
      <div className="mb-5">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">알림</p>
        <h2 className="mt-2 text-lg font-bold text-[var(--v2-text)]">알림 보내기</h2>
      </div>

      <form className="space-y-4 mb-8" onSubmit={(e) => { e.preventDefault(); submitNotification(); }}>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">알림 유형</label>
            <select className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]" value={type} onChange={(e) => setType(e.target.value)}>
              {typeOptions.map(opt => <option key={opt} value={opt}>{typeLabel(opt)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">분류</label>
            <select className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]" value={variant} onChange={(e) => setVariant(e.target.value)}>
              {variantOptions.map(opt => <option key={opt} value={opt}>{variantLabel(opt)}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">예약 시간</label>
          <input type="datetime-local" className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]" value={scheduledAtLocal} onChange={(e) => setScheduledAtLocal(e.target.value)} />
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">대상(외부 사용자 ID)</label>
          <input placeholder="예: ext-1001, ext-1002" className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)] placeholder-[var(--v2-muted)]" value={targetText} onChange={(e) => setTargetText(e.target.value)} />
        </div>
        {error ? <p className="text-sm text-[var(--v2-warning)]">{error}</p> : null}
        <div className="flex gap-2 pt-2">
          <button type="reset" className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-4 py-2 text-sm font-semibold text-[var(--v2-text)] hover:bg-[var(--v2-surface-3)] transition-colors" onClick={() => setTargetText('')}>초기화</button>
          <button type="submit" className="rounded-lg border border-[var(--v2-accent)] bg-[var(--v2-accent)] px-4 py-2 text-sm font-semibold text-black hover:brightness-110 transition-all disabled:opacity-50" disabled={submitting}>{submitting ? '요청 중...' : '알림 보내기'}</button>
        </div>
      </form>

      <div className="pt-6 border-t border-[var(--v2-border)]">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">최근 알림</p>
        <div className="mt-4">
          {loading ? <p className="text-sm text-[var(--v2-muted)]">불러오는 중...</p> : null}
          <div className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface-2)]/50 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-[var(--v2-border)]">
                <tr className="text-[var(--v2-muted)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">유형</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">분류</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">상태</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">예약/생성</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--v2-border)]">
                {notifications.slice(0, 10).map(n => (
                  <tr key={n.id} className="text-[var(--v2-text)]">
                    <td className="px-4 py-3 font-mono text-xs text-[var(--v2-accent)]">{n.id}</td>
                    <td className="px-4 py-3 text-xs">{typeLabel(n.type)}</td>
                    <td className="px-4 py-3 text-xs">{variantLabel(n.variant_id)}</td>
                    <td className="px-4 py-3 text-xs">{statusLabel(n.status)}</td>
                    <td className="px-4 py-3 text-xs text-[var(--v2-muted)]">{n.scheduled_at || n.created_at || '-'}</td>
                  </tr>
                ))}
                {notifications.length === 0 ? (
                  <tr>
                    <td className="px-4 py-3 text-[var(--v2-muted)]" colSpan={5}>알림 없음</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
