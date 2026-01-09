/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { withIdempotency } from '../../lib/apiClient';
import { pushToast } from './toastBus';

// 백엔드 허용 타입/버전 목록과 일치시킴
const typeOptions = ['EXPIRY_D2', 'EXPIRY_D0', 'ATTENDANCE_D2', 'TICKET_ZERO', 'SOCIAL_PROOF'];
const variantOptions = ['', 'A', 'B', 'LOSS_BANNER_A', 'LOSS_BANNER_B', 'SOCIAL_PROOF_A', 'SOCIAL_PROOF_B', 'TICKET_ZERO_A', 'TICKET_ZERO_B'];

const typeLabel = (t) => {
  const map = {
    EXPIRY_D2: '만료 2일 전',
    EXPIRY_D0: '만료 당일',
    ATTENDANCE_D2: '출석 안내',
    TICKET_ZERO: '티켓 소진',
    SOCIAL_PROOF: '소셜 증빙',
  };
  return map[t] || String(t || '');
};

const variantLabel = (v) => {
  if (!v) return '없음';
  const map = {
    A: 'A',
    B: 'B',
    LOSS_BANNER_A: 'LOSS_BANNER_A',
    LOSS_BANNER_B: 'LOSS_BANNER_B',
    SOCIAL_PROOF_A: 'SOCIAL_PROOF_A',
    SOCIAL_PROOF_B: 'SOCIAL_PROOF_B',
    TICKET_ZERO_A: 'TICKET_ZERO_A',
    TICKET_ZERO_B: 'TICKET_ZERO_B',
  };
  return map[v] || String(v || '');
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
  const [type, setType] = useState('EXPIRY_D2');
  const [variant, setVariant] = useState('');
  const [targetText, setTargetText] = useState('');
  const [scheduledAtLocal, setScheduledAtLocal] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [templatePreview, setTemplatePreview] = useState(null);
  const apiFetch = useMemo(() => withIdempotency({ adminPassword, basePath }), [adminPassword, basePath]);

  // 메시지 템플릿 매핑
  const templateMap = {
    'EXPIRY_D2': {
      title: '만료 2일 전 - 마지막 기회!',
      body: '🔔 안녕하세요!\n\n당신의 프리미엄 멤버십이 2일 후 만료됩니다.\n지금 바로 갱신하고 계속해서 특별한 혜택을 누려보세요!\n\n✨ 멤버십 갱신 시 제한 없는 접근권한 보장\n💎 프리미엄 콘텐츠 무제한 이용\n\n⏰ 서둘러주세요. 시간이 얼마 남지 않았습니다!',
      cta_text: '지금 갱신하기',
      category: 'REMINDER'
    },
    'EXPIRY_D0': {
      title: '긴급: 오늘 만료됩니다!',
      body: '⚠️ 긴급 알림!\n\n당신의 프리미엄 멤버십이 오늘 만료됩니다.\n\n지금 바로 갱신하지 않으면 모든 프리미엄 기능에 접근할 수 없게 됩니다.\n\n🚨 지금 바로 갱신하세요!',
      cta_text: '지금 갱신하기',
      category: 'URGENT'
    },
    'ATTENDANCE_D2': {
      title: '출석 기회를 놓치고 있어요!',
      body: '📅 출석 기회를 놓치고 있어요!\n\n현재 출석 일수: [CURRENT_COUNT]일\n목표 출석 일수: [TARGET_COUNT]일\n남은 일수: 2일\n\n지금이 마지막 기회입니다!\n다음 2일 동안 출석하면 추가 보상을 받을 수 있습니다.\n\n✅ 지금 바로 출석 체크하기',
      cta_text: '출석하기',
      category: 'REMINDER'
    },
    'TICKET_ZERO': {
      title: '기회 소진 - 새로운 시작!',
      body: '😢 더 이상의 기회가 없습니다.\n\n당신의 모든 기회를 다 소진했습니다.\n\n하지만 아직 희망은 있습니다!\n\n🆕 새로운 프리미엄 멤버십으로 무제한 기회를 얻으세요!\n\n💰 특별 할인가: 지금 가입하면 50% 할인!\n\n⏰ 이 특가는 24시간만 유효합니다.',
      cta_text: '특가로 가입하기',
      category: 'URGENT'
    },
    'SOCIAL_PROOF': {
      title: '당신도 이들처럼 성공할 수 있습니다!',
      body: '🌟 당신도 이들처럼 성공할 수 있습니다!\n\n지금 활동 중인 프리미엄 회원들:\n━━━━━━━━━━━━━━━━━━━━━━━━\n📊 5,234명이 이번 달 목표를 달성했어요!\n📈 평균 참여도: 87%\n💰 평균 보상: 1,250,000원\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n당신도 그들의 일원이 될 수 있습니다.\n\n✨ 지금 시작하면 무엇이 다를까요?\n\n→ 성공 사례 확인하기\n→ 지금 바로 시작하기',
      cta_text: '시작하기',
      category: 'SOCIAL_PROOF'
    }
  };

  // 타입 변경 시 템플릿 업데이트
  const handleTypeChange = (newType) => {
    setType(newType);
    const template = templateMap[newType] || null;
    setTemplatePreview(template);
  };

  const load = useCallback(async () => {
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
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

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

  const cancelAll = async () => {
    if (!notifications.length) return;
    try {
      setBulkDeleting(true);
      await Promise.all(
        notifications.map((n) =>
          apiFetch(`/api/vault/admin/notifications/${n.id}/cancel`, { method: 'POST' }).catch(() => null)
        )
      );
      load();
      pushToast({ ok: true, message: '알림 전체 취소 완료' });
    } catch (err) {
      pushToast({ ok: false, message: '전체 취소 실패' });
    } finally {
      setBulkDeleting(false);
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
            <select className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]" value={type} onChange={(e) => handleTypeChange(e.target.value)}>
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
        
        {/* 메시지 미리보기 */}
        {templatePreview && (
          <div className="rounded-lg bg-[var(--v2-surface-2)] p-4 border border-[var(--v2-border)]">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)] mb-3">메시지 미리보기</p>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-[var(--v2-muted)]">제목</p>
                <p className="text-sm font-semibold text-[var(--v2-text)] mt-1">{templatePreview.title}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--v2-muted)]">본문</p>
                <p className="text-sm text-[var(--v2-text)] mt-1 whitespace-pre-wrap">{templatePreview.body}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--v2-muted)]">버튼:</span>
                <button className="text-xs px-3 py-1 rounded bg-[var(--v2-accent)] text-black font-semibold">{templatePreview.cta_text}</button>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex gap-2 pt-2">
          <button type="reset" className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-4 py-2 text-sm font-semibold text-[var(--v2-text)] hover:bg-[var(--v2-surface-3)] transition-colors" onClick={() => setTargetText('')}>초기화</button>
          <button type="submit" className="rounded-lg border border-[var(--v2-accent)] bg-[var(--v2-accent)] px-4 py-2 text-sm font-semibold text-black hover:brightness-110 transition-all disabled:opacity-50" disabled={submitting}>{submitting ? '요청 중...' : '알림 보내기'}</button>
        </div>
      </form>

      <div className="pt-6 border-t border-[var(--v2-border)]">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">최근 알림</p>
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={cancelAll}
            disabled={bulkDeleting || loading || notifications.length === 0}
            className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-3 py-1 text-xs text-[var(--v2-text)] hover:border-[var(--v2-warning)]/60 disabled:opacity-50"
          >
            전체 삭제
          </button>
        </div>
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
