import { useMemo, useState, useCallback, useEffect } from 'react';
import { withIdempotency } from '../../lib/apiClient';

const rowHeight = 48;
const viewportHeight = 440;
const statusOptions = ['LOCKED', 'UNLOCKED', 'CLAIMED', 'EXPIRED'];
const columnDefs = [
  { key: 'external_user_id', label: '외부 사용자 ID' },
  { key: 'nickname', label: '닉네임' },
  { key: 'created_at', label: '생성일' },
  { key: 'gold_status', label: '골드 상태' },
  { key: 'platinum_status', label: '플래티넘 상태' },
  { key: 'diamond_status', label: '다이아 상태' },
  { key: 'platinum_attendance_days', label: '출석(일)' },
  { key: 'deposit_total', label: '누적 입금' },
  { key: 'expires_at', label: '만료일' },
];

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

const bulkModeLabel = (mode) => {
  switch (mode) {
    case 'page':
      return '현재 페이지';
    case 'filter':
      return '현재 필터';
    case 'uploaded':
      return '업로드 ID';
    default:
      return String(mode || '-');
  }
};

const sortableKeys = new Set(['created_at', 'expires_at', 'deposit_total', 'external_user_id', 'nickname']);

const storageKeys = {
  columns: 'adminV2UserColumns',
  bulk: 'adminV2UserBulkSelection',
};

