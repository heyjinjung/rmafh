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

function normalizeFiltersForApi(filters) {
  const toIntOrNull = (v) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  };
  return {
    status: Array.isArray(filters?.status) ? filters.status : [],
    expiresAfter: filters?.expiresAfter ? String(filters.expiresAfter) : null,
    expiresBefore: filters?.expiresBefore ? String(filters.expiresBefore) : null,
    depositMin: toIntOrNull(filters?.depositMin),
    depositMax: toIntOrNull(filters?.depositMax),
    attendanceMin: toIntOrNull(filters?.attendanceMin),
    attendanceMax: toIntOrNull(filters?.attendanceMax),
    telegramOk: Boolean(filters?.telegramOk),
    reviewOk: Boolean(filters?.reviewOk),
  };
}

export default function AdminV2SegmentsPanel({ adminPassword, basePath, onSegmentChange }) {
  const [segments, setSegments] = useState([]);
  const [name, setName] = useState('');
  const [filters, setFilters] = useState(emptyFilters);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const apiFetch = useMemo(() => withIdempotency({ adminPassword, basePath }), [adminPassword, basePath]);

  useEffect(() => {
    if (!adminPassword) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiFetch('/api/vault/admin/segments');
        setSegments(res?.data?.items || []);
      } catch (err) {
        const info = extractErrorInfo(err);
        pushToast({ ok: false, message: info.summary || '세그먼트 목록 불러오기 실패', detail: info.requestId || info.detail, requestId: info.requestId, idempotencyKey: info.idempotencyKey });
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applySegment = (segment) => {
    setSelected(segment);
    setFilters(segment.filters || emptyFilters);
    if (typeof onSegmentChange === 'function') {
      onSegmentChange({ segment_id: segment.segment_id, name: segment.name, filters: segment.filters || {} });
    }
  };

  const saveSegment = async () => {
    if (!adminPassword) {
      pushToast({ ok: false, message: '관리자 비밀번호를 먼저 입력하세요.' });
      return;
    }
    if (!name.trim()) return;
    try {
      const payload = { name: name.trim(), filters: normalizeFiltersForApi(filters) };
      const res = await apiFetch('/api/vault/admin/segments', { method: 'POST', body: payload });
      const saved = res?.data;
      setSegments((prev) => {
        const others = prev.filter((s) => s.segment_id !== saved.segment_id);
        return [saved, ...others];
      });
      setSelected(saved);
      pushToast({ ok: true, message: '세그먼트 저장 완료', detail: saved?.name || '-', idempotencyKey: res.idempotencyKey });
      if (typeof onSegmentChange === 'function') {
        onSegmentChange({ segment_id: saved.segment_id, name: saved.name, filters: saved.filters || {} });
      }
    } catch (err) {
      const info = extractErrorInfo(err);
      pushToast({ ok: false, message: info.summary || '세그먼트 저장 실패', detail: info.requestId || info.detail, requestId: info.requestId, idempotencyKey: info.idempotencyKey });
    }
  };

  const deleteSegment = async (segment) => {
    if (!adminPassword) {
      pushToast({ ok: false, message: '관리자 비밀번호를 먼저 입력하세요.' });
      return;
    }
    try {
      await apiFetch(`/api/vault/admin/segments/${segment.segment_id}`, { method: 'DELETE' });
      setSegments((prev) => prev.filter((s) => s.segment_id !== segment.segment_id));
      if (selected?.segment_id === segment.segment_id) {
        setSelected(null);
        if (typeof onSegmentChange === 'function') onSegmentChange(null);
      }
      pushToast({ ok: true, message: '세그먼트 삭제 완료', detail: segment?.name || '-' });
    } catch (err) {
      const info = extractErrorInfo(err);
      pushToast({ ok: false, message: info.summary || '세그먼트 삭제 실패', detail: info.requestId || info.detail, requestId: info.requestId, idempotencyKey: info.idempotencyKey });
    }
  };

  const summary = useMemo(() => {
    const parts = [];
    if (filters.status.length) parts.push(`상태: ${filters.status.map(statusLabel).join(', ')}`);
    if (filters.expiresAfter) parts.push(`만료일 ≥ ${filters.expiresAfter}`);
    if (filters.expiresBefore) parts.push(`만료일 ≤ ${filters.expiresBefore}`);
    if (filters.depositMin || filters.depositMax) parts.push(`입금 ${filters.depositMin || 0} ~ ${filters.depositMax || '∞'}`);
    if (filters.attendanceMin || filters.attendanceMax) parts.push(`출석 ${filters.attendanceMin || 0} ~ ${filters.attendanceMax || '∞'}`);
    if (filters.telegramOk) parts.push('텔레그램 OK');
    if (filters.reviewOk) parts.push('리뷰 OK');
    return parts.join(' · ') || '선택된 필터가 없습니다';
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
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">세그먼트</p>
          <p className="mt-1 text-sm text-[var(--v2-text)]">필터 세트를 저장하고 운영 작업에서 재사용합니다.</p>
        </div>
        <span className="rounded-full border border-[var(--v2-border)] px-3 py-1 text-[10px] text-[var(--v2-muted)]">백엔드 저장</span>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1">
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">세그먼트 이름</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: unlocked_whales"
                  className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)] placeholder:text-[var(--v2-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--v2-accent)]/40"
                />
              </div>
              <button
                type="button"
                onClick={saveSegment}
                disabled={!adminPassword}
                className="rounded-lg border border-[var(--v2-accent)] bg-[var(--v2-accent)] px-4 py-2 text-sm font-semibold text-black shadow-[0_0_16px_rgba(183,247,90,0.35)] hover:brightness-105"
              >
                세그먼트 저장
              </button>
            </div>
            <p className="mt-2 text-xs text-[var(--v2-muted)]">세그먼트는 백엔드에 저장되며 segment_id로 타겟팅할 수 있습니다.</p>
          </div>

          <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">상태</label>
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
                        {statusLabel(s)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">만료일 이후</label>
                  <input
                    type="date"
                    value={filters.expiresAfter}
                    onChange={(e) => setFilters((prev) => ({ ...prev, expiresAfter: e.target.value }))}
                    className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">만료일 이전</label>
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
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">입금 최소</label>
                <input
                  type="number"
                  min="0"
                  value={filters.depositMin}
                  onChange={(e) => setFilters((prev) => ({ ...prev, depositMin: e.target.value }))}
                  className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">입금 최대</label>
                <input
                  type="number"
                  min="0"
                  value={filters.depositMax}
                  onChange={(e) => setFilters((prev) => ({ ...prev, depositMax: e.target.value }))}
                  className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">출석 범위</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0"
                    value={filters.attendanceMin}
                    onChange={(e) => setFilters((prev) => ({ ...prev, attendanceMin: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
                    placeholder="최소"
                  />
                  <input
                    type="number"
                    min="0"
                    value={filters.attendanceMax}
                    onChange={(e) => setFilters((prev) => ({ ...prev, attendanceMax: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
                    placeholder="최대"
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
                텔레그램 OK
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.reviewOk}
                  onChange={(e) => setFilters((prev) => ({ ...prev, reviewOk: e.target.checked }))}
                />
                리뷰 OK
              </label>
            </div>

            <div className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-muted)]">
              {summary}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">저장된 세그먼트</p>
            <div className="mt-3 space-y-2 text-sm">
              {loading ? (
                <p className="text-[var(--v2-muted)]">불러오는 중...</p>
              ) : segments.length === 0 ? (
                <p className="text-[var(--v2-muted)]">저장된 세그먼트가 없습니다. 필터를 설정하고 저장하세요.</p>
              ) : (
                segments.map((segment) => {
                  const active = selected?.segment_id === segment.segment_id;
                  return (
                    <div
                      key={segment.segment_id}
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
                          적용
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSegment(segment)}
                          className="rounded border border-[var(--v2-border)] px-3 py-1 text-[var(--v2-warning)] hover:border-[var(--v2-warning)]/60"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4 text-sm text-[var(--v2-text)]">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">세그먼트 → 운영</p>
            <p className="mt-2">세그먼트를 적용한 뒤, 운영 또는 가져오기에서 동일한 필터 범위를 재사용할 수 있습니다.</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-[var(--v2-muted)]">
              <li>범위: 현재 필터 / 저장 세그먼트 / 업로드 ID 목록</li>
              <li>추후: 링크 공유, 감사 로그 강화 등</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
