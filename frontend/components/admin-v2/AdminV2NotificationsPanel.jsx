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
      const items = resp?.data?.items || [];
      setNotifications(items.map(normalizeNotification));
    } catch (err) {
      setError('알림 목록 불러오기 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div className="rounded-2xl border bg-white p-5" id="notifications">
      <h2 className="text-lg font-bold mb-4">알림 보내기</h2>
      <form className="space-y-4" onSubmit={e => {e.preventDefault();submitNotification();}}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold mb-1">알림 유형</label>
            <select className="w-full rounded border px-3 py-2" value={type} onChange={e=>setType(e.target.value)}>
              {typeOptions.map(opt => <option key={opt} value={opt}>{typeLabel(opt)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">분류</label>
            <select className="w-full rounded border px-3 py-2" value={variant} onChange={e=>setVariant(e.target.value)}>
              {variantOptions.map(opt => <option key={opt} value={opt}>{variantLabel(opt)}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">예약 시간</label>
          <input type="datetime-local" className="w-full rounded border px-3 py-2" value={scheduledAtLocal} onChange={e=>setScheduledAtLocal(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">대상(외부 사용자 ID)</label>
          <input placeholder="예: ext-1001, ext-1002" className="w-full rounded border px-3 py-2" value={targetText} onChange={e=>setTargetText(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button type="reset" className="rounded bg-gray-200 px-4 py-2 font-semibold" onClick={()=>setTargetText('')}>초기화</button>
          <button type="submit" className="rounded bg-blue-600 text-white px-4 py-2 font-semibold" disabled={submitting}>{submitting?'요청 중...':'알림 보내기'}</button>
        </div>
        {error ? <p className="text-sm text-red-500 mt-2">{error}</p> : null}
      </form>

      <h3 className="text-md font-bold mt-8 mb-2">최근 알림</h3>
      {loading ? <p className="text-sm text-gray-400">불러오는 중...</p> : null}
      <table className="min-w-full text-sm">
        <thead>
          <tr>
            <th className="px-2 py-1">ID</th>
            <th className="px-2 py-1">유형</th>
            <th className="px-2 py-1">분류</th>
            <th className="px-2 py-1">상태</th>
            <th className="px-2 py-1">예약/생성</th>
          </tr>
        </thead>
        <tbody>
          {notifications.slice(0,10).map(n=>(
            <tr key={n.id}>
              <td className="px-2 py-1 font-mono text-xs text-blue-600">{n.id}</td>
              <td className="px-2 py-1 text-xs">{typeLabel(n.type)}</td>
              <td className="px-2 py-1 text-xs">{variantLabel(n.variant_id)}</td>
              <td className="px-2 py-1 text-xs">{statusLabel(n.status)}</td>
              <td className="px-2 py-1 text-xs">{n.scheduled_at || n.created_at || '-'}</td>
            </tr>
          ))}
          {notifications.length === 0 ? (
            <tr>
              <td className="px-2 py-1 text-gray-400" colSpan={5}>알림 없음</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
