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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">운영</p>
          <p className="mt-1 text-sm text-[var(--v2-text)]">만료일 연장 및 상태/출석/입금 변경을 안전장치와 함께 실행합니다.</p>
        </div>
        <span className="rounded-full border border-[var(--v2-border)] px-3 py-1 text-[10px] text-[var(--v2-muted)]">Shadow 모드 권장</span>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4 space-y-2">
            <p className="text-sm font-semibold text-[var(--v2-text)]">연동 타겟 (Users에서)</p>
            {linkedTarget ? (
              <div className="text-xs text-[var(--v2-muted)] space-y-1">
                <div>mode: <span className="font-mono">{linkedTarget.mode}</span></div>
                {linkedTarget.mode === 'filter' ? (
                  <>
                    <div>query: <span className="font-mono">{linkedTarget.filter?.query || '-'}</span></div>
                    <div>status: <span className="font-mono">{linkedTarget.filter?.status || '-'}</span></div>
                  </>
                ) : (
                  <div>user_ids: <span className="font-mono">{linkedTarget.ids.length}</span></div>
                )}
              </div>
            ) : (
              <p className="text-xs text-[var(--v2-muted)]">Users에서 타겟을 선택하면 여기에 연결됩니다.</p>
            )}
          </div>

          <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4 space-y-3">
            <p className="text-sm font-semibold text-[var(--v2-text)]">타겟 범위</p>
            <div className="flex flex-wrap gap-2 text-xs text-[var(--v2-text)]">
              {[
                { key: 'segment', label: '저장 세그먼트' },
                { key: 'filter', label: '현재 필터' },
                { key: 'upload', label: '업로드 ID' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setTargetScope(opt.key)}
                  className={[
                    'rounded-full border px-3 py-1',
                    targetScope === opt.key
                      ? 'border-[var(--v2-accent)]/60 bg-[var(--v2-accent)]/10 text-[var(--v2-accent)]'
                      : 'border-[var(--v2-border)] bg-[var(--v2-surface)] text-[var(--v2-text)]',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <input
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder={targetScope === 'upload' ? '업로드 ID 목록 이름(참고용)' : '세그먼트 키 또는 필터 요약(참고용)'}
              className="w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)] placeholder:text-[var(--v2-muted)]"
            />
            <p className="text-xs text-[var(--v2-muted)]">Segment/Filter 범위는 백엔드 타겟팅에 전달되며 멱등성과 감사 로그가 적용됩니다.</p>
          </div>

          <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--v2-text)]">만료일 연장</p>
              <label className="inline-flex items-center gap-2 text-xs text-[var(--v2-muted)]">
                <input
                  type="checkbox"
                  aria-label="Shadow mode"
                  checked={shadow}
                  onChange={(e) => setShadow(e.target.checked)}
                />
                Shadow 모드
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">연장 일수</label>
                <input
                  type="number"
                  min="0"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(Number(e.target.value) || 0)}
                  className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">사유</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
                >
                  {['OPS', 'PROMO', 'ADMIN'].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-[var(--v2-muted)]">Shadow: 미리보기 + 감사로그만. Apply: 실제 반영 + 감사로그.</p>
          </div>

          <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4 space-y-3">
            <p className="text-sm font-semibold text-[var(--v2-text)]">상태 / 출석 / 입금</p>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Gold</label>
                <select
                  value={goldStatus}
                  onChange={(e) => setGoldStatus(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
                >
                  <option value="">변경 없음</option>
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Platinum</label>
                <select
                  value={platinumStatus}
                  onChange={(e) => setPlatinumStatus(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
                >
                  <option value="">변경 없음</option>
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Diamond</label>
                <select
                  value={diamondStatus}
                  onChange={(e) => setDiamondStatus(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
                >
                  <option value="">변경 없음</option>
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">출석 Δ / 상한</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={attendance.delta}
                    onChange={(e) => setAttendance((prev) => ({ ...prev, delta: Number(e.target.value) || 0 }))}
                    className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
                  />
                  <input
                    type="number"
                    value={attendance.cap}
                    onChange={(e) => setAttendance((prev) => ({ ...prev, cap: Number(e.target.value) || 0 }))}
                    className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">입금 Δ / 하한</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={deposit.delta}
                    onChange={(e) => setDeposit((prev) => ({ ...prev, delta: Number(e.target.value) || 0 }))}
                    className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
                  />
                  <input
                    type="number"
                    value={deposit.floor}
                    onChange={(e) => setDeposit((prev) => ({ ...prev, floor: Number(e.target.value) || 0 }))}
                    className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4 text-sm text-[var(--v2-text)]">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">영향도 미리보기</p>
            <div className="mt-3 flex items-center justify-between rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2">
              <span className="text-[var(--v2-muted)]">대상 수(추정)</span>
              <span className="font-semibold text-[var(--v2-accent)]">
                {preview.loading ? '...' : preview.candidates != null ? Number(preview.candidates).toLocaleString() : '-'}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2">
              <span className="text-[var(--v2-muted)]">샘플 user_ids</span>
              <span className="font-semibold text-[var(--v2-text)]">
                {Array.isArray(preview.sample) && preview.sample.length ? `${preview.sample.slice(0, 10).join(', ')}` : '-'}
              </span>
            </div>
            {preview.error ? <p className="mt-2 text-xs text-[var(--v2-warning)]">{String(preview.error)}</p> : null}
            <p className="mt-2 text-xs text-[var(--v2-muted)]">백엔드가 타겟(세그먼트/필터/user_ids) 기준으로 정확한 대상을 계산합니다.</p>
          </div>

          <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4 text-sm text-[var(--v2-text)] space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">안전장치</p>
            <label className="text-xs text-[var(--v2-muted)]">실행을 활성화하려면 apply 를 입력하세요.</label>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
            />
            <button
              type="button"
              disabled={!canExecute}
              onClick={submitExtendExpiry}
              className="w-full rounded-lg border border-[var(--v2-accent)] bg-[var(--v2-accent)] px-4 py-3 text-sm font-semibold text-black shadow-[0_0_18px_rgba(183,247,90,0.35)] disabled:opacity-50"
            >
              {submitting ? '처리 중...' : '만료일 연장 제출 (멱등)'}
            </button>
            <button
              type="button"
              disabled={!canExecute}
              onClick={submitBulkUpdate}
              className="w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-4 py-3 text-sm font-semibold text-[var(--v2-text)] disabled:opacity-50"
            >
              {submitting ? '처리 중...' : '일괄 변경 제출 (멱등)'}
            </button>
            <p className="text-xs text-[var(--v2-muted)]">Extend Expiry는 audit에 기록되고, Bulk Update는 admin job + job items를 생성합니다.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
