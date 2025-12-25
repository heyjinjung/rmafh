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
  const [extending, setExtending] = useState(false);
  const [expiryExtendDays, setExpiryExtendDays] = useState(1);
  const [expiryReason, setExpiryReason] = useState('OPS');
  const [depositSaving, setDepositSaving] = useState(false);
  const [platinumDepositDone, setPlatinumDepositDone] = useState(false);
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
    console.log('setFormFromRow called with row:', row);
    const newForm = {
      external_user_id: row?.external_user_id || '',
      nickname: row?.nickname || '',
      joined_date: row?.joined_date || '',
      deposit_total: String(row?.deposit_total ?? 0),
      telegram_ok: Boolean(row?.telegram_ok),
      review_ok: Boolean(row?.review_ok),
    };
    console.log('setFormFromRow new form state:', newForm);
    setForm(newForm);
    setExpiryExtendDays(1);
    setExpiryReason('OPS');
    setPlatinumDepositDone(Boolean(row?.platinum_deposit_done) || Number(row?.deposit_total || 0) >= 150000);
  };

  const openCreate = () => {
    setSelectedRow(null);
    setPanelMode('create');
    resetFormForCreate();
    setDrawerOpen(true);
  };

  const onRowClick = (row) => {
    console.log('onRowClick called with row:', row);
    setSelectedRow(row);
    setPanelMode('edit');
    setFormFromRow(row);
    setDrawerOpen(true);
    console.log('onRowClick completed: selectedRow updated');
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
    console.log('submitUpdate start - adminPassword:', !!adminPassword, 'selectedRow:', selectedRow?.user_id);
    if (!ensureAuth()) {
      console.error('ensureAuth failed - returning');
      return;
    }
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
      const depositReached = Number(form.deposit_total || 0) >= 150000;
      if (depositReached && !platinumDepositDone) {
        try {
          await apiFetch(`/api/vault/admin/users/${selectedRow.user_id}/vault/deposit`, {
            method: 'POST',
            body: { platinum_deposit_done: true, diamond_deposit_current: Number(form.deposit_total || 0) },
          });
          setPlatinumDepositDone(true);
        } catch (e) {
          console.error('Auto deposit unlock failed', e);
        }
      }
      setDrawerOpen(false);
      setPanelMode('none');
      setSelectedRow(null);
      fetchUsers();
    } catch (err) {
      // 추가 디버깅: 서버 반환 payload/parsed 정보를 모두 찍어서 400 원인 파악
      console.error('Update error:', err);
      console.error('Update error payload:', err?.payload);
      try {
        console.error('Update error payload (stringified):', JSON.stringify(err?.payload));
      } catch (_e) {
        console.error('Update error payload stringified failed');
      }
      console.error('Update error parsed:', err?.parsed);
      const info = extractErrorInfo(err);
      pushToast({ ok: false, message: info.summary || '저장 실패', detail: info.detail || info.code });
    } finally {
      setSaving(false);
    }
  };

  const makeRequestId = () => `extend-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

  const submitExtendExpiry = async () => {
    if (!ensureAuth()) return;
    if (!selectedRow?.user_id) return;

    const extendHours = Math.trunc(Number(expiryExtendDays) * 24);
    if (!Number.isFinite(extendHours) || extendHours < 1 || extendHours > 72) {
      pushToast({ ok: false, message: '연장 시간은 1~72시간(최대 3일)까지 입력하세요.' });
      return;
    }

    const reason = String(expiryReason || '').toUpperCase();
    if (!['OPS', 'PROMO', 'ADMIN'].includes(reason)) {
      pushToast({ ok: false, message: '이유는 OPS/PROMO/ADMIN 중 하나여야 합니다.' });
      return;
    }

    const requestId = makeRequestId();
    const payload = {
      request_id: requestId,
      scope: 'USER_IDS',
      user_ids: [Number(selectedRow.user_id)],
      extend_hours: extendHours,
      reason,
      shadow: false,
    };

    try {
      setExtending(true);
      const res = await apiFetch('/api/vault/extend-expiry', { method: 'POST', body: payload, idempotencyKey: requestId });
      const newExpiresAt = res?.data?.new_expires_at || res?.data?.expires_at;
      pushToast({ ok: true, message: '만료일을 연장했습니다.', detail: newExpiresAt ? `새 만료일: ${newExpiresAt.slice(0, 10)}` : undefined });
      if (newExpiresAt) {
        setSelectedRow((prev) => (prev ? { ...prev, expires_at: newExpiresAt } : prev));
      }
      fetchUsers();
    } catch (err) {
      const info = extractErrorInfo(err);
      pushToast({ ok: false, message: info.summary || '만료일 연장 실패', detail: info.detail || info.code });
    } finally {
      setExtending(false);
    }
  };

  const submitDepositFlag = async (nextValue, { silent } = {}) => {
    if (!ensureAuth()) return;
    if (!selectedRow?.user_id) return;

    const requestId = makeRequestId();
    const body = {
      platinum_deposit_done: Boolean(nextValue),
      diamond_deposit_current: Number(form.deposit_total || 0),
    };

    try {
      setDepositSaving(true);
      const res = await apiFetch(`/api/vault/admin/users/${selectedRow.user_id}/vault/deposit`, { method: 'POST', body, idempotencyKey: requestId });
      const data = res?.data || {};
      const nextDone = Boolean(data.platinum_deposit_done ?? nextValue);
      setPlatinumDepositDone(nextDone);
      setSelectedRow((prev) => (prev ? {
        ...prev,
        platinum_deposit_done: nextDone,
        diamond_deposit_current: data.diamond_deposit_current ?? prev.diamond_deposit_current,
        platinum_status: data.platinum_status ?? prev.platinum_status,
        diamond_status: data.diamond_status ?? prev.diamond_status,
      } : prev));
      if (!silent) {
        pushToast({ ok: true, message: nextDone ? '플레티넘 입금 확인 완료' : '플레티넘 입금 해제됨', detail: data.platinum_status });
      }
      fetchUsers();
    } catch (err) {
      const info = extractErrorInfo(err);
      pushToast({ ok: false, message: info.summary || '입금 상태 업데이트 실패', detail: info.detail || info.code });
    } finally {
      setDepositSaving(false);
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
                    onChange={(e) => {
                      console.log('nickname input changed:', e.target.value);
                      setForm((prev) => ({ ...prev, nickname: e.target.value }));
                    }}
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
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--v2-muted)]">
                      <button
                        type="button"
                        className="rounded border border-[var(--v2-border)] px-2 py-1 text-[var(--v2-text)] hover:border-[var(--v2-accent)]/40"
                        onClick={() => setForm((prev) => ({ ...prev, deposit_total: '150000' }))}
                      >
                        150,000원으로 설정
                      </button>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ background: platinumDepositDone ? 'var(--v2-accent)' : 'var(--v2-border)' }} />
                        {platinumDepositDone ? '플레티넘 입금 확인됨' : '미확인'}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(form.telegram_ok)}
                      onChange={(e) => {
                        console.log('telegram_ok checkbox changed:', e.target.checked);
                        setForm((prev) => ({ ...prev, telegram_ok: e.target.checked }));
                      }}
                    />
                    <span>텔레그램 인증</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(form.review_ok)}
                      onChange={(e) => {
                        console.log('review_ok checkbox changed:', e.target.checked);
                        setForm((prev) => ({ ...prev, review_ok: e.target.checked }));
                      }}
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

                <div className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)]/60 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs uppercase tracking-[0.16em] text-[var(--v2-muted)]">만료일 연장</div>
                    <div className="text-xs text-[var(--v2-muted)]">최대 +3일</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="number"
                      min="1"
                      max="3"
                      value={expiryExtendDays}
                      onChange={(e) => setExpiryExtendDays(Number(e.target.value) || 1)}
                      className="w-20 rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-3 py-2 text-sm text-[var(--v2-text)]"
                    />
                    <select
                      value={expiryReason}
                      onChange={(e) => setExpiryReason(e.target.value)}
                      className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-3 py-2 text-sm text-[var(--v2-text)]"
                    >
                      <option value="OPS">운영</option>
                      <option value="PROMO">프로모션</option>
                      <option value="ADMIN">관리자</option>
                    </select>
                    <button
                      type="button"
                      onClick={submitExtendExpiry}
                      disabled={extending || saving}
                      className="rounded-lg border border-[var(--v2-accent)] bg-[var(--v2-accent)] px-3 py-2 text-sm font-semibold text-black hover:brightness-105 disabled:opacity-50"
                    >
                      연장
                    </button>
                  </div>
                  <p className="text-xs text-[var(--v2-muted)]">선택한 사용자에게만 적용됩니다. (1~72시간, 최대 3일)</p>
                </div>

                <div className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)]/60 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs uppercase tracking-[0.16em] text-[var(--v2-muted)]">플레티넘 입금 (15만)</div>
                    <div className="text-xs text-[var(--v2-muted)]">자동/수동 해금</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => submitDepositFlag(true)}
                      disabled={depositSaving || saving}
                      className="rounded-lg border border-[var(--v2-accent)] bg-[var(--v2-accent)] px-3 py-2 text-sm font-semibold text-black hover:brightness-105 disabled:opacity-50"
                    >
                      플레티넘 해금
                    </button>
                    <button
                      type="button"
                      onClick={() => submitDepositFlag(false)}
                      disabled={depositSaving || saving}
                      className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)] hover:border-[var(--v2-warning)]/50 disabled:opacity-50"
                    >
                      해금 해제
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setForm((prev) => ({ ...prev, deposit_total: '150000' }));
                        submitDepositFlag(true);
                      }}
                      disabled={depositSaving || saving}
                      className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-3 py-2 text-sm text-[var(--v2-text)] hover:border-[var(--v2-accent)]/50 disabled:opacity-50"
                    >
                      150,000 + 해금
                    </button>
                  </div>
                  <p className="text-xs text-[var(--v2-muted)]">누적 입금이 150,000원 이상이면 자동 확인됩니다. 부족한 경우 버튼으로 바로 해금할 수 있습니다.</p>
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
