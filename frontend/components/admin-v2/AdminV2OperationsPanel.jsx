import { useMemo, useState } from 'react';

const statusOptions = ['LOCKED', 'UNLOCKED', 'CLAIMED', 'EXPIRED'];

export default function AdminV2OperationsPanel() {
  const [targetScope, setTargetScope] = useState('segment');
  const [targetValue, setTargetValue] = useState('');
  const [expiryDays, setExpiryDays] = useState(3);
  const [reason, setReason] = useState('PROMO_EXTENSION');
  const [shadow, setShadow] = useState(true);
  const [goldStatus, setGoldStatus] = useState('UNLOCKED');
  const [platinumStatus, setPlatinumStatus] = useState('LOCKED');
  const [diamondStatus, setDiamondStatus] = useState('LOCKED');
  const [attendance, setAttendance] = useState({ delta: 0, cap: 3 });
  const [deposit, setDeposit] = useState({ delta: 0, floor: 0 });
  const [confirmText, setConfirmText] = useState('');

  const impact = useMemo(() => {
    const base = targetScope === 'segment' ? 1240 : targetScope === 'upload' ? 420 : 200;
    const preview = Math.max(0, base - (shadow ? 0 : Math.floor(base * 0.02)));
    return { total: base, preview };
  }, [shadow, targetScope]);

  const canExecute = confirmText.trim().toLowerCase() === 'apply';

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
                <input type="checkbox" checked={shadow} onChange={(e) => setShadow(e.target.checked)} />
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
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
                />
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
              className="w-full rounded-lg border border-[var(--v2-accent)] bg-[var(--v2-accent)] px-4 py-3 text-sm font-semibold text-black shadow-[0_0_18px_rgba(183,247,90,0.35)] disabled:opacity-50"
            >
              Submit Operation (idempotent)
            </button>
            <p className="text-xs text-[var(--v2-warning)]">Audit + job creation to be wired. All operations must log idempotency key and scope.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
