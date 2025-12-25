import { useMemo, useState, useCallback, useEffect } from 'react';
import { withIdempotency } from '../../lib/apiClient';

const rowHeight = 48;
const viewportHeight = 440;
const statusOptions = ['LOCKED', 'UNLOCKED', 'CLAIMED', 'EXPIRED'];
const columnDefs = [
  { key: 'external_user_id', label: 'external_user_id' },
  { key: 'nickname', label: 'nickname' },
  { key: 'created_at', label: 'created_at' },
  { key: 'gold_status', label: 'gold_status' },
  { key: 'platinum_status', label: 'platinum_status' },
  { key: 'diamond_status', label: 'diamond_status' },
  { key: 'platinum_attendance_days', label: 'attendance' },
  { key: 'deposit_total', label: 'deposit_total' },
  { key: 'expires_at', label: 'expires_at' },
];

const sortableKeys = new Set(['created_at', 'expires_at', 'deposit_total', 'external_user_id', 'nickname']);

const storageKeys = {
  columns: 'adminV2UserColumns',
  bulk: 'adminV2UserBulkSelection',
};

export default function AdminV2UsersGrid({ adminPassword, basePath }) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('expires_at');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [scrollTop, setScrollTop] = useState(0);
  const [selectedRow, setSelectedRow] = useState(null);
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
      if (ids.has(row.user_id)) {
        ids.delete(row.user_id);
      } else {
        ids.add(row.user_id);
      }
      return { ...prev, ids: Array.from(ids) };
    });
  };

  const bulkSelectPage = () => {
    setBulkSelection((prev) => ({ ...prev, mode: 'page', ids: rows.map((r) => r.user_id) }));
  };

  const bulkSelectFilter = () => {
    setBulkSelection((prev) => ({ ...prev, mode: 'filter', ids: [] }));
  };

  const bulkSelectUploadIds = () => {
    // Placeholder hook: UI for uploading IDs can populate here
    setBulkSelection((prev) => ({ ...prev, mode: 'uploaded', ids: prev.ids || [] }));
  };

  return (
    <div className="rounded-2xl border border-[var(--v2-border)] bg-[var(--v2-surface)]/80 p-5" id="users">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Users</p>
          <p className="mt-1 text-sm text-[var(--v2-text)]">
            Server-driven paging with virtual scroll preview, column sets, and bulk selection.
          </p>
        </div>
        <div className="flex gap-2 text-xs text-[var(--v2-muted)]">
          <button
            type="button"
            className="rounded-full border border-[var(--v2-border)] px-3 py-1 hover:border-[var(--v2-accent)]/40"
            onClick={bulkSelectPage}
          >
            Select Page
          </button>
          <button
            type="button"
            className="rounded-full border border-[var(--v2-border)] px-3 py-1 hover:border-[var(--v2-accent)]/40"
            onClick={bulkSelectFilter}
          >
            Select Filter Scope
          </button>
          <button
            type="button"
            className="rounded-full border border-[var(--v2-border)] px-3 py-1 hover:border-[var(--v2-accent)]/40"
            onClick={bulkSelectUploadIds}
          >
            Upload IDs
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div>
          <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Query</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="external_user_id or nickname"
            className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-3 py-2 text-sm text-[var(--v2-text)] placeholder:text-[var(--v2-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--v2-accent)]/40"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-3 py-2 text-sm text-[var(--v2-text)] focus:outline-none focus:ring-2 focus:ring-[var(--v2-accent)]/40"
          >
            <option value="">All</option>
            {statusOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-2">
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Sort</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-3 py-2 text-sm text-[var(--v2-text)] focus:outline-none focus:ring-2 focus:ring-[var(--v2-accent)]/40"
            >
              <option value="expires_at">expires_at</option>
              <option value="deposit_total">deposit_total</option>
              <option value="external_user_id">external_user_id</option>
              <option value="nickname">nickname</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Direction</label>
            <select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value)}
              className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-3 py-2 text-sm text-[var(--v2-text)] focus:outline-none focus:ring-2 focus:ring-[var(--v2-accent)]/40"
            >
              <option value="asc">ASC</option>
              <option value="desc">DESC</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[var(--v2-muted)]">
        <div className="flex items-center gap-2">
          <span>Columns:</span>
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
            Page Size
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
            Bulk: {bulkSelection.mode} · ids {bulkSelection.ids?.length || 0}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded border border-[var(--v2-border)] px-3 py-1 text-[var(--v2-text)] hover:border-[var(--v2-accent)]/40"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
          >
            Prev
          </button>
          <span>Page {page} · Total {total.toLocaleString()}</span>
          <button
            type="button"
            className="rounded border border-[var(--v2-border)] px-3 py-1 text-[var(--v2-text)] hover:border-[var(--v2-accent)]/40"
            onClick={() => setPage((p) => p + 1)}
            disabled={loading || page * pageSize >= total}
          >
            Next
          </button>
          <button
            type="button"
            className="rounded border border-[var(--v2-border)] px-3 py-1 text-[var(--v2-text)] hover:border-[var(--v2-accent)]/40"
            onClick={fetchUsers}
            disabled={loading}
          >
            Refresh
          </button>
          {loading ? <span className="text-[var(--v2-accent)]">Loading...</span> : null}
          {error ? <span className="text-[var(--v2-warning)]">{String(error)}</span> : null}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)]/60">
        <div className="flex items-center justify-between px-4 py-2 text-xs text-[var(--v2-muted)]">
          <span>
            Showing {rows.length.toLocaleString()} rows (server page) · Virtualized {visibleRows.length} visible
          </span>
          <span className="text-[var(--v2-accent)]">Server-side hooks pending API wiring</span>
        </div>
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
                  return (
                    <tr
                      key={row.external_user_id}
                      className={[
                        'cursor-pointer transition hover:bg-[var(--v2-surface)]',
                        isSelected ? 'bg-[var(--v2-surface)]/80 border-l-2 border-[var(--v2-accent)]' : '',
                      ].join(' ')}
                      style={{ height: `${rowHeight}px` }}
                      onClick={() => setSelectedRow(row)}
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
                                <span className="font-mono text-[var(--v2-accent)]">{display}</span>
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
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Selection</p>
          {selectedRow ? (
            <div className="mt-2 space-y-1 text-sm text-[var(--v2-text)]">
              <div className="font-mono text-[var(--v2-accent)]">{selectedRow.external_user_id}</div>
              <div>{selectedRow.nickname}</div>
              <div className="text-[var(--v2-muted)]">Status: {selectedRow.gold_status}</div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-[var(--v2-muted)]">행을 클릭하면 상세가 여기에 표시됩니다.</p>
          )}
        </div>
        <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Bulk Select</p>
          <p className="mt-2 text-sm text-[var(--v2-text)]">현재 페이지/필터 전체/업로드 ID 기반 선택 플로우 자리.</p>
        </div>
        <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Saved Column Sets</p>
          <p className="mt-2 text-sm text-[var(--v2-text)]">컬럼 세트 저장/불러오기 API 연동 예정.</p>
        </div>
      </div>
    </div>
  );
}
