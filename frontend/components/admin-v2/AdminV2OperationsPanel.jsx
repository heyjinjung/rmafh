import { useEffect, useMemo, useState } from 'react';
import { extractErrorInfo, withIdempotency } from '../../lib/apiClient';
import { pushToast } from './toastBus';

const statusOptions = ['LOCKED', 'UNLOCKED', 'CLAIMED', 'EXPIRED'];

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
  const [goldStatus, setGoldStatus] = useState('UNLOCKED');
  const [platinumStatus, setPlatinumStatus] = useState('LOCKED');
  const [diamondStatus, setDiamondStatus] = useState('LOCKED');
  const [attendance, setAttendance] = useState({ delta: 0, cap: 3 });
  const [deposit, setDeposit] = useState({ delta: 0, floor: 0 });
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);
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
    setTargetValue(`${linkedTarget.ids.length} user_id selected`);
  }, [linkedTarget]);

  const impact = useMemo(() => {
    const base = targetScope === 'segment' ? 1240 : targetScope === 'upload' ? 420 : 200;
    const preview = Math.max(0, base - (shadow ? 0 : Math.floor(base * 0.02)));
    return { total: base, preview };
  }, [shadow, targetScope]);

  const canExecute = confirmText.trim().toLowerCase() === 'apply';

  const submitExtendExpiry = async () => {
    if (!adminPassword) {
      pushToast({ ok: false, message: 'Admin Password를 먼저 입력하세요.' });
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
          pushToast({ ok: true, message: 'Extend Expiry (Shadow) 프리뷰', detail: `candidates: ${data.candidates ?? '-'}`, requestId });
        } else {
          pushToast({ ok: true, message: 'Extend Expiry 적용 완료', detail: `updated: ${data.updated ?? '-'} / new_expires_at: ${data.new_expires_at ?? '-'}`, requestId });
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
          pushToast({ ok: true, message: 'Extend Expiry (Shadow) 프리뷰', detail: `candidates: ${data.candidates ?? '-'}`, requestId });
        } else {
          pushToast({ ok: true, message: 'Extend Expiry 적용 완료', detail: `updated: ${data.updated ?? '-'} / new_expires_at: ${data.new_expires_at ?? '-'}`, requestId });
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
        pushToast({ ok: true, message: 'Extend Expiry (Shadow) 프리뷰', detail: `candidates: ${data.candidates ?? '-'}`, requestId });
      } else {
        pushToast({ ok: true, message: 'Extend Expiry 적용 완료', detail: `updated: ${data.updated ?? '-'} / new_expires_at: ${data.new_expires_at ?? '-'}`, requestId });
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
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Operations</p>
          <p className="mt-1 text-sm text-[var(--v2-text)]">Extend-expiry, status/attendance/deposit updates with guardrails.</p>
        </div>
        <span className="rounded-full border border-[var(--v2-border)] px-3 py-1 text-[10px] text-[var(--v2-muted)]">Shadow recommended</span>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4 space-y-2">
            <p className="text-sm font-semibold text-[var(--v2-text)]">Linked Target (from Users)</p>
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
            <p className="text-sm font-semibold text-[var(--v2-text)]">Target Scope</p>
            <div className="flex flex-wrap gap-2 text-xs text-[var(--v2-text)]">
              {[
                { key: 'segment', label: 'Saved Segment' },
                { key: 'filter', label: 'Current Filter' },
                { key: 'upload', label: 'Uploaded IDs' },
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
              placeholder={targetScope === 'upload' ? 'Paste uploaded ID list name' : 'Segment key or filter summary'}
              className="w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)] placeholder:text-[var(--v2-muted)]"
            />
            <p className="text-xs text-[var(--v2-muted)]">Segment/Filter scopes are handed to backend for targeting with idempotency + audit log.</p>
          </div>

          <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--v2-text)]">Extend Expiry</p>
              <label className="inline-flex items-center gap-2 text-xs text-[var(--v2-muted)]">
                <input
                  type="checkbox"
                  aria-label="Shadow mode"
                  checked={shadow}
                  onChange={(e) => setShadow(e.target.checked)}
                />
                Shadow mode
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Days to extend</label>
                <input
                  type="number"
                  min="0"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(Number(e.target.value) || 0)}
                  className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Reason</label>
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
            <p className="text-xs text-[var(--v2-muted)]">Shadow: only preview + audit log. Apply: updates vault_status + audit.</p>
          </div>

          <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4 space-y-3">
            <p className="text-sm font-semibold text-[var(--v2-text)]">Status / Attendance / Deposit</p>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Gold</label>
                <select
                  value={goldStatus}
                  onChange={(e) => setGoldStatus(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
                >
                  {statusOptions.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Platinum</label>
                <select
                  value={platinumStatus}
                  onChange={(e) => setPlatinumStatus(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
                >
                  {statusOptions.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Diamond</label>
                <select
                  value={diamondStatus}
                  onChange={(e) => setDiamondStatus(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
                >
                  {statusOptions.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Attendance Δ / cap</label>
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
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Deposit Δ / floor</label>
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
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Impact Preview</p>
            <div className="mt-3 flex items-center justify-between rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2">
              <span className="text-[var(--v2-muted)]">Target count (est.)</span>
              <span className="font-semibold text-[var(--v2-accent)]">{impact.total.toLocaleString()}</span>
            </div>
            <div className="mt-2 flex items-center justify-between rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2">
              <span className="text-[var(--v2-muted)]">Preview-only in Shadow</span>
              <span className="font-semibold text-[var(--v2-text)]">{impact.preview.toLocaleString()}</span>
            </div>
            <p className="mt-2 text-xs text-[var(--v2-muted)]">Backend will calculate exact counts per segment and attach to job payload for audit.</p>
          </div>

          <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4 text-sm text-[var(--v2-text)] space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Safety</p>
            <label className="text-xs text-[var(--v2-muted)]">Type apply to enable execution.</label>
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
              {submitting ? 'Submitting...' : 'Submit Operation (idempotent)'}
            </button>
            <p className="text-xs text-[var(--v2-warning)]">Audit + job creation to be wired. All operations must log idempotency key and scope.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
