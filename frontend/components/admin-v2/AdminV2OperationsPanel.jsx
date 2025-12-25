import { useEffect, useMemo, useState } from 'react';
import { extractErrorInfo, withIdempotency } from '../../lib/apiClient';
import { pushToast } from './toastBus';

const statusOptions = ['LOCKED', 'UNLOCKED', 'CLAIMED', 'EXPIRED'];

const statusLabel = (s) => {
  switch (s) {
    case 'LOCKED':
      return '잠금';
    case 'UNLOCKED':
      return '해제';
    case 'CLAIMED':
      return '수령';
    case 'EXPIRED':
      return '만료';
    default:
      return String(s || '');
  }
};

function makeRequestId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `req-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export default function AdminV2OperationsPanel({ adminPassword, basePath, usersTarget, segmentTarget }) {
  // 안전장치: 적용 버튼 클릭 시 확인 팝업
  const handleApply = async (action) => {
    if (!window.confirm('정말 적용하시겠습니까?')) return;
    if (action === 'expiry') await submitExtendExpiry();
    if (action === 'bulk') await submitBulkUpdate();
  };

  // 직접 대상 입력/필터/CSV 업로드/최근 사용
  const [manualUserIds, setManualUserIds] = useState('');
  const [manualFilter, setManualFilter] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [recentTargets, setRecentTargets] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('recentTargets') || '[]');
    } catch { return []; }
  });
  const saveRecentTarget = (target) => {
    const next = [target, ...recentTargets.filter(t => t !== target)].slice(0, 5);
    setRecentTargets(next);
    localStorage.setItem('recentTargets', JSON.stringify(next));
  };
  const [targetScope, setTargetScope] = useState('segment');
  const [targetValue, setTargetValue] = useState('');
  const [expiryDays, setExpiryDays] = useState(3);
  const [reason, setReason] = useState('PROMO');
  const [shadow, setShadow] = useState(true);
  const [goldStatus, setGoldStatus] = useState('');
  const [platinumStatus, setPlatinumStatus] = useState('');
  const [diamondStatus, setDiamondStatus] = useState('');
  const [attendance, setAttendance] = useState({ delta: 0, cap: 3 });
  const [deposit, setDeposit] = useState({ delta: 0, floor: 0 });
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState({ loading: false, candidates: null, sample: null, error: null });
  const apiFetch = useMemo(() => withIdempotency({ adminPassword, basePath }), [adminPassword, basePath]);

  const linkedTarget = useMemo(() => {
    if (!usersTarget || typeof usersTarget !== 'object') return null;
    const mode = usersTarget.mode || 'page';
    const ids = Array.isArray(usersTarget.user_ids) ? usersTarget.user_ids.map(String) : [];
    const filter = usersTarget.filter || null;
    return { mode, ids, filter };
  }, [usersTarget]);

  useEffect(() => {
    if (!linkedTarget) return;
    if (linkedTarget.mode === 'filter') {
      setTargetScope('filter');
      const q = linkedTarget.filter?.query ? `query=${linkedTarget.filter.query}` : 'query=-';
      const s = linkedTarget.filter?.status ? `status=${linkedTarget.filter.status}` : 'status=-';
      setTargetValue(`${q} ${s}`);
      return;
    }

    // page/uploaded → 실제로는 user_id 리스트 타겟
    setTargetScope('upload');
    setTargetValue(`선택된 user_id: ${linkedTarget.ids.length}개`);
  }, [linkedTarget]);

  const resolvedTarget = useMemo(() => {
    if (targetScope === 'upload') {
      const ids = (linkedTarget?.ids || []).map((v) => Number(v)).filter((n) => Number.isFinite(n));
      if (!ids.length) return null;
      return { mode: 'user_ids', user_ids: ids };
    }
    if (targetScope === 'filter') {
      const filter = linkedTarget?.filter || null;
      if (!filter) return null;
      return { mode: 'filter', filter: { query: filter.query || null, status: filter.status || null } };
    }

    const segId = segmentTarget?.segment_id;
    if (!segId) return null;
    return { mode: 'segment', segment_id: segId };
  }, [linkedTarget, segmentTarget, targetScope]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!adminPassword) {
        setPreview({ loading: false, candidates: null, sample: null, error: null });
        return;
      }
      if (!resolvedTarget) {
        setPreview({ loading: false, candidates: null, sample: null, error: null });
        return;
      }

      try {
        setPreview((prev) => ({ ...prev, loading: true, error: null }));
        const res = await apiFetch('/api/vault/admin/targets/preview', {
          method: 'POST',
          body: { target: resolvedTarget },
        });
        const data = res?.data;
        if (cancelled) return;
        setPreview({
          loading: false,
          candidates: Number.isFinite(data?.candidates) ? data.candidates : null,
          sample: Array.isArray(data?.sample_user_ids) ? data.sample_user_ids : null,
          error: null,
        });
      } catch (err) {
        const info = extractErrorInfo(err);
        if (cancelled) return;
        setPreview({ loading: false, candidates: null, sample: null, error: info.summary || info.detail || '프리뷰 실패' });
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [adminPassword, apiFetch, resolvedTarget]);

  const canExecute = confirmText.trim().toLowerCase() === 'apply';

  const submitBulkUpdate = async () => {
    if (!adminPassword) {
      pushToast({ ok: false, message: '관리자 비밀번호를 먼저 입력하세요.' });
      return;
    }
    if (!resolvedTarget) {
      pushToast({ ok: false, message: '대상(Target)을 먼저 선택/Apply 해주세요.' });
      return;
    }

    const requestId = makeRequestId();

    const status = {};
    if (goldStatus) status.gold_status = goldStatus;
    if (platinumStatus) status.platinum_status = platinumStatus;
    if (diamondStatus) status.diamond_status = diamondStatus;

    const attendancePayload = {};
    if (Number.isFinite(attendance?.delta) && Number(attendance.delta) !== 0) attendancePayload.delta = Number(attendance.delta);
    if (Number.isFinite(attendance?.cap) && Number(attendance.cap) > 0 && Number(attendance.cap) !== 3) attendancePayload.cap = Number(attendance.cap);

    const depositPayload = {};
    if (Number.isFinite(deposit?.delta) && Number(deposit.delta) !== 0) depositPayload.delta = Number(deposit.delta);
    if (Number.isFinite(deposit?.floor) && Number(deposit.floor) !== 0) depositPayload.floor = Number(deposit.floor);

    const payload = {
      request_id: requestId,
      target: resolvedTarget,
      ...(Object.keys(status).length ? { status } : {}),
      ...(Object.keys(attendancePayload).length ? { attendance: attendancePayload } : {}),
      ...(Object.keys(depositPayload).length ? { deposit: depositPayload } : {}),
    };

    if (!payload.status && !payload.attendance && !payload.deposit) {
      pushToast({ ok: false, message: '변경할 값이 없습니다. Status/Attendance/Deposit 중 하나를 지정하세요.' });
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiFetch('/api/vault/admin/operations/bulk-update', { method: 'POST', body: payload, idempotencyKey: requestId });
      const data = res?.data;
      pushToast({
        ok: true,
        message: 'Bulk Update 요청 완료',
        detail: `job_id: ${data?.job_id || '-'} / processed: ${data?.processed ?? '-'} / failed: ${data?.failed ?? '-'}`,
        requestId,
        idempotencyKey: res?.idempotencyKey,
      });
    } catch (err) {
      const info = extractErrorInfo(err);
      pushToast({ ok: false, message: info.summary || '요청 실패', detail: info.requestId || info.detail, requestId: info.requestId, idempotencyKey: info.idempotencyKey });
    } finally {
      setSubmitting(false);
    }
  };

  const submitExtendExpiry = async () => {
    if (!adminPassword) {
      pushToast({ ok: false, message: '관리자 비밀번호를 먼저 입력하세요.' });
      return;
    }

    const extendHours = Math.trunc(Number(expiryDays) * 24);
    if (!Number.isFinite(extendHours) || extendHours < 1 || extendHours > 72) {
      pushToast({ ok: false, message: '연장 시간은 1~72시간(최대 3일) 범위여야 합니다.' });
      return;
    }
    if (!['OPS', 'PROMO', 'ADMIN'].includes(String(reason).toUpperCase())) {
      pushToast({ ok: false, message: 'Reason은 OPS/PROMO/ADMIN 중 하나여야 합니다.' });
      return;
    }

    const requestId = makeRequestId();

    try {
      setSubmitting(true);

      if (targetScope === 'upload') {
        const ids = linkedTarget?.ids || [];
        if (!ids.length) {
          pushToast({ ok: false, message: 'Users에서 대상 user_ids를 먼저 선택하세요.' });
          return;
        }

        const payload = {
          request_id: requestId,
          scope: 'USER_IDS',
          user_ids: ids.map((v) => Number(v)).filter((n) => Number.isFinite(n)),
          extend_hours: extendHours,
          reason: String(reason).toUpperCase(),
          shadow,
        };

        const res = await apiFetch('/api/vault/extend-expiry', { method: 'POST', body: payload, idempotencyKey: requestId });
        const data = res?.data;
        if (data?.shadow) {
          pushToast({ ok: true, message: '만료일 연장 (Shadow) 미리보기', detail: `대상 수: ${data.candidates ?? '-'}`, requestId });
        } else {
          pushToast({ ok: true, message: '만료일 연장 적용 완료', detail: `변경: ${data.updated ?? '-'} / new_expires_at: ${data.new_expires_at ?? '-'}`, requestId });
        }
        return;
      }

      if (targetScope === 'filter') {
        const filter = linkedTarget?.filter || null;
        if (!filter) {
          pushToast({ ok: false, message: 'Users에서 필터 스코프를 먼저 선택하세요.' });
          return;
        }
        const payload = {
          request_id: requestId,
          target: { mode: 'filter', filter: { query: filter.query || null, status: filter.status || null } },
          extend_hours: extendHours,
          reason: String(reason).toUpperCase(),
          shadow,
        };
        const res = await apiFetch('/api/vault/admin/operations/extend-expiry', { method: 'POST', body: payload, idempotencyKey: requestId });
        const data = res?.data;
        if (data?.shadow) {
          pushToast({ ok: true, message: '만료일 연장 (Shadow) 미리보기', detail: `대상 수: ${data.candidates ?? '-'}`, requestId });
        } else {
          pushToast({ ok: true, message: '만료일 연장 적용 완료', detail: `변경: ${data.updated ?? '-'} / new_expires_at: ${data.new_expires_at ?? '-'}`, requestId });
        }
        return;
      }

      // segment
      const segId = segmentTarget?.segment_id;
      if (!segId) {
        pushToast({ ok: false, message: 'Segments에서 세그먼트를 Apply 해주세요.' });
        return;
      }
      const payload = {
        request_id: requestId,
        target: { mode: 'segment', segment_id: segId },
        extend_hours: extendHours,
        reason: String(reason).toUpperCase(),
        shadow,
      };
      const res = await apiFetch('/api/vault/admin/operations/extend-expiry', { method: 'POST', body: payload, idempotencyKey: requestId });
      const data = res?.data;
      if (data?.shadow) {
        pushToast({ ok: true, message: '만료일 연장 (Shadow) 미리보기', detail: `대상 수: ${data.candidates ?? '-'}`, requestId });
      } else {
        pushToast({ ok: true, message: '만료일 연장 적용 완료', detail: `변경: ${data.updated ?? '-'} / new_expires_at: ${data.new_expires_at ?? '-'}`, requestId });
      }
    } catch (err) {
      const info = extractErrorInfo(err);
      pushToast({ ok: false, message: info.summary || '요청 실패', detail: info.requestId || info.detail, requestId: info.requestId, idempotencyKey: info.idempotencyKey });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="operations" className="rounded-2xl border border-[var(--v2-border)] bg-[var(--v2-surface)]/80 p-5">
      <h2 className="text-lg font-bold text-[var(--v2-accent)] mb-2">회원정보 일괄 변경</h2>
      <ol className="mb-4 list-decimal pl-4 text-sm text-[var(--v2-muted)]">
        <li>아래에서 <b>user_id 직접 입력</b>, <b>조건(필터) 입력</b>, <b>CSV 업로드</b> 중 하나로 대상을 지정하세요.</li>
        <li>최근 사용한 대상은 드롭다운에서 바로 선택할 수 있습니다.</li>
        <li>변경할 내용을 입력하고, 미리보기로 대상/변경 내용을 확인하세요.</li>
        <li>문제가 없으면 &apos;적용하기&apos; 버튼을 눌러주세요.</li>
      </ol>
      <div className="space-y-4">
        {/* 대상 직접 입력/필터/CSV/최근 */}
        <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4 space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">대상 지정</p>
          <div className="flex flex-col gap-2 md:flex-row md:gap-3">
            <input type="text" placeholder="user_id 직접 입력 (쉼표/엔터 구분)" value={manualUserIds} onChange={e => setManualUserIds(e.target.value)} className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)] placeholder-[var(--v2-muted)] flex-1" />
            <input type="text" placeholder="조건(예: 상태: UNLOCKED, 만료일: 2025-12-31 이전)" value={manualFilter} onChange={e => setManualFilter(e.target.value)} className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)] placeholder-[var(--v2-muted)] flex-1" />
            <input type="file" accept=".csv" onChange={e => setCsvFile(e.target.files?.[0] || null)} className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)] flex-1 file:mr-2 file:rounded file:border-0 file:bg-[var(--v2-accent)] file:px-2 file:py-1 file:text-xs file:font-semibold file:text-black file:cursor-pointer" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <select className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-xs text-[var(--v2-text)]" onChange={e => {
              const v = e.target.value;
              if (!v) return;
              setManualUserIds(v);
            }}>
              <option value="">최근 사용 대상 선택</option>
              {recentTargets.map((t, i) => <option key={i} value={t}>{t}</option>)}
            </select>
            <button type="button" className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface-2)] hover:bg-[var(--v2-surface-3)] transition-colors px-3 py-2 text-xs font-semibold text-[var(--v2-text)]" onClick={() => saveRecentTarget(manualUserIds)}>현재 입력 저장</button>
          </div>
          <p className="text-xs text-[var(--v2-muted)]">user_id 여러 명 입력 시 쉼표(,) 또는 엔터로 구분, 조건은 예시 참고</p>
        </div>
        {/* 만료일 연장 */}
        <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4 space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">만료일 연장</p>
          <div className="flex gap-3 flex-wrap">
            <input type="number" min="1" max="3" aria-label="연장 일수" value={expiryDays} onChange={e => setExpiryDays(Number(e.target.value) || 1)} className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)] w-20" />
            <select value={reason} onChange={e => setReason(e.target.value)} className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]">
              <option value="PROMO">프로모션</option>
              <option value="OPS">운영</option>
              <option value="ADMIN">관리자</option>
            </select>
          </div>
          <div className="mt-3 w-full rounded-lg bg-[var(--v2-accent)] px-4 py-2 text-sm font-bold text-black hover:brightness-110 transition-all disabled:opacity-50" onClick={() => handleApply('expiry')}>
            적용하기
          </div>
        </div>
        {/* 상태/출석/입금 변경 */}
        <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4 space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">상태/출석/입금 변경</p>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">골드</label>
              <select value={goldStatus} onChange={e => setGoldStatus(e.target.value)} className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]">
                <option value="">변경 없음</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{statusLabel(s)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">플래티넘</label>
              <select value={platinumStatus} onChange={e => setPlatinumStatus(e.target.value)} className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]">
                <option value="">변경 없음</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{statusLabel(s)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">다이아</label>
              <select value={diamondStatus} onChange={e => setDiamondStatus(e.target.value)} className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]">
                <option value="">변경 없음</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{statusLabel(s)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 mt-2">
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">출석 Δ / 상한</label>
              <p className="mt-1 text-xs text-[var(--v2-muted)]">변화량 / 최대값</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <input type="number" placeholder="변화량" aria-label="출석 Δ" value={attendance.delta} onChange={e => setAttendance((prev) => ({ ...prev, delta: Number(e.target.value) || 0 }))} className="w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]" />
                  <span className="mt-1 block text-xs text-[var(--v2-muted)]">예: +5</span>
                </div>
                <div>
                  <input type="number" placeholder="상한" aria-label="출석 상한" value={attendance.cap} onChange={e => setAttendance((prev) => ({ ...prev, cap: Number(e.target.value) || 0 }))} className="w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]" />
                  <span className="mt-1 block text-xs text-[var(--v2-muted)]">예: 100</span>
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">입금 Δ / 하한</label>
              <p className="mt-1 text-xs text-[var(--v2-muted)]">변화량 / 최소값</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <input type="number" placeholder="변화량" aria-label="입금 Δ" value={deposit.delta} onChange={e => setDeposit((prev) => ({ ...prev, delta: Number(e.target.value) || 0 }))} className="w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]" />
                  <span className="mt-1 block text-xs text-[var(--v2-muted)]">예: +10000</span>
                </div>
                <div>
                  <input type="number" placeholder="하한" aria-label="입금 하한" value={deposit.floor} onChange={e => setDeposit((prev) => ({ ...prev, floor: Number(e.target.value) || 0 }))} className="w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]" />
                  <span className="mt-1 block text-xs text-[var(--v2-muted)]">예: 0</span>
                </div>
              </div>
            </div>
          </div>
          <button type="button" className="mt-3 w-full rounded-lg bg-[var(--v2-accent)] px-4 py-2 text-sm font-bold text-black hover:brightness-110 transition-all" onClick={() => handleApply('bulk')}>
            적용하기
          </button>
        </div>
        {/* 미리보기 */}
        <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4 space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">미리보기</p>
          <div className="text-sm text-[var(--v2-text)]">대상 수: {preview.loading ? '...' : preview.candidates != null ? Number(preview.candidates).toLocaleString() : '-'}</div>
          <div className="text-sm text-[var(--v2-muted)]">샘플 user_ids: {Array.isArray(preview.sample) && preview.sample.length ? preview.sample.slice(0, 10).join(', ') : '-'}</div>
          {preview.error && <div className="text-sm text-[var(--v2-warning)]">{preview.error}</div>}
        </div>
      </div>
    </section>
  );
}
