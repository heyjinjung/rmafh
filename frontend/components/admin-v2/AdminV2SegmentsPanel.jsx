import { useEffect, useMemo, useState } from 'react';

const storageKey = 'adminV2Segments';
const statusOptions = ['LOCKED', 'UNLOCKED', 'CLAIMED', 'EXPIRED'];

const emptyFilters = {
  status: [],
  expiresAfter: '',
  expiresBefore: '',
  depositMin: '',
  depositMax: '',
  attendanceMin: '',
  attendanceMax: '',
  telegramOk: false,
  reviewOk: false,
};

export default function AdminV2SegmentsPanel() {
  const [segments, setSegments] = useState([]);
  const [name, setName] = useState('');
  const [filters, setFilters] = useState(emptyFilters);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      try {
        setSegments(JSON.parse(stored));
      } catch (err) {
        window.localStorage.removeItem(storageKey);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, JSON.stringify(segments));
  }, [segments]);

  const applySegment = (segment) => {
    setSelected(segment);
    setFilters(segment.filters);
  };

  const saveSegment = () => {
    if (!name.trim()) return;
    const next = { name: name.trim(), filters: filters };
    setSegments((prev) => {
      const others = prev.filter((s) => s.name !== next.name);
      return [...others, next];
    });
    setSelected(next);
  };

  const deleteSegment = (segmentName) => {
    setSegments((prev) => prev.filter((s) => s.name !== segmentName));
    if (selected?.name === segmentName) {
      setSelected(null);
    }
  };

  const summary = useMemo(() => {
    const parts = [];
    if (filters.status.length) parts.push(`status: ${filters.status.join(',')}`);
    if (filters.expiresAfter) parts.push(`expires >= ${filters.expiresAfter}`);
    if (filters.expiresBefore) parts.push(`expires <= ${filters.expiresBefore}`);
    if (filters.depositMin || filters.depositMax) parts.push(`deposit ${filters.depositMin || 0} - ${filters.depositMax || '∞'}`);
    if (filters.attendanceMin || filters.attendanceMax) parts.push(`attendance ${filters.attendanceMin || 0} - ${filters.attendanceMax || '∞'}`);
    if (filters.telegramOk) parts.push('telegram ok');
    if (filters.reviewOk) parts.push('review ok');
    return parts.join(' · ') || 'No filters selected';
  }, [filters]);

  const toggleStatus = (status) => {
    setFilters((prev) => {
      const set = new Set(prev.status);
      if (set.has(status)) set.delete(status);
      else set.add(status);
      return { ...prev, status: Array.from(set) };
    });
  };

  return (
    <section id="segments" className="rounded-2xl border border-[var(--v2-border)] bg-[var(--v2-surface)]/80 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Segments</p>
          <p className="mt-1 text-sm text-[var(--v2-text)]">Create, save, and reuse filter sets across operations.</p>
        </div>
        <span className="rounded-full border border-[var(--v2-border)] px-3 py-1 text-[10px] text-[var(--v2-muted)]">Local draft</span>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1">
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Segment Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. unlocked_whales"
                  className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)] placeholder:text-[var(--v2-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--v2-accent)]/40"
                />
              </div>
              <button
                type="button"
                onClick={saveSegment}
                className="rounded-lg border border-[var(--v2-accent)] bg-[var(--v2-accent)] px-4 py-2 text-sm font-semibold text-black shadow-[0_0_16px_rgba(183,247,90,0.35)] hover:brightness-105"
              >
                Save Segment
              </button>
            </div>
            <p className="mt-2 text-xs text-[var(--v2-muted)]">Segments are stored locally until backend persistence is wired.</p>
          </div>

          <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Status</label>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--v2-text)]">
                  {statusOptions.map((s) => {
                    const active = filters.status.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleStatus(s)}
                        className={[
                          'rounded-full border px-3 py-1 transition',
                          active
                            ? 'border-[var(--v2-accent)]/60 bg-[var(--v2-accent)]/10 text-[var(--v2-accent)]'
                            : 'border-[var(--v2-border)] bg-[var(--v2-surface)] text-[var(--v2-text)]',
                        ].join(' ')}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Expires After</label>
                  <input
                    type="date"
                    value={filters.expiresAfter}
                    onChange={(e) => setFilters((prev) => ({ ...prev, expiresAfter: e.target.value }))}
                    className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Expires Before</label>
                  <input
                    type="date"
                    value={filters.expiresBefore}
                    onChange={(e) => setFilters((prev) => ({ ...prev, expiresBefore: e.target.value }))}
                    className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Deposit Min</label>
                <input
                  type="number"
                  min="0"
                  value={filters.depositMin}
                  onChange={(e) => setFilters((prev) => ({ ...prev, depositMin: e.target.value }))}
                  className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Deposit Max</label>
                <input
                  type="number"
                  min="0"
                  value={filters.depositMax}
                  onChange={(e) => setFilters((prev) => ({ ...prev, depositMax: e.target.value }))}
                  className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Attendance Range</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0"
                    value={filters.attendanceMin}
                    onChange={(e) => setFilters((prev) => ({ ...prev, attendanceMin: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
                    placeholder="min"
                  />
                  <input
                    type="number"
                    min="0"
                    value={filters.attendanceMax}
                    onChange={(e) => setFilters((prev) => ({ ...prev, attendanceMax: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
                    placeholder="max"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-[var(--v2-text)]">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.telegramOk}
                  onChange={(e) => setFilters((prev) => ({ ...prev, telegramOk: e.target.checked }))}
                />
                Telegram OK
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.reviewOk}
                  onChange={(e) => setFilters((prev) => ({ ...prev, reviewOk: e.target.checked }))}
                />
                Review OK
              </label>
            </div>

            <div className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-muted)]">
              {summary}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Saved Segments</p>
            <div className="mt-3 space-y-2 text-sm">
              {segments.length === 0 ? (
                <p className="text-[var(--v2-muted)]">저장된 세그먼트가 없습니다. 필터를 설정하고 저장하세요.</p>
              ) : (
                segments.map((segment) => {
                  const active = selected?.name === segment.name;
                  return (
                    <div
                      key={segment.name}
                      className={[
                        'flex items-center justify-between rounded-lg border px-3 py-2',
                        active
                          ? 'border-[var(--v2-accent)]/60 bg-[var(--v2-accent)]/10 text-[var(--v2-accent)]'
                          : 'border-[var(--v2-border)] bg-[var(--v2-surface)] text-[var(--v2-text)]',
                      ].join(' ')}
                    >
                      <div>
                        <div className="text-sm font-semibold">{segment.name}</div>
                        <div className="text-xs text-[var(--v2-muted)]">{Object.keys(segment.filters || {}).join(', ')}</div>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => applySegment(segment)}
                          className="rounded border border-[var(--v2-border)] px-3 py-1 hover:border-[var(--v2-accent)]/60"
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSegment(segment.name)}
                          className="rounded border border-[var(--v2-border)] px-3 py-1 text-[var(--v2-warning)] hover:border-[var(--v2-warning)]/60"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4 text-sm text-[var(--v2-text)]">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Segment → Operations</p>
            <p className="mt-2">Apply a segment, then launch Operations or Imports to reuse the filter scope. Backend wiring will send the segment payload.</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-[var(--v2-muted)]">
              <li>Scopes: current filter, saved segment, uploaded ID list</li>
              <li>Future: persist to backend, shareable links, audit trail</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