export default function AdminV2UsersGrid({ adminPassword, basePath, onTargetChange }) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('expires_at');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [scrollTop, setScrollTop] = useState(0);
  const [selectedRow, setSelectedRow] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Persisted UI state for columns and bulk selection
  const [visibleColumns, setVisibleColumns] = useState(() => {
    if (typeof window === 'undefined') return columnDefs.map((c) => c.key);
    const stored = window.localStorage.getItem(storageKeys.columns);
    return stored ? JSON.parse(stored) : columnDefs.map((c) => c.key);
  });
  const [bulkSelection, setBulkSelection] = useState(() => {
    if (typeof window === 'undefined') return { mode: 'page', ids: [] };
    const stored = window.localStorage.getItem(storageKeys.bulk);
    return stored ? JSON.parse(stored) : { mode: 'page', ids: [] };
  });
  const [uploadedIdsText, setUploadedIdsText] = useState('');

  const apiFetch = useMemo(() => withIdempotency({ adminPassword, basePath }), [adminPassword, basePath]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('page_size', String(pageSize));
      params.set('sort_by', sortBy);
      params.set('sort_dir', sortDir);
      if (query) params.set('query', query.trim());
      if (statusFilter) params.set('status', statusFilter);

      const { data } = await apiFetch(`/api/vault/admin/users?${params.toString()}`);
      const nextRows = Array.isArray(data?.users) ? data.users : [];
      setRows(nextRows);
      setTotal(Number(data?.total || 0));
      setScrollTop(0);
    } catch (err) {
      setError(err?.payload || err?.message || '불러오기 실패');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, page, pageSize, query, sortBy, sortDir, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKeys.columns, JSON.stringify(visibleColumns));
    }
  }, [visibleColumns]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKeys.bulk, JSON.stringify(bulkSelection));
    }
  }, [bulkSelection]);

  const totalHeight = rows.length * rowHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 3);
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + 6;
  const endIndex = Math.min(rows.length, startIndex + visibleCount);
  const visibleRows = rows.slice(startIndex, endIndex);
  const offsetY = startIndex * rowHeight;

  const onScroll = useCallback((e) => setScrollTop(e.currentTarget.scrollTop), []);

  const toggleSort = (key) => {
    if (!sortableKeys.has(key)) {
      setSortBy('created_at');
      setSortDir('desc');
      return;
    }
    if (sortBy === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  const toggleColumn = (key) => {
    setVisibleColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleBulkSelection = (row) => {
    setBulkSelection((prev) => {
      const ids = new Set(prev.ids || []);
      const key = String(row.user_id);
      if (ids.has(key)) {
        ids.delete(key);
      } else {
        ids.add(key);
      }
      return { ...prev, ids: Array.from(ids) };
    });
  };

  const bulkSelectPage = () => {
    setBulkSelection((prev) => ({ ...prev, mode: 'page', ids: rows.map((r) => String(r.user_id)) }));
  };

  const bulkSelectFilter = () => {
    setBulkSelection((prev) => ({ ...prev, mode: 'filter', ids: [], filter: { query: query.trim(), status: statusFilter } }));
  };

  const bulkSelectUploadIds = () => {
    setBulkSelection((prev) => ({ ...prev, mode: 'uploaded', ids: prev.ids || [] }));
  };

  const applyUploadedIds = () => {
    const raw = uploadedIdsText || '';
    const parts = raw
      .split(/[\s,\n\r\t]+/)
      .map((v) => v.trim())
      .filter(Boolean);
    const unique = Array.from(new Set(parts));
    setBulkSelection((prev) => ({ ...prev, mode: 'uploaded', ids: unique }));
  };

  useEffect(() => {
    if (typeof onTargetChange !== 'function') return;

    const mode = bulkSelection?.mode || 'page';
    const ids = Array.isArray(bulkSelection?.ids) ? bulkSelection.ids.map(String) : [];
    const filter = bulkSelection?.filter || { query: query.trim(), status: statusFilter };

    onTargetChange({ source: 'users-grid', mode, user_ids: ids, filter });
  }, [bulkSelection, onTargetChange, query, statusFilter]);

  const onRowClick = (row) => {
    setSelectedRow(row);
    setDrawerOpen(true);
  };

  return (
    <div className="rounded-2xl border border-[var(--v2-border)] bg-[var(--v2-surface)]/80 p-5" id="users">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">사용자</p>
          <p className="mt-1 text-sm text-[var(--v2-text)]">
            서버 페이징 + 가상 스크롤 미리보기, 컬럼 세트, 대량 선택.
          </p>
        </div>
        <div className="flex gap-2 text-xs text-[var(--v2-muted)]">
          <button
            type="button"
            className="rounded-full border border-[var(--v2-border)] px-3 py-1 hover:border-[var(--v2-accent)]/40"
            onClick={bulkSelectPage}
          >
            현재 페이지 선택
          </button>
          <button
            type="button"
            className="rounded-full border border-[var(--v2-border)] px-3 py-1 hover:border-[var(--v2-accent)]/40"
            onClick={bulkSelectFilter}
          >
            필터 범위 선택
          </button>
          <button
            type="button"
            className="rounded-full border border-[var(--v2-border)] px-3 py-1 hover:border-[var(--v2-accent)]/40"
            onClick={bulkSelectUploadIds}
          >
            ID 업로드
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div>
          <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">검색</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="외부 사용자 ID 또는 닉네임"
            className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-3 py-2 text-sm text-[var(--v2-text)] placeholder:text-[var(--v2-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--v2-accent)]/40"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">상태</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-3 py-2 text-sm text-[var(--v2-text)] focus:outline-none focus:ring-2 focus:ring-[var(--v2-accent)]/40"
          >
            <option value="">전체</option>
            {statusOptions.map((opt) => (
              <option key={opt} value={opt}>
                {statusLabel(opt)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-2">
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">정렬 기준</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-3 py-2 text-sm text-[var(--v2-text)] focus:outline-none focus:ring-2 focus:ring-[var(--v2-accent)]/40"
            >
              <option value="expires_at">만료일</option>
              <option value="deposit_total">누적 입금</option>
              <option value="external_user_id">외부 사용자 ID</option>
              <option value="nickname">닉네임</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">정렬 방향</label>
            <select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value)}
              className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-3 py-2 text-sm text-[var(--v2-text)] focus:outline-none focus:ring-2 focus:ring-[var(--v2-accent)]/40"
            >
              <option value="asc">오름차순</option>
              <option value="desc">내림차순</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[var(--v2-muted)]">
        <div className="flex items-center gap-2">
          <span>표시 컬럼:</span>
          {columnDefs.map((col) => (
            <label key={col.key} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={visibleColumns.includes(col.key)}
                onChange={() => toggleColumn(col.key)}
              />
              <span>{col.label}</span>
            </label>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label>
            페이지 크기
            <select
              className="ml-2 rounded border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-2 py-1"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {[25, 50, 100, 200].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <span>
            대량 선택: {bulkModeLabel(bulkSelection.mode)} · ID {bulkSelection.ids?.length || 0}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded border border-[var(--v2-border)] px-3 py-1 text-[var(--v2-text)] hover:border-[var(--v2-accent)]/40"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
          >
            이전
          </button>
          <span>{page}페이지 · 총 {total.toLocaleString()}건</span>
          <button
            type="button"
            className="rounded border border-[var(--v2-border)] px-3 py-1 text-[var(--v2-text)] hover:border-[var(--v2-accent)]/40"
            onClick={() => setPage((p) => p + 1)}
            disabled={loading || page * pageSize >= total}
          >
            다음
          </button>
          <button
            type="button"
            className="rounded border border-[var(--v2-border)] px-3 py-1 text-[var(--v2-text)] hover:border-[var(--v2-accent)]/40"
            onClick={fetchUsers}
            disabled={loading}
          >
            새로고침
          </button>
          {loading ? <span className="text-[var(--v2-accent)]">불러오는 중...</span> : null}
          {error ? <span className="text-[var(--v2-warning)]">{String(error)}</span> : null}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)]/60">
        <div className="flex items-center justify-between px-4 py-2 text-xs text-[var(--v2-muted)]">
          <span>
            현재 페이지 {rows.length.toLocaleString()}건 · 가상 스크롤 표시 {visibleRows.length}건
          </span>
          <span className="text-[var(--v2-accent)]">서버 연동 확장 예정(후속 작업)</span>
        </div>
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div
            className="relative h-[440px] overflow-auto"
            onScroll={onScroll}
            role="presentation"
          >
            <div style={{ height: `${totalHeight}px` }}>
              <table
                className="table-fixed min-w-full text-left text-sm"
                style={{ transform: `translateY(${offsetY}px)` }}
              >
                <thead className="sticky top-0 z-10 bg-[var(--v2-surface-2)] text-[var(--v2-muted)]">
                  <tr>
                    {columnDefs
                      .filter((col) => visibleColumns.includes(col.key))
                      .map((col) => (
                        <th key={col.key} className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em]">
                          <button
                            type="button"
                            onClick={() => toggleSort(col.key)}
                            className="flex items-center gap-1 text-[var(--v2-text)] hover:text-[var(--v2-accent)]"
                          >
                            <span>{col.label}</span>
                            {sortBy === col.key ? <span className="text-[var(--v2-muted)]">{sortDir === 'asc' ? '↑' : '↓'}</span> : null}
                          </button>
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--v2-border)]">
                  {visibleRows.map((row) => {
                    const isSelected = selectedRow?.external_user_id === row.external_user_id;
                    const isBulkChecked = (bulkSelection?.ids || []).map(String).includes(String(row.user_id));
                    return (
                      <tr
                        key={row.external_user_id}
                        className={[
                          'cursor-pointer transition hover:bg-[var(--v2-surface)]',
                          isSelected ? 'bg-[var(--v2-surface)]/80 border-l-2 border-[var(--v2-accent)]' : '',
                        ].join(' ')}
                        style={{ height: `${rowHeight}px` }}
                        onClick={() => onRowClick(row)}
                      >
                        {columnDefs
                          .filter((col) => visibleColumns.includes(col.key))
                          .map((col) => {
                            const val = row[col.key];
                            const isNumber = typeof val === 'number';
                            const display = isNumber ? val.toLocaleString() : (val || '').toString();
                            return (
                              <td key={col.key} className="px-4 py-2 text-[var(--v2-text)]">
                                {col.key === 'external_user_id' ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={isBulkChecked}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        toggleBulkSelection(row);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <span className="font-mono text-[var(--v2-accent)]">{display}</span>
                                  </div>
                                ) : (
                                  display
                                )}
                              </td>
                            );
                          })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="border-t border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4 lg:border-l lg:border-t-0">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">상세</p>
              <button
                type="button"
                className="rounded border border-[var(--v2-border)] px-2 py-1 text-xs text-[var(--v2-muted)] hover:border-[var(--v2-accent)]/40"
                onClick={() => setDrawerOpen((v) => !v)}
                disabled={!selectedRow}
              >
                {drawerOpen ? '숨기기' : '보기'}
              </button>
            </div>

            {!selectedRow ? (
              <p className="mt-3 text-sm text-[var(--v2-muted)]">행을 클릭하면 우측 패널에 상세가 표시됩니다.</p>
            ) : !drawerOpen ? (
              <p className="mt-3 text-sm text-[var(--v2-muted)]">상세 패널이 숨김 상태입니다.</p>
            ) : (
              <div className="mt-3 space-y-3 text-sm text-[var(--v2-text)]">
                <div>
                  <div className="text-xs text-[var(--v2-muted)]">외부 사용자 ID</div>
                  <div className="font-mono text-[var(--v2-accent)]">{selectedRow.external_user_id}</div>
                </div>
                <div>
                  <div className="text-xs text-[var(--v2-muted)]">사용자 ID</div>
                  <div className="font-mono">{String(selectedRow.user_id || '')}</div>
                </div>
                <div>
                  <div className="text-xs text-[var(--v2-muted)]">닉네임</div>
                  <div>{selectedRow.nickname || '-'}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-[var(--v2-muted)]">생성일</div>
                    <div>{selectedRow.created_at || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--v2-muted)]">만료일</div>
                    <div>{selectedRow.expires_at || '-'}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-xs text-[var(--v2-muted)]">골드</div>
                    <div>{selectedRow.gold_status || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--v2-muted)]">플래티넘</div>
                    <div>{selectedRow.platinum_status || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--v2-muted)]">다이아</div>
                    <div>{selectedRow.diamond_status || '-'}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-[var(--v2-muted)]">출석(플래티넘)</div>
                    <div>{String(selectedRow.platinum_attendance_days ?? '-')}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--v2-muted)]">총 입금액</div>
                    <div>{typeof selectedRow.deposit_total === 'number' ? selectedRow.deposit_total.toLocaleString() : (selectedRow.deposit_total || '-')}</div>
                  </div>
                </div>
                <p className="text-xs text-[var(--v2-muted)]">
                  참고: 현재 백엔드에 user 상세 조회 API(`GET /api/vault/admin/users/{'{user_id}'}`)가 없어, 리스트 응답 필드만 표시합니다.
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">대량 선택</p>
          <div className="mt-2 space-y-2 text-sm text-[var(--v2-text)]">
            <div className="text-[var(--v2-muted)]">모드: <span className="font-mono">{bulkModeLabel(bulkSelection.mode)}</span></div>
            <div className="text-[var(--v2-muted)]">ID 수: <span className="font-mono">{bulkSelection.ids?.length || 0}</span></div>
            {bulkSelection.mode === 'filter' ? (
              <div className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] p-2 text-xs text-[var(--v2-muted)]">
                <div>검색어: {bulkSelection?.filter?.query || '-'}</div>
                <div>상태: {bulkSelection?.filter?.status ? statusLabel(bulkSelection.filter.status) : '-'}</div>
              </div>
            ) : null}
            {bulkSelection.mode === 'uploaded' ? (
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">user_id 목록 붙여넣기</label>
                <textarea
                  value={uploadedIdsText}
                  onChange={(e) => setUploadedIdsText(e.target.value)}
                  placeholder="예: 123\n456\n789 (공백/쉼표/줄바꿈 구분)"
                  className="h-28 w-full resize-none rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-xs text-[var(--v2-text)] placeholder:text-[var(--v2-muted)]"
                />
                <button
                  type="button"
                  onClick={applyUploadedIds}
                  className="w-full rounded-lg border border-[var(--v2-accent)] bg-[var(--v2-accent)] px-3 py-2 text-xs font-semibold text-black hover:brightness-105"
                >
                  업로드 ID 적용
                </button>
                <p className="text-xs text-[var(--v2-muted)]">현재 업로드 타겟은 user_id 기준으로만 동작합니다.</p>
              </div>
            ) : null}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">저장된 컬럼 세트</p>
          <p className="mt-2 text-sm text-[var(--v2-text)]">컬럼 세트 저장/불러오기 API 연동 예정.</p>
        </div>
      </div>
    </div>
  );
}
