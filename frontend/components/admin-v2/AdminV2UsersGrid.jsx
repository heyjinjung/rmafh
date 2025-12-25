import { useMemo, useState, useCallback, useEffect } from 'react';
import { extractErrorInfo, withIdempotency } from '../../lib/apiClient';
import { pushToast } from './toastBus';
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
  { key: 'telegram_ok', label: '텔레그램' },
  { key: 'review_ok', label: '리뷰' },
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

const sortableKeys = new Set(['created_at', 'expires_at', 'deposit_total', 'external_user_id', 'nickname']);

export default function AdminV2UsersGrid({ adminPassword, basePath, onTargetChange }) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('expires_at');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [selectedRow, setSelectedRow] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [panelMode, setPanelMode] = useState('none'); // none | edit | create
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    external_user_id: '',
    nickname: '',
    joined_date: '',
    deposit_total: '0',
    telegram_ok: false,
    review_ok: false,
  });
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  const resetFormForCreate = () => {
    setForm({
      external_user_id: '',
      nickname: '',
      joined_date: '',
      deposit_total: '0',
      telegram_ok: false,
      review_ok: false,
    });
  };

  const setFormFromRow = (row) => {
    setForm({
      external_user_id: row?.external_user_id || '',
      nickname: row?.nickname || '',
      joined_date: row?.joined_date || '',
      deposit_total: String(row?.deposit_total ?? 0),
      telegram_ok: Boolean(row?.telegram_ok),
      review_ok: Boolean(row?.review_ok),
    });
  };

  const openCreate = () => {
    setSelectedRow(null);
    setPanelMode('create');
    resetFormForCreate();
    setDrawerOpen(true);
  };

  const onRowClick = (row) => {
    setSelectedRow(row);
    setPanelMode('edit');
    setFormFromRow(row);
    setDrawerOpen(true);
  };

  const ensureAuth = () => {
    if (adminPassword) return true;
    pushToast({ ok: false, message: '관리자 비밀번호를 먼저 입력하세요.' });
    return false;
  };

  const submitCreate = async () => {
    if (!ensureAuth()) return;
    const external_user_id = String(form.external_user_id || '').trim();
    if (!external_user_id) {
      pushToast({ ok: false, message: '외부 사용자 ID는 필수입니다.' });
      return;
    }

    const body = {
      external_user_id,
      nickname: form.nickname?.trim() || null,
      joined_date: form.joined_date?.trim() || null,
      deposit_total: Number(form.deposit_total || 0),
      telegram_ok: Boolean(form.telegram_ok),
      review_ok: Boolean(form.review_ok),
    };

    try {
      setSaving(true);
      await apiFetch('/api/vault/admin/users', { method: 'POST', body });
      pushToast({ ok: true, message: '사용자 생성 완료' });
      setDrawerOpen(false);
      setPanelMode('none');
      setSelectedRow(null);
      setQuery(external_user_id);
    } catch (err) {
      const info = extractErrorInfo(err);
      pushToast({ ok: false, message: info.summary || '생성 실패', detail: info.detail || info.code });
    } finally {
      setSaving(false);
    }
  };

  const submitUpdate = async () => {
    if (!ensureAuth()) return;
    if (!selectedRow?.user_id) {
      console.error('selectedRow is null or no user_id');
      return;
    }

    const payload = {};
    const baseNickname = selectedRow?.nickname || '';
    const baseJoined = selectedRow?.joined_date || '';
    const baseDeposit = Number(selectedRow?.deposit_total ?? 0);
    const baseTelegram = Boolean(selectedRow?.telegram_ok);
    const baseReview = Boolean(selectedRow?.review_ok);

    const nextNickname = form.nickname ?? '';
    const nextJoined = (form.joined_date ?? '').trim();
    const nextDeposit = Number(form.deposit_total || 0);
    const nextTelegram = Boolean(form.telegram_ok);
    const nextReview = Boolean(form.review_ok);

    console.log('submitUpdate comparison:', {
      telegram: { base: baseTelegram, next: nextTelegram, changed: nextTelegram !== baseTelegram },
      review: { base: baseReview, next: nextReview, changed: nextReview !== baseReview },
      nickname: { base: baseNickname, next: nextNickname, changed: nextNickname !== baseNickname },
      joined: { base: baseJoined, next: nextJoined, changed: nextJoined !== baseJoined },
      deposit: { base: baseDeposit, next: nextDeposit, changed: Number.isFinite(nextDeposit) && nextDeposit !== baseDeposit },
    });

    if (nextNickname !== baseNickname) payload.nickname = nextNickname;
    if (nextJoined !== baseJoined) payload.joined_date = nextJoined;
    if (Number.isFinite(nextDeposit) && nextDeposit !== baseDeposit) payload.deposit_total = nextDeposit;
    if (nextTelegram !== baseTelegram) payload.telegram_ok = nextTelegram;
    if (nextReview !== baseReview) payload.review_ok = nextReview;

    console.log('submitUpdate payload:', payload, 'has keys:', Object.keys(payload).length);

    if (!Object.keys(payload).length) {
      pushToast({ ok: false, message: '변경된 내용이 없습니다.' });
      return;
    }

    try {
      setSaving(true);
      const response = await apiFetch(`/api/vault/admin/users/${selectedRow.user_id}`, { method: 'PATCH', body: payload });
      console.log('Update response:', response);
      pushToast({ ok: true, message: '저장 완료' });
      setDrawerOpen(false);
      setPanelMode('none');
      setSelectedRow(null);
      fetchUsers();
    } catch (err) {
      console.error('Update error:', err);
      const info = extractErrorInfo(err);
      pushToast({ ok: false, message: info.summary || '저장 실패', detail: info.detail || info.code });
    } finally {
      setSaving(false);
    }
  };

  const submitDelete = async () => {
    if (!ensureAuth()) return;
    if (!selectedRow?.user_id) return;

    const ok = typeof window !== 'undefined'
      ? window.confirm(`정말 삭제할까요?\n외부 사용자 ID: ${selectedRow.external_user_id}\nuser_id: ${selectedRow.user_id}`)
      : false;
    if (!ok) return;

    try {
      setSaving(true);
      await apiFetch(`/api/vault/admin/users/${selectedRow.user_id}`, { method: 'DELETE' });
      pushToast({ ok: true, message: '삭제 완료' });
      setDrawerOpen(false);
      setPanelMode('none');
      setSelectedRow(null);
      fetchUsers();
    } catch (err) {
      const info = extractErrorInfo(err);
      pushToast({ ok: false, message: info.summary || '삭제 실패', detail: info.detail || info.code });
    } finally {
      setSaving(false);
    }
  };

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

  useEffect(() => {
    if (typeof onTargetChange !== 'function') return;
    if (!selectedRow?.user_id) {
      onTargetChange(null);
      return;
    }
    onTargetChange({ source: 'users-grid', mode: 'page', user_ids: [String(selectedRow.user_id)] });
  }, [onTargetChange, selectedRow]);

  return (
    <div className="rounded-2xl border border-[var(--v2-border)] bg-[var(--v2-surface)]/80 p-5" id="users">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">사용자</p>
          <p className="mt-1 text-sm text-[var(--v2-text)]">검색/정렬 후 클릭해서 편집 대상으로 선택하세요.</p>
        </div>
        <button
          type="button"
          className="rounded-full border border-[var(--v2-border)] px-4 py-2 text-xs text-[var(--v2-text)] hover:border-[var(--v2-accent)]/40"
          onClick={openCreate}
        >
          사용자 생성
        </button>
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
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div
            className="relative h-[440px] overflow-auto"
            role="presentation"
          >
            <table className="table-fixed min-w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-[var(--v2-surface-2)] text-[var(--v2-muted)]">
                  <tr>
                    {columnDefs.map((col) => (
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
                  {rows.map((row) => {
                    const isSelected = selectedRow?.external_user_id === row.external_user_id;
                    return (
                      <tr
                        key={row.external_user_id}
                        className={[
                          'cursor-pointer transition hover:bg-[var(--v2-surface)]',
                          isSelected ? 'bg-[var(--v2-surface)]/80 border-l-2 border-[var(--v2-accent)]' : '',
                        ].join(' ')}
                        onClick={() => onRowClick(row)}
                      >
                        {columnDefs.map((col) => {
                            const val = row[col.key];
                            let display = '';
                            if (col.key === 'created_at' || col.key === 'expires_at') {
                              // ISO8601 → YYYY-MM-DD
                              display = val ? val.slice(0, 10) : '';
                            } else if (col.key === 'telegram_ok' || col.key === 'review_ok') {
                              // 체크마크 또는 공백
                              display = val ? '✓' : '';
                            } else if (typeof val === 'number') {
                              display = val.toLocaleString();
                            } else {
                              display = (val || '').toString();
                            }
                            return (
                              <td key={col.key} className="px-4 py-2 text-[var(--v2-text)]">
                                {col.key === 'external_user_id' ? <span className="font-mono text-[var(--v2-accent)]">{display}</span> : display}
                              </td>
                            );
                          })}
                      </tr>
                    );
                  })}
                </tbody>
            </table>
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
              panelMode === 'create' ? (
                <div className="mt-3 space-y-3 text-sm text-[var(--v2-text)]">
                  <div>
                    <div className="text-xs text-[var(--v2-muted)]">외부 사용자 ID (필수)</div>
                    <input
                      value={form.external_user_id}
                      onChange={(e) => setForm((prev) => ({ ...prev, external_user_id: e.target.value }))}
                      placeholder="예: 12345"
                      className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)] placeholder:text-[var(--v2-muted)]"
                    />
                  </div>

                  <div>
                    <div className="text-xs text-[var(--v2-muted)]">닉네임</div>
                    <input
                      value={form.nickname}
                      onChange={(e) => setForm((prev) => ({ ...prev, nickname: e.target.value }))}
                      placeholder="(선택)"
                      className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)] placeholder:text-[var(--v2-muted)]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-[var(--v2-muted)]">가입일 (YYYY-MM-DD)</div>
                      <input
                        value={form.joined_date}
                        onChange={(e) => setForm((prev) => ({ ...prev, joined_date: e.target.value }))}
                        placeholder="2025-12-25"
                        className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)] placeholder:text-[var(--v2-muted)]"
                      />
                    </div>
                    <div>
                      <div className="text-xs text-[var(--v2-muted)]">누적 입금</div>
                      <input
                        inputMode="numeric"
                        value={form.deposit_total}
                        onChange={(e) => setForm((prev) => ({ ...prev, deposit_total: e.target.value }))}
                        className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(form.telegram_ok)}
                        onChange={(e) => setForm((prev) => ({ ...prev, telegram_ok: e.target.checked }))}
                      />
                      <span>텔레그램 인증</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(form.review_ok)}
                        onChange={(e) => setForm((prev) => ({ ...prev, review_ok: e.target.checked }))}
                      />
                      <span>리뷰 승인</span>
                    </label>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="flex-1 rounded-lg border border-[var(--v2-accent)] bg-[var(--v2-accent)] px-3 py-2 text-sm font-semibold text-black hover:brightness-105 disabled:opacity-50"
                      onClick={submitCreate}
                      disabled={saving}
                    >
                      생성
                    </button>
                    <button
                      type="button"
                      className="flex-1 rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)] hover:border-[var(--v2-accent)]/40 disabled:opacity-50"
                      onClick={() => {
                        setDrawerOpen(false);
                        setPanelMode('none');
                      }}
                      disabled={saving}
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-[var(--v2-muted)]">행을 클릭하면 우측 패널에서 편집할 수 있습니다.</p>
              )
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
                  <input
                    value={form.nickname}
                    onChange={(e) => setForm((prev) => ({ ...prev, nickname: e.target.value }))}
                    className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-[var(--v2-muted)]">가입일 (YYYY-MM-DD)</div>
                    <input
                      value={form.joined_date}
                      onChange={(e) => setForm((prev) => ({ ...prev, joined_date: e.target.value }))}
                      placeholder={selectedRow.joined_date || '2025-12-25'}
                      className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)] placeholder:text-[var(--v2-muted)]"
                    />
                  </div>
                  <div>
                    <div className="text-xs text-[var(--v2-muted)]">누적 입금</div>
                    <input
                      inputMode="numeric"
                      value={form.deposit_total}
                      onChange={(e) => setForm((prev) => ({ ...prev, deposit_total: e.target.value }))}
                      className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(form.telegram_ok)}
                      onChange={(e) => setForm((prev) => ({ ...prev, telegram_ok: e.target.checked }))}
                    />
                    <span>텔레그램 인증</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(form.review_ok)}
                      onChange={(e) => setForm((prev) => ({ ...prev, review_ok: e.target.checked }))}
                    />
                    <span>리뷰 승인</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-[var(--v2-muted)]">생성일</div>
                    <div>{selectedRow.created_at ? selectedRow.created_at.slice(0, 10) : '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--v2-muted)]">만료일</div>
                    <div>{selectedRow.expires_at ? selectedRow.expires_at.slice(0, 10) : '-'}</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    className="flex-1 rounded-lg border border-[var(--v2-accent)] bg-[var(--v2-accent)] px-3 py-2 text-sm font-semibold text-black hover:brightness-105 disabled:opacity-50"
                    onClick={submitUpdate}
                    disabled={saving}
                  >
                    저장
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)] hover:border-[var(--v2-warning)]/50 disabled:opacity-50"
                    onClick={submitDelete}
                    disabled={saving}
                  >
                    삭제
                  </button>
                </div>

                <p className="text-xs text-[var(--v2-muted)]">저장은 user_admin_snapshot(닉네임/가입일/입금/텔레그램/리뷰)을 수정합니다.</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
