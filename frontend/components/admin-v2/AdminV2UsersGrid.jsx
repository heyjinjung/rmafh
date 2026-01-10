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

const sortableKeys = new Set(['created_at', 'expires_at', 'external_user_id', 'nickname']);

const Switch = ({ checked, onChange, disabled, activeColor = 'var(--v2-accent)' }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={() => !disabled && onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${checked ? '' : 'bg-[var(--v2-border)]'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    style={{ backgroundColor: checked ? activeColor : undefined }}
  >
    <span
      aria-hidden="true"
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'
        }`}
    />
  </button>
);

export default function AdminV2UsersGrid({ adminPassword, basePath, onTargetChange }) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('expires_at');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [selectedRow, setSelectedRow] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [panelMode, setPanelMode] = useState('none'); // none | edit | create
  const [saving, setSaving] = useState(false);
  const [extending, setExtending] = useState(false);
  const [expiryExtendDays, setExpiryExtendDays] = useState(1);
  const [expiryReason, setExpiryReason] = useState('OPS');
  const [form, setForm] = useState({
    external_user_id: '',
    nickname: '',
    joined_date: '',
  });
  const [goldStatus, setGoldStatus] = useState('LOCKED');
  const [goldMission1, setGoldMission1] = useState(false);
  const [goldMission2, setGoldMission2] = useState(false);
  const [goldMission3, setGoldMission3] = useState(false);
  const [platinumStatus, setPlatinumStatus] = useState('LOCKED');
  const [platinumMission1, setPlatinumMission1] = useState(false);
  const [platinumMission2, setPlatinumMission2] = useState(false);
  const [diamondStatus, setDiamondStatus] = useState('LOCKED');
  const [diamondMission1, setDiamondMission1] = useState(false);
  const [diamondMission2, setDiamondMission2] = useState(false);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

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
    });
  };

  const setFormFromRow = (row) => {
    console.log('setFormFromRow called with row:', row);
    const newForm = {
      external_user_id: row?.external_user_id || '',
      nickname: row?.nickname || '',
      joined_date: row?.joined_date || '',
    };
    console.log('setFormFromRow new form state:', newForm);
    setForm(newForm);
    setExpiryExtendDays(1);
    setExpiryReason('OPS');
    setGoldStatus(row?.gold_status || 'LOCKED');
    setGoldMission1(Boolean(row?.gold_mission_1_done));
    setGoldMission2(Boolean(row?.gold_mission_2_done));
    setGoldMission3(Boolean(row?.gold_mission_3_done));
    setPlatinumStatus(row?.platinum_status || 'LOCKED');
    setPlatinumMission1(Boolean(row?.platinum_mission_1_done));
    setPlatinumMission2(Boolean(row?.platinum_mission_2_done));
    setDiamondStatus(row?.diamond_status || 'LOCKED');
    setDiamondMission1(Boolean(row?.diamond_mission_1_done));
    setDiamondMission2(Boolean(row?.diamond_mission_2_done));
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

    const nextNickname = form.nickname ?? '';
    const nextJoined = (form.joined_date ?? '').trim();
    const nextDeposit = Number(form.deposit_total || 0);

    console.log('submitUpdate comparison:', {
      nickname: { base: baseNickname, next: nextNickname, changed: nextNickname !== baseNickname },
      joined: { base: baseJoined, next: nextJoined, changed: nextJoined !== baseJoined },
      deposit: { base: baseDeposit, next: nextDeposit, changed: Number.isFinite(nextDeposit) && nextDeposit !== baseDeposit },
    });

    if (nextNickname !== baseNickname) payload.nickname = nextNickname;
    if (nextJoined !== baseJoined) payload.joined_date = nextJoined;
    if (Number.isFinite(nextDeposit) && nextDeposit !== baseDeposit) payload.deposit_total = nextDeposit;

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

  const submitGoldMissions = async (updates = {}) => {
    if (!ensureAuth()) return;
    if (!selectedRow?.user_id) return;

    const body = { ...updates };
    if (!Object.keys(body).length) return;

    try {
      setSaving(true);
      const res = await apiFetch(`/api/vault/admin/users/${selectedRow.user_id}/vault/gold-missions`, {
        method: 'POST',
        body,
        idempotencyKey: makeRequestId(),
      });
      const data = res?.data || {}; // Proxy returns { data: ... } or just body depending on implementation. Inspecting proxy: it returns body directly.
      // Actually AdminV2UsersGrid uses `withIdempotency` which wraps the response in { data, ... } or throws error.
      // My proxy returns res.json(body), so `apiFetch` (withIdempotency) will see that as `data`.
      // Let's verify `withIdempotency` implementation if possible, but standard is `data` property.

      const newM1 = Boolean(data.gold_mission_1_done ?? goldMission1);
      const newM2 = Boolean(data.gold_mission_2_done ?? goldMission2);
      const newM3 = Boolean(data.gold_mission_3_done ?? goldMission3);
      const newStatus = data.gold_status ?? goldStatus;

      setGoldMission1(newM1);
      setGoldMission2(newM2);
      setGoldMission3(newM3);
      setGoldStatus(newStatus);

      setSelectedRow((prev) => (prev ? {
        ...prev,
        gold_mission_1_done: newM1,
        gold_mission_2_done: newM2,
        gold_mission_3_done: newM3,
        gold_status: newStatus,
        expires_at: data.expires_at || prev.expires_at,
      } : prev));

      pushToast({ ok: true, message: '미션 상태 업데이트', detail: `상태: ${newStatus}` });
      fetchUsers();
    } catch (err) {
      const info = extractErrorInfo(err);
      pushToast({ ok: false, message: info.summary || '미션 업데이트 실패', detail: info.detail });
    } finally {
      setSaving(false);
    }
  };

  const submitPlatinumMissions = async (updates) => {
    if (!ensureAuth()) return;
    if (!selectedRow?.user_id) return;

    const body = { ...updates };
    if (!Object.keys(body).length) return;

    try {
      setSaving(true);
      const res = await apiFetch(`/api/vault/admin/users/${selectedRow.user_id}/vault/platinum-missions`, {
        method: 'POST',
        body,
        idempotencyKey: makeRequestId(),
      });
      const data = res?.data || {};

      const newM1 = Boolean(data.platinum_mission_1_done ?? platinumMission1);
      const newM2 = Boolean(data.platinum_mission_2_done ?? platinumMission2);
      const newStatus = data.platinum_status ?? platinumStatus;

      setPlatinumMission1(newM1);
      setPlatinumMission2(newM2);
      setPlatinumStatus(newStatus);

      setSelectedRow((prev) => (prev ? {
        ...prev,
        platinum_mission_1_done: newM1,
        platinum_mission_2_done: newM2,
        platinum_status: newStatus,
        expires_at: data.expires_at || prev.expires_at,
      } : prev));

      pushToast({ ok: true, message: '플래티넘 미션 업데이트', detail: `상태: ${newStatus}` });
      fetchUsers();
    } catch (err) {
      const info = extractErrorInfo(err);
      pushToast({ ok: false, message: info.summary || '플래티넘 미션 업데이트 실패', detail: info.detail });
    } finally {
      setSaving(false);
    }
  };

  const submitDiamondMissions = async (updates) => {
    if (!ensureAuth()) return;
    if (!selectedRow?.user_id) return;

    const body = { ...updates };
    if (!Object.keys(body).length) return;

    try {
      setSaving(true);
      const res = await apiFetch(`/api/vault/admin/users/${selectedRow.user_id}/vault/diamond-missions`, {
        method: 'POST',
        body,
        idempotencyKey: makeRequestId(),
      });
      const data = res?.data || {};

      const newM1 = Boolean(data.diamond_mission_1_done ?? diamondMission1);
      const newM2 = Boolean(data.diamond_mission_2_done ?? diamondMission2);
      const newStatus = data.diamond_status ?? diamondStatus;

      setDiamondMission1(newM1);
      setDiamondMission2(newM2);
      setDiamondStatus(newStatus);

      setSelectedRow((prev) => (prev ? {
        ...prev,
        diamond_mission_1_done: newM1,
        diamond_mission_2_done: newM2,
        diamond_status: newStatus,
        expires_at: data.expires_at || prev.expires_at,
      } : prev));

      pushToast({ ok: true, message: '다이아 미션 업데이트', detail: `상태: ${newStatus}` });
      fetchUsers();
    } catch (err) {
      const info = extractErrorInfo(err);
      pushToast({ ok: false, message: info.summary || '다이아 미션 업데이트 실패', detail: info.detail });
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

  const deleteAllUsers = async () => {
    if (!ensureAuth()) return;
    if (!rows.length) {
      pushToast({ ok: false, message: '삭제할 사용자가 없습니다.' });
      return;
    }

    const ok = typeof window !== 'undefined'
      ? window.confirm(`현재 필터/페이지의 ${rows.length}명을 삭제합니다. 이 작업은 되돌릴 수 없습니다.`)
      : false;
    if (!ok) return;

    try {
      setBulkDeleting(true);
      let success = 0;
      let failed = 0;
      for (const row of rows) {
        try {
          await apiFetch(`/api/vault/admin/users/${row.user_id}`, { method: 'DELETE' });
          success += 1;
          if (selectedRow?.user_id === row.user_id) {
            setSelectedRow(null);
            setDrawerOpen(false);
            setPanelMode('none');
          }
        } catch (err) {
          failed += 1;
          console.error('bulk delete failed for', row.user_id, err);
        }
      }
      pushToast({ ok: failed === 0, message: `삭제 완료 ${success}건${failed ? `, 실패 ${failed}건` : ''}` });
      fetchUsers();
    } finally {
      setBulkDeleting(false);
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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full border border-[var(--v2-border)] px-4 py-2 text-xs text-[var(--v2-text)] hover:border-[var(--v2-accent)]/40"
            onClick={openCreate}
            disabled={bulkDeleting || loading}
          >
            사용자 생성
          </button>
          <button
            type="button"
            className="rounded-full border border-[var(--v2-border)] px-4 py-2 text-xs text-[var(--v2-warning)] hover:border-[var(--v2-warning)]/60 disabled:opacity-50"
            onClick={deleteAllUsers}
            disabled={bulkDeleting || loading || rows.length === 0}
          >
            전체 삭제
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
          <button
            type="button"
            className="rounded border border-[var(--v2-border)] px-3 py-1 text-[var(--v2-text)] hover:border-[var(--v2-accent)]/40 disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
          >
            이전
          </button>
          <span>{page}페이지 · 총 {total.toLocaleString()}건</span>
          <button
            type="button"
            className="rounded border border-[var(--v2-border)] px-3 py-1 text-[var(--v2-text)] hover:border-[var(--v2-accent)]/40 disabled:opacity-50"
            onClick={() => setPage((p) => p + 1)}
            disabled={loading || page * pageSize >= total}
          >
            다음
          </button>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="rounded border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-2 py-1 text-[var(--v2-text)] focus:outline-none focus:border-[var(--v2-accent)]/40"
          >
            <option value={10}>10개</option>
            <option value={20}>20개</option>
            <option value={30}>30개</option>
            <option value={50}>50개</option>
            <option value={100}>100개</option>
          </select>
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
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px] h-[800px]">
          <div
            className="relative overflow-auto"
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

          <aside className="border-t border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4 lg:border-l lg:border-t-0 flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between shrink-0 mb-4">
              <p className="font-ibm text-lg font-bold text-[var(--v2-text)]">
                사용자 상세
              </p>
              <button
                type="button"
                className="rounded border border-[var(--v2-border)] px-3 py-1 text-xs text-[var(--v2-muted)] hover:border-[var(--v2-accent)]/40 hover:text-[var(--v2-text)] transition-colors"
                onClick={() => setDrawerOpen((v) => !v)}
                disabled={!selectedRow}
              >
                {drawerOpen ? '닫기' : '열기'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-6">
              {!selectedRow ? (
                panelMode === 'create' ? (
                  <div className="space-y-4 text-sm text-[var(--v2-text)]">
                    <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface)] p-4 space-y-4">
                      <h3 className="text-xs uppercase tracking-wider text-[var(--v2-muted)] font-semibold">기본 정보</h3>
                      <div>
                        <div className="text-xs text-[var(--v2-muted)] mb-1">외부 사용자 ID (필수)</div>
                        <input
                          value={form.external_user_id}
                          onChange={(e) => setForm((prev) => ({ ...prev, external_user_id: e.target.value }))}
                          placeholder="예: 12345"
                          className="w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-3 py-3 text-sm text-[var(--v2-text)] placeholder:text-[var(--v2-muted)] focus:outline-none focus:border-[var(--v2-accent)]"
                        />
                      </div>

                      <div>
                        <div className="text-xs text-[var(--v2-muted)] mb-1">닉네임</div>
                        <input
                          value={form.nickname}
                          onChange={(e) => setForm((prev) => ({ ...prev, nickname: e.target.value }))}
                          placeholder="(선택)"
                          className="w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-3 py-3 text-sm text-[var(--v2-text)] placeholder:text-[var(--v2-muted)] focus:outline-none focus:border-[var(--v2-accent)]"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs text-[var(--v2-muted)] mb-1">가입일</div>
                          <input
                            value={form.joined_date}
                            onChange={(e) => setForm((prev) => ({ ...prev, joined_date: e.target.value }))}
                            placeholder="2025-12-25"
                            className="w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-3 py-3 text-sm text-[var(--v2-text)] focus:outline-none focus:border-[var(--v2-accent)]"
                          />
                        </div>
                        <div>
                          <div className="text-xs text-[var(--v2-muted)] mb-1">누적 입금</div>
                          <input
                            inputMode="numeric"
                            value={form.deposit_total}
                            onChange={(e) => setForm((prev) => ({ ...prev, deposit_total: e.target.value }))}
                            className="w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-3 py-3 text-sm text-[var(--v2-text)] focus:outline-none focus:border-[var(--v2-accent)]"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        className="flex-1 rounded-lg border border-[var(--v2-accent)] bg-[var(--v2-accent)] px-3 py-3 text-sm font-bold text-black hover:brightness-110 disabled:opacity-50"
                        onClick={submitCreate}
                        disabled={saving}
                      >
                        생성하기
                      </button>
                      <button
                        type="button"
                        className="flex-1 rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-3 text-sm text-[var(--v2-text)] hover:bg-[var(--v2-surface-3)] disabled:opacity-50"
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
                  <div className="flex h-full flex-col items-center justify-center text-[var(--v2-muted)] opacity-50">
                    <svg className="h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                    <p className="text-sm">사용자를 선택하세요</p>
                  </div>
                )
              ) : !drawerOpen ? (
                <div className="flex h-full flex-col items-center justify-center text-[var(--v2-muted)] opacity-50">
                  <p className="text-sm">패널이 닫혀있습니다</p>
                </div>
              ) : (
                <div className="space-y-6 text-sm text-[var(--v2-text)]">
                  <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface)] p-5 space-y-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs uppercase tracking-wider text-[var(--v2-muted)] mb-1">외부 ID</div>
                        <div className="font-mono text-xl text-[var(--v2-accent)] font-semibold tracking-tight">{selectedRow.external_user_id}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs uppercase tracking-wider text-[var(--v2-muted)] mb-1">DB ID</div>
                        <div className="font-mono text-[var(--v2-muted)] text-xs">#{selectedRow.user_id}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div>
                        <div className="text-xs text-[var(--v2-muted)] mb-1">닉네임</div>
                        <input
                          value={form.nickname}
                          onChange={(e) => setForm((prev) => ({ ...prev, nickname: e.target.value }))}
                          className="w-full bg-transparent border-b border-[var(--v2-border)] py-1 text-sm focus:outline-none focus:border-[var(--v2-accent)] transition-colors placeholder:text-[var(--v2-muted)]/50"
                          placeholder="미설정"
                        />
                      </div>
                      <div>
                        <div className="text-xs text-[var(--v2-muted)] mb-1">가입일</div>
                        <input
                          value={form.joined_date}
                          onChange={(e) => setForm((prev) => ({ ...prev, joined_date: e.target.value }))}
                          className="w-full bg-transparent border-b border-[var(--v2-border)] py-1 text-sm focus:outline-none focus:border-[var(--v2-accent)] transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface)] p-5 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between border-b border-[var(--v2-border)] pb-3 mb-2">
                      <h3 className="text-xs uppercase tracking-wider text-[var(--v2-muted)] font-semibold">상태 및 권한</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-[var(--v2-muted)] mb-1">누적 입금액</div>
                        <div className="relative">
                          <input
                            inputMode="numeric"
                            value={form.deposit_total}
                            onChange={(e) => setForm((prev) => ({ ...prev, deposit_total: e.target.value }))}
                            className="w-full rounded bg-[var(--v2-surface-2)] border border-[var(--v2-border)] py-2 pl-3 pr-8 text-sm font-mono focus:outline-none focus:border-[var(--v2-accent)]"
                          />
                          <span className="absolute right-3 top-2 text-xs text-[var(--v2-muted)]">원</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-[var(--v2-muted)] mb-1">만료일</div>
                        <div className="py-2 text-sm font-mono text-[var(--v2-text)]">
                          {selectedRow.expires_at ? selectedRow.expires_at.slice(0, 10) : '-'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="gap-4 flex flex-col">
                    {/* 골드 볼트 미션 */}
                    <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface)] p-5 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                          <div className="text-xs uppercase tracking-wider text-[var(--v2-muted)] font-semibold">골드 볼트</div>
                        </div>
                        <div className={`text-[10px] px-2 py-0.5 rounded border ${goldStatus === 'UNLOCKED' ? 'border-[var(--v2-accent)] text-[var(--v2-accent)]' :
                          goldStatus === 'CLAIMED' ? 'border-blue-400 text-blue-400' :
                            'border-[var(--v2-muted)] text-[var(--v2-muted)]'
                          }`}>
                          {statusLabel(goldStatus)}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {[
                          { label: 'CC카지노 공식채널 입장', done: goldMission1, key: 'gold_mission_1_done' },
                          { label: '담당실장 공식채널 입장', done: goldMission2, key: 'gold_mission_2_done' },
                          { label: '간편 본인확인', done: goldMission3, key: 'gold_mission_3_done' }
                        ].map((m, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded hover:bg-[var(--v2-surface-2)] transition">
                            <div className="flex items-center gap-3">
                              <span className="w-5 h-5 rounded-full bg-[var(--v2-surface-2)] border border-[var(--v2-border)] flex items-center justify-center text-[10px] text-[var(--v2-muted)]">{idx + 1}</span>
                              <span className="text-sm">{m.label}</span>
                            </div>
                            <Switch
                              checked={m.done}
                              onChange={() => submitGoldMissions({ [m.key]: !m.done })}
                              disabled={saving || goldStatus === 'CLAIMED' || goldStatus === 'EXPIRED'}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 플래티넘 볼트 미션 */}
                    <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface)] p-5 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-slate-400"></div>
                          <div className="text-xs uppercase tracking-wider text-[var(--v2-muted)] font-semibold">플래티넘 볼트</div>
                        </div>
                        <div className={`text-[10px] px-2 py-0.5 rounded border ${platinumStatus === 'UNLOCKED' ? 'border-[var(--v2-accent)] text-[var(--v2-accent)]' :
                          platinumStatus === 'CLAIMED' ? 'border-blue-400 text-blue-400' :
                            'border-[var(--v2-muted)] text-[var(--v2-muted)]'
                          }`}>
                          {statusLabel(platinumStatus)}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {[
                          { label: '누적 입금 20만원 달성', done: platinumMission1, key: 'platinum_mission_1_done' },
                          { label: '누적 입금 3회 달성', done: platinumMission2, key: 'platinum_mission_2_done' },
                        ].map((m, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded hover:bg-[var(--v2-surface-2)] transition">
                            <div className="flex items-center gap-3">
                              <span className="w-5 h-5 rounded-full bg-[var(--v2-surface-2)] border border-[var(--v2-border)] flex items-center justify-center text-[10px] text-[var(--v2-muted)]">{idx + 1}</span>
                              <span className="text-sm">{m.label}</span>
                            </div>
                            <Switch
                              checked={m.done}
                              onChange={() => submitPlatinumMissions({ [m.key]: !m.done })}
                              disabled={saving || platinumStatus === 'CLAIMED' || platinumStatus === 'EXPIRED'}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 다이아 볼트 미션 */}
                    <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface)] p-5 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-cyan-400"></div>
                          <div className="text-xs uppercase tracking-wider text-[var(--v2-muted)] font-semibold">다이아 볼트</div>
                        </div>
                        <div className={`text-[10px] px-2 py-0.5 rounded border ${diamondStatus === 'UNLOCKED' ? 'border-[var(--v2-accent)] text-[var(--v2-accent)]' :
                          diamondStatus === 'CLAIMED' ? 'border-blue-400 text-blue-400' :
                            'border-[var(--v2-muted)] text-[var(--v2-muted)]'
                          }`}>
                          {statusLabel(diamondStatus)}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {[
                          { label: '누적 충전 200만원 달성', done: diamondMission1, key: 'diamond_mission_1_done' },
                          { label: 'CC카지노 2회 출석', done: diamondMission2, key: 'diamond_mission_2_done' }
                        ].map((m, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded hover:bg-[var(--v2-surface-2)] transition">
                            <div className="flex items-center gap-3">
                              <span className="w-5 h-5 rounded-full bg-[var(--v2-surface-2)] border border-[var(--v2-border)] flex items-center justify-center text-[10px] text-[var(--v2-muted)]">{idx + 1}</span>
                              <span className="text-sm">{m.label}</span>
                            </div>
                            <Switch
                              checked={m.done}
                              onChange={() => submitDiamondMissions({ [m.key]: !m.done })}
                              disabled={saving || diamondStatus === 'CLAIMED' || diamondStatus === 'EXPIRED'}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface)] p-5 shadow-sm space-y-3">
                      <div className="text-xs uppercase tracking-wider text-[var(--v2-muted)] font-semibold">만료일 연장</div>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="1" max="3"
                          value={expiryExtendDays}
                          onChange={(e) => setExpiryExtendDays(Number(e.target.value))}
                          className="w-16 rounded border border-[var(--v2-border)] bg-[var(--v2-surface-2)] text-center py-2 text-sm focus:border-[var(--v2-accent)] focus:outline-none"
                        />
                        <select
                          value={expiryReason}
                          onChange={(e) => setExpiryReason(e.target.value)}
                          className="flex-1 rounded border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-3 text-sm focus:border-[var(--v2-accent)] focus:outline-none"
                        >
                          <option value="OPS">운영</option>
                          <option value="PROMO">프로모션</option>
                          <option value="ADMIN">관리자</option>
                        </select>
                        <button
                          onClick={submitExtendExpiry}
                          disabled={extending || saving}
                          className="rounded bg-[var(--v2-surface-3)] px-3 py-2 text-sm font-medium hover:bg-[var(--v2-accent)] hover:text-black transition-colors disabled:opacity-50"
                        >
                          연장
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="sticky bottom-0 pt-4 pb-2 bg-[var(--v2-surface-2)] border-t border-[var(--v2-border)] flex gap-3">
                    <button
                      type="button"
                      onClick={submitDelete}
                      disabled={saving}
                      className="flex-1 rounded-lg border border-red-900/30 bg-red-900/10 py-3 text-sm font-medium text-red-500 hover:bg-red-900/20 transition-colors disabled:opacity-50"
                    >
                      삭제
                    </button>
                    <button
                      type="button"
                      onClick={submitUpdate}
                      disabled={saving}
                      className="flex-[2] rounded-lg bg-[var(--v2-accent)] py-3 text-sm font-bold text-black hover:brightness-110 shadow-[0_0_15px_rgba(183,247,90,0.2)] transition-all disabled:opacity-50"
                    >
                      {saving ? '저장 중...' : '변경사항 저장'}
                    </button>
                  </div>

                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
