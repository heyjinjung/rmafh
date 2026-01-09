import Head from 'next/head';
import Link from 'next/link';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  CsvUploader,
  ExpiryExtensionForm,
  NotificationForm,
  ResponseViewer,
  StatusViewer,
  UsersListViewer,
} from '../components/admin';
import { safeJsonPretty } from '../components/admin/utils';

// Figma Assets (URLs are time-limited by Figma)
const ICON_STAR = '/logo.png';
const ICON_GAME = '/logo.png';
const ICON_TELEGRAM = '/telegram.png';

export default function AdminPage() {
  const router = useRouter();
  const basePath = router.basePath || '';
  const adminV2Enabled = process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED === 'true';
  const toAppPath = (path) => {
    if (typeof path !== 'string') return path;
    if (!path.startsWith('/')) return path;
    if (!basePath) return path;
    if (path.startsWith(`${basePath}/`)) return path;
    return `${basePath}${path}`;
  };

  const [adminPassword, setAdminPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [externalUserId, setExternalUserId] = useState('');
  const [activeSection, setActiveSection] = useState('status');
  const [busyKey, setBusyKey] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(null);

  // 페이지 로드 시 sessionStorage에서 비밀번호 복원
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPassword = sessionStorage.getItem('adminPassword');
      if (savedPassword) {
        setAdminPassword(savedPassword);
        setIsAuthenticated(true);
      }
    }
  }, []);

  // 로그인 시 sessionStorage에 저장
  const handleLogin = () => {
    if (adminPassword) {
      sessionStorage.setItem('adminPassword', adminPassword);
      setIsAuthenticated(true);
    }
  };

  // 로그아웃
  const handleLogout = () => {
    sessionStorage.removeItem('adminPassword');
    setAdminPassword('');
    setIsAuthenticated(false);
  };

  const [statusData, setStatusData] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState(null);
  const [statusLastCall, setStatusLastCall] = useState(null);

  const [extendResponse, setExtendResponse] = useState(null);
  const [extendLoading, setExtendLoading] = useState(false);
  const [extendError, setExtendError] = useState(null);
  const [extendLastCall, setExtendLastCall] = useState(null);

  const [notifyResponse, setNotifyResponse] = useState(null);
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifyError, setNotifyError] = useState(null);
  const [notifyLastCall, setNotifyLastCall] = useState(null);

  const [notifyList, setNotifyList] = useState(null);
  const [notifyListLoading, setNotifyListLoading] = useState(false);
  const [notifyListError, setNotifyListError] = useState(null);
  const [notifyListLastCall, setNotifyListLastCall] = useState(null);
  const [notifyListPage, setNotifyListPage] = useState(1);
  const [notifyListFilters, setNotifyListFilters] = useState({ status: '', type: '', variant_id: '', external_user_id: '' });

  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const [showInlineUserList, setShowInlineUserList] = useState(false);

  const showToast = (next) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast(next);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
  }, []);

  const [csvResponse, setCsvResponse] = useState(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvError, setCsvError] = useState(null);
  const [csvLastCall, setCsvLastCall] = useState(null);

  const [actionResponse, setActionResponse] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionLastCall, setActionLastCall] = useState(null);
  const [actionKey, setActionKey] = useState(null);
  const [userForm, setUserForm] = useState({ external_user_id: '', nickname: '', joined_date: '' });
  const [userUpdateForm, setUserUpdateForm] = useState({ nickname: '', joined_date: '', deposit_total: '', telegram_ok: '', review_ok: '' });
  const [statusForm, setStatusForm] = useState({ gold_status: '', platinum_status: '', diamond_status: '' });
  const [attendanceForm, setAttendanceForm] = useState({ delta_days: '', set_days: '' });
  const [depositForm, setDepositForm] = useState({ platinum_deposit_done: '', diamond_deposit_current: '' });

  const qs = useMemo(() => {
    const params = new URLSearchParams();
    if (externalUserId) params.set('external_user_id', externalUserId);
    const s = params.toString();
    return s ? `?${s}` : '';
  }, [externalUserId]);

  async function callApiRaw(path, init, { key, setLastCall, includeExternalQuery = true }) {
    setBusyKey(key);
    const method = (init?.method || 'GET').toUpperCase();
    const pathWithQs = includeExternalQuery ? `${path}${qs}` : path;
    setLastCall({ key, method, path: pathWithQs, at: new Date().toISOString() });

    const headers = { ...(init?.headers || {}) };
    if (isAuthenticated && adminPassword) {
      headers['x-admin-password'] = adminPassword;
    }

    const res = await fetch(toAppPath(pathWithQs), { ...init, headers });
    const ct = res.headers.get('content-type') || '';
    const body = ct.includes('application/json') ? await res.json() : await res.text();
    if (!res.ok) {
      const err = new Error('API 요청 실패');
      err.payload = { 상태코드: res.status, 응답: body };
      throw err;
    }
    return body;
  }

  const cardBase = 'rounded-[8px] border border-admin-border bg-admin-surface';
  const inputBase =
    'w-full rounded-[12px] border border-admin-border2 bg-admin-input px-5 py-4 text-sm text-admin-text placeholder:text-admin-muted outline-none transition-all hover:brightness-[1.03] focus:ring-2 focus:ring-admin-green focus:border-admin-green focus:bg-admin-surface focus:placeholder-transparent';
  const selectBase = `${inputBase} pr-8`;
  const buttonBase =
    'inline-flex items-center px-5 py-3 rounded-[6px] text-sm font-semibold border border-transparent bg-admin-green text-white hover:bg-admin-greenDark focus:outline-none focus:ring-2 focus:ring-admin-green focus:ring-offset-2 focus:ring-offset-admin-surface disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
  const buttonGhost =
    'px-4 py-2 rounded-[6px] text-sm font-semibold border border-admin-border2 bg-admin-surface text-admin-text hover:brightness-[1.05] disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
  const statusOptions = ['', 'LOCKED', 'UNLOCKED', 'CLAIMED', 'EXPIRED'];

  const sectionButtonClass = (key) => {
    const isActive = activeSection === key;
    return [
      'px-3 py-2 rounded-[4px] text-sm font-semibold border',
      isActive
        ? 'border-admin-neon text-admin-neon bg-admin-bg'
        : 'border-transparent text-admin-muted hover:text-admin-text hover:border-admin-border2',
      'disabled:opacity-50 disabled:cursor-not-allowed',
    ].join(' ');
  };

  const resetAllResponses = () => {
    setStatusError(null);
    setStatusData(null);
    setStatusLastCall(null);
    setSelectedUserId(null);
    setExtendError(null);
    setExtendResponse(null);
    setExtendLastCall(null);
    setNotifyError(null);
    setNotifyResponse(null);
    setNotifyLastCall(null);
    setNotifyList(null);
    setNotifyListError(null);
    setNotifyListLastCall(null);
    setNotifyListPage(1);
    setNotifyListFilters({ status: '', type: '', variant_id: '', external_user_id: '' });
    setCsvError(null);
    setCsvResponse(null);
    setCsvLastCall(null);
    setActionError(null);
    setActionResponse(null);
    setActionLastCall(null);
    setActionKey(null);
  };

  const fetchUserStatus = async ({ skipBusy = false } = {}) => {
    if (!externalUserId && !selectedUserId) {
      setStatusError({ 응답: { message: '외부 아이디를 입력하거나 목록에서 사용자를 선택하세요.' } });
      return;
    }

    setStatusLoading(true);
    setStatusError(null);
    setStatusData(null);
    if (!skipBusy) setBusyKey('status');

    const q = externalUserId ? `?query=${encodeURIComponent(externalUserId)}` : '';
    setStatusLastCall({ key: 'status', method: 'GET', path: `/api/vault/users-list${q}`, at: new Date().toISOString() });

    try {
      const response = await fetch(toAppPath(`/api/vault/users-list${q}`), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw { payload: data };
      }

      const user = Array.isArray(data?.users) ? data.users[0] : null;
      if (!user) {
        throw { payload: { 응답: { message: '해당 사용자를 찾지 못했어요.' }, 상태코드: 404 } };
      }

      setStatusData(user);
      setSelectedUserId(user.user_id);
      if (user.external_user_id) setExternalUserId(user.external_user_id);
      showToast({ type: 'success', title: '상태 갱신', message: '사용자 상태를 불러왔어요.' });
    } catch (e) {
      setStatusError(e?.payload || { 상태코드: 0, 응답: { message: e?.message || '요청에 실패했어요.' } });
      const msg = e?.payload?.응답?.message || e?.message || '요청에 실패했어요.';
      showToast({ type: 'error', title: '상태 조회 실패', message: msg });
    } finally {
      setStatusLoading(false);
      if (!skipBusy) setBusyKey('');
    }
  };

  const notifyStatusOptions = ['', 'PENDING', 'RETRYING', 'SENT', 'FAILED', 'DLQ'];
  const notifyTypeOptions = ['', 'EXPIRY_D2', 'EXPIRY_D0', 'ATTENDANCE_D2', 'TICKET_ZERO', 'SOCIAL_PROOF'];

  const fetchNotifyList = async ({ page: pageOverride } = {}) => {
    const nextPage = pageOverride || notifyListPage || 1;
    setNotifyListLoading(true);
    setNotifyListError(null);
    setBusyKey('notify-list');

    const params = new URLSearchParams();
    params.set('page', String(nextPage));
    params.set('page_size', '50');
    if (notifyListFilters.status) params.set('status', notifyListFilters.status);
    if (notifyListFilters.type) params.set('type', notifyListFilters.type);
    if (notifyListFilters.variant_id) params.set('variant_id', notifyListFilters.variant_id);
    if (notifyListFilters.external_user_id) params.set('external_user_id', notifyListFilters.external_user_id.trim());

    const path = `/api/vault/admin/notifications?${params.toString()}`;
    setNotifyListLastCall({ key: 'notify-list', method: 'GET', path, at: new Date().toISOString() });

    try {
      const response = await fetch(toAppPath(path), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword,
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw { payload: data };
      }
      setNotifyList(data);
      setNotifyListPage(nextPage);
    } catch (e) {
      setNotifyListError(e?.payload || { 상태코드: 0, 응답: { message: e?.message || '요청에 실패했어요.' } });
    } finally {
      setNotifyListLoading(false);
      setBusyKey('');
    }
  };

  const runAdminAction = async (action, body) => {
    if (!selectedUserId) {
      setActionError({ 응답: { message: '먼저 사용자 상태를 조회하거나 목록에서 선택하세요.' } });
      showToast({ type: 'error', title: '실행 불가', message: '먼저 사용자 상태를 조회하거나 선택하세요.' });
      return;
    }

    setActionLoading(true);
    setActionError(null);
    setActionResponse(null);
    setActionKey(action);

    try {
      const resp = await callApiRaw(
        `/api/vault/admin/users/${selectedUserId}/vault/${action}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
        { key: action, setLastCall: setActionLastCall, includeExternalQuery: false }
      );
      setActionResponse(resp);
      const actionLabel =
        action === 'status'
          ? '금고 상태 변경'
          : action === 'attendance'
            ? '출석 조정'
            : action === 'deposit'
              ? '입금/누적 업데이트'
              : '관리 액션';
      showToast({ type: 'success', title: '완료', message: `${actionLabel} 적용됐어요.` });
      await fetchUserStatus({ skipBusy: true });
    } catch (e) {
      setActionError(e?.payload || { 상태코드: 0, 응답: { message: e?.message || '요청에 실패했어요.' } });
      const message = e?.payload?.응답?.message || e?.message || '요청에 실패했어요.';
      showToast({ type: 'error', title: '실패', message });
    } finally {
      setActionLoading(false);
      setBusyKey('');
    }
  };

  return (
    <>
      <Head>
        <title>CC Casino - 관리자 도구</title>
      </Head>

      {adminV2Enabled ? (
        <div className="bg-emerald-900/40 border-b border-emerald-700/60 text-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2 text-sm">
            <span className="text-white/80">Admin v2 프리뷰 사용 가능</span>
            <Link href="/admin/v2" className="rounded-md border border-emerald-500/50 px-3 py-1 text-emerald-100 hover:bg-emerald-800/50">
              v2 열기
            </Link>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed top-6 right-6 z-50 max-w-sm w-full drop-shadow-xl">
          {(() => {
            const tone = toast.type === 'success'
              ? { bg: 'bg-emerald-900/90', border: 'border-emerald-500/60', icon: '✓' }
              : toast.type === 'error'
                ? { bg: 'bg-red-900/90', border: 'border-red-500/60', icon: '!' }
                : { bg: 'bg-gray-900/90', border: 'border-gray-500/60', icon: 'i' };
            return (
              <div className={`rounded-lg border ${tone.border} ${tone.bg} backdrop-blur-md p-4 flex gap-3 items-start`}>
                <div className="h-8 w-8 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-sm font-bold text-white">
                  {tone.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white leading-tight">{toast.title}</p>
                  {toast.message ? (
                    <p className="text-xs text-white/80 mt-1 leading-snug break-words">{toast.message}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label="닫기"
                  className="text-white/60 hover:text-white text-sm"
                  onClick={() => setToast(null)}
                >
                  ×
                </button>
              </div>
            );
          })()}
        </div>
      ) : null}

      {!isAuthenticated ? (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
          <div className="w-full max-w-md space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-admin-green mb-2">어드민 로그인</h1>
              <p className="text-admin-muted text-sm">비밀번호를 입력하세요</p>
            </div>
            <div className="rounded-lg border border-admin-border bg-admin-surface p-6 space-y-4">
              <input
                type="password"
                placeholder="비밀번호"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && adminPassword) {
                    handleLogin();
                  }
                }}
                className={inputBase}
              />
              <button
                onClick={handleLogin}
                disabled={!adminPassword}
                className={buttonBase + ' w-full justify-center'}
              >
                로그인
              </button>
            </div>
          </div>
        </div>
      ) : (
      <div className="min-h-screen bg-black text-white overflow-x-hidden">
        <div className="mx-auto w-full max-w-none px-4 lg:px-0">
          <div className="relative min-h-screen flex flex-col lg:flex-row">
            {/* Left column: Sidebar + Footer (desktop fixed width) */}
            <div className="w-full lg:w-[356px] lg:shrink-0 lg:flex lg:flex-col lg:min-h-screen">
              {/* Sidebar */}
              <aside className="flex flex-col gap-[49px] px-[5px] py-[20px] lg:ml-[8px] lg:w-[345px]">
                <nav className="flex items-start justify-between">
                  <div className="flex items-center gap-[5px] w-[184px]">
                    <div className="h-[27px] w-[26px] shrink-0 rounded-[18px] overflow-hidden">
                      <img
                        alt=""
                        src={ICON_STAR}
                        className="h-full w-full object-cover object-center"
                      />
                    </div>
                    <span className="font-ibm font-semibold text-[20px] tracking-[-0.4px] leading-[1.058]">
                      CC CASINO
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleLogout}
                      className="border border-gold-primary/70 bg-black/70 hover:bg-gold-primary/10 text-gold-primary rounded-[2.064px] px-[14px] py-[11px] text-[10px] tracking-[-0.2px] leading-[1.058] font-ibmKr shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition-colors"
                    >
                      로그아웃
                    </button>
                    <Link
                      href="/"
                      className="bg-gold-primary text-black rounded-[2.064px] px-[14px] py-[11px] text-[10px] tracking-[-0.2px] leading-[1.058] font-ibmKr"
                    >
                      금고 가이드
                    </Link>
                  </div>
                </nav>

                <div className="flex flex-col gap-[20px] items-start">
                  <h1 className="font-medium leading-[1.058] tracking-[-0.84px] text-[34px]">
                    <span className="block">씨씨카지노</span>
                    <span className="block text-gold-primary">신규회원 전용금고</span>
                  </h1>
                  <p className="text-[16px] leading-[1.09] text-cc-textSub">
                    평생주소 : 씨씨주소.COM
                  </p>
                </div>

                <div className="flex flex-col gap-[24px] items-start w-full">
                  <p className="font-semibold text-[14px] uppercase tracking-wider text-gold-primary/80">
                    운영 바로가기
                  </p>
                  <div className="flex flex-row gap-3 w-full">
                    <button
                      type="button"
                      onClick={() => setActiveSection('users')}
                      disabled={!!busyKey}
                      className={`
                        relative overflow-hidden
                        bg-black
                        border-2 transition-all duration-200
                        rounded-lg px-3 py-5
                        flex flex-col items-center justify-center gap-3
                        hover:shadow-lg hover:shadow-gold-primary/30 hover:-translate-y-0.5
                        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
                        flex-1
                        ${activeSection === 'users' 
                          ? 'border-gold-primary bg-gold-primary/10 shadow-md shadow-gold-primary/20' 
                          : 'border-gold-primary/60 hover:border-gold-primary'
                        }
                      `}
                    >
                      <div className={`text-3xl transition-all ${
                        activeSection === 'users' 
                          ? 'scale-110' 
                          : ''
                      }`}>
                        ⭐
                      </div>
                      <div className={`font-semibold text-[11px] text-center transition-colors leading-tight ${
                        activeSection === 'users' 
                          ? 'text-gold-primary' 
                          : 'text-gold-primary/80'
                      }`}>
                        전체<br/>회원
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSection('csv')}
                      disabled={!!busyKey}
                      className={`
                        relative overflow-hidden
                        bg-black
                        border-2 transition-all duration-200
                        rounded-lg px-3 py-5
                        flex flex-col items-center justify-center gap-3
                        hover:shadow-lg hover:shadow-gold-primary/30 hover:-translate-y-0.5
                        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
                        flex-1
                        ${activeSection === 'csv' 
                          ? 'border-gold-primary bg-gold-primary/10 shadow-md shadow-gold-primary/20' 
                          : 'border-gold-primary/60 hover:border-gold-primary'
                        }
                      `}
                    >
                      <div className={`text-3xl transition-all ${
                        activeSection === 'csv' 
                          ? 'scale-110' 
                          : ''
                      }`}>
                        📊
                      </div>
                      <div className={`font-semibold text-[11px] text-center transition-colors leading-tight ${
                        activeSection === 'csv' 
                          ? 'text-gold-primary' 
                          : 'text-gold-primary/80'
                      }`}>
                        일일<br/>업로드
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSection('extend')}
                      disabled={!!busyKey}
                      className={`
                        relative overflow-hidden
                        bg-black
                        border-2 transition-all duration-200
                        rounded-lg px-3 py-5
                        flex flex-col items-center justify-center gap-3
                        hover:shadow-lg hover:shadow-gold-primary/30 hover:-translate-y-0.5
                        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
                        flex-1
                        ${activeSection === 'extend' 
                          ? 'border-gold-primary bg-gold-primary/10 shadow-md shadow-gold-primary/20' 
                          : 'border-gold-primary/60 hover:border-gold-primary'
                        }
                      `}
                    >
                      <div className={`text-3xl transition-all ${
                        activeSection === 'extend' 
                          ? 'scale-110' 
                          : ''
                      }`}>
                        ⏰
                      </div>
                      <div className={`font-semibold text-[11px] text-center transition-colors leading-tight ${
                        activeSection === 'extend' 
                          ? 'text-gold-primary' 
                          : 'text-gold-primary/80'
                      }`}>
                        만료<br/>연장
                      </div>
                    </button>
                  </div>
                </div>
              </aside>

              {/* Footer */}
              <footer className="bg-cc-accent2 px-[20px] py-[24px] mt-6 lg:mt-auto lg:w-[356px] lg:h-[222px] lg:flex lg:items-end lg:py-[31px]">
                <div className="flex flex-col gap-[12.639px] items-start">
                  <p className="font-medium leading-[1.15] text-[20px] text-gold-primary">Contact</p>
                  <div className="font-medium leading-[1.15] text-[20px] text-gold-primary">
                    <p>
                      <a href="https://t.me/CCCS1009" target="_blank" rel="noreferrer" className="underline">
                        CC고객센터 텔레그램
                      </a>
                    </p>
                    <p>
                      <a href="https://ccc-001.com" target="_blank" rel="noreferrer" className="underline">
                        CC카지노 바로가기
                      </a>
                    </p>
                    <p>
                      <a href="https://t.me/+IE0NYpuze_k1YWZk" target="_blank" rel="noreferrer" className="underline">
                        CC카지노 공식 텔레채널
                      </a>
                    </p>
                  </div>
                </div>
              </footer>
            </div>

            {/* Right/Main */}
            <main className="w-full bg-admin-bg text-admin-text lg:flex-1 lg:min-w-0 lg:overflow-x-hidden flex flex-col min-h-screen lg:-mt-[14px]">
              <div className="py-5 px-4 sm:px-6 lg:px-[25px] lg:py-0 flex-1 flex flex-col overflow-y-auto">
                <div className="pt-3 lg:pt-5 flex-1 pb-6">
                <div className="mb-3">
                  <h1 className="text-[28px] sm:text-[32px] font-medium tracking-[-0.84px] leading-[1.058]">
                    <span className="text-admin-text">관리자</span>{' '}
                    <span className="text-admin-neon">도구</span>
                  </h1>
                  <p className="mt-2 text-sm text-admin-muted">
                    필요한 입력만 남겼어요. 영향이 큰 작업은 먼저 <strong className="text-admin-text">미리보기(shadow)</strong>로 확인 후 실행하세요.
                  </p>
                </div>

                <div className={`${cardBase} p-3 md:p-4 mb-3`}>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-4">
                      <div className="flex-1">
                        <label className="block text-sm font-semibold mb-2 text-admin-text">
                          외부 아이디 (external_user_id)
                        </label>
                        <input
                          className={inputBase}
                          value={externalUserId}
                          onChange={(e) => setExternalUserId(e.target.value)}
                          placeholder="예: ext-123"
                        />
                        <p className="mt-2 text-xs text-admin-muted">
                          비워도 동작할 수 있지만, 대부분의 작업은 외부 아이디를 넣는 게 안전해요.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className={buttonBase}
                          disabled={!!busyKey}
                          onClick={() => {
                            setActiveSection('status');
                            fetchUserStatus();
                          }}
                        >
                          상태 조회
                        </button>
                        <button
                          className={buttonGhost}
                          disabled={!!busyKey}
                          onClick={() => {
                            resetAllResponses();
                          }}
                        >
                          결과 초기화
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs mb-2 text-admin-muted">작업 선택</div>
                      <div className="flex flex-wrap gap-2">
                        <button className={sectionButtonClass('status')} disabled={!!busyKey} onClick={() => setActiveSection('status')}>
                          상태
                        </button>
                        <button className={sectionButtonClass('user-manage')} disabled={!!busyKey} onClick={() => setActiveSection('user-manage')}>
                          사용자 관리
                        </button>
                        <button className={sectionButtonClass('csv')} disabled={!!busyKey} onClick={() => setActiveSection('csv')}>
                          엑셀 업로드
                        </button>
                        <button className={sectionButtonClass('extend')} disabled={!!busyKey} onClick={() => setActiveSection('extend')}>
                          만료 연장
                        </button>
                        <button className={sectionButtonClass('notify')} disabled={!!busyKey} onClick={() => setActiveSection('notify')}>
                          알림
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {activeSection === 'users' ? (
                    <div className={`${cardBase} p-3 md:p-4`}>
                      <div className="mb-4">
                        <h2 className="text-lg font-semibold text-admin-neon mb-1">전체 회원 조회</h2>
                        <p className="text-sm text-admin-muted">
                          전체 회원 목록과 각 회원의 금고 상태를 확인할 수 있어요. 행을 클릭하면 상세 상태 조회로 이동합니다.
                        </p>
                      </div>
                      <UsersListViewer
                        adminPassword={adminPassword}
                        onSelectUser={(user) => {
                          setExternalUserId(user.external_user_id || '');
                          setSelectedUserId(user.user_id || null);
                          setStatusData(user);
                          setActiveSection('status');
                        }}
                        onRefresh={() => setStatusData((prev) => prev)}
                      />
                    </div>
                  ) : null}

                  {activeSection === 'user-manage' ? (
                    <div className={`${cardBase} p-3 md:p-4 space-y-4`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-lg font-semibold text-admin-neon">사용자 관리</h2>
                          <p className="text-sm text-admin-muted">생성 / 편집 / 삭제 (선택 사용자 기준)</p>
                        </div>
                        <button
                          className={buttonGhost}
                          disabled={!!busyKey}
                          onClick={() => {
                            setUserForm({ external_user_id: '', nickname: '', joined_date: '' });
                            setUserUpdateForm({ nickname: '', joined_date: '', deposit_total: '', telegram_ok: '', review_ok: '' });
                          }}
                        >
                          초기화
                        </button>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div className="text-sm font-semibold text-admin-text">신규 생성</div>
                          <input
                            className={inputBase}
                            placeholder="외부 아이디"
                            value={userForm.external_user_id}
                            onChange={(e) => setUserForm((p) => ({ ...p, external_user_id: e.target.value }))}
                            disabled={!!busyKey}
                          />
                          <input
                            className={inputBase}
                            placeholder="닉네임 (선택)"
                            value={userForm.nickname}
                            onChange={(e) => setUserForm((p) => ({ ...p, nickname: e.target.value }))}
                            disabled={!!busyKey}
                          />
                          <input
                            className={inputBase}
                            placeholder="가입일 YYYY-MM-DD (선택)"
                            value={userForm.joined_date}
                            onChange={(e) => setUserForm((p) => ({ ...p, joined_date: e.target.value }))}
                            disabled={!!busyKey}
                          />
                          <button
                            className={buttonBase}
                            disabled={!!busyKey || !userForm.external_user_id}
                            onClick={async () => {
                              setBusyKey('user-create');
                              setActionError(null);
                              setActionResponse(null);
                              try {
                                const body = {
                                  external_user_id: userForm.external_user_id,
                                  nickname: userForm.nickname || undefined,
                                  joined_date: userForm.joined_date || undefined,
                                };
                                const resp = await callApiRaw(
                                  '/api/vault/admin/users',
                                  {
                                    method: 'POST',
                                    headers: { 'content-type': 'application/json' },
                                    body: JSON.stringify(body),
                                  },
                                  { key: 'user-create', setLastCall: setActionLastCall, includeExternalQuery: false }
                                );
                                setActionResponse(resp);
                                setActionKey('user-create');
                                setSelectedUserId(resp?.user_id || null);
                                setExternalUserId(resp?.external_user_id || '');
                                await fetchUserStatus({ skipBusy: true });
                              } catch (e) {
                                setActionError(e?.payload || { 상태코드: 0, 응답: { message: e?.message || '요청에 실패했어요.' } });
                              } finally {
                                setBusyKey('');
                              }
                            }}
                          >
                            사용자 생성
                          </button>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-admin-text">편집 / 삭제</div>
                            <div className="text-xs text-admin-muted">선택 사용자: {selectedUserId ?? '없음'}</div>
                          </div>
                          <input
                            className={inputBase}
                            placeholder="닉네임 (선택)"
                            value={userUpdateForm.nickname}
                            onChange={(e) => setUserUpdateForm((p) => ({ ...p, nickname: e.target.value }))}
                            disabled={!!busyKey}
                          />
                          <input
                            className={inputBase}
                            placeholder="가입일 YYYY-MM-DD (선택)"
                            value={userUpdateForm.joined_date}
                            onChange={(e) => setUserUpdateForm((p) => ({ ...p, joined_date: e.target.value }))}
                            disabled={!!busyKey}
                          />
                          <input
                            className={inputBase}
                            placeholder="총 입금액 (선택)"
                            type="number"
                            value={userUpdateForm.deposit_total}
                            onChange={(e) => setUserUpdateForm((p) => ({ ...p, deposit_total: e.target.value }))}
                            disabled={!!busyKey}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              className={selectBase}
                              value={userUpdateForm.telegram_ok}
                              onChange={(e) => setUserUpdateForm((p) => ({ ...p, telegram_ok: e.target.value }))}
                              disabled={!!busyKey}
                            >
                              <option value="">텔레그램 유지</option>
                              <option value="true">텔레그램 완료</option>
                              <option value="false">미완료</option>
                            </select>
                            <select
                              className={selectBase}
                              value={userUpdateForm.review_ok}
                              onChange={(e) => setUserUpdateForm((p) => ({ ...p, review_ok: e.target.value }))}
                              disabled={!!busyKey}
                            >
                              <option value="">리뷰 유지</option>
                              <option value="true">리뷰 완료</option>
                              <option value="false">미완료</option>
                            </select>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <button
                              className={buttonBase}
                              disabled={!!busyKey || !selectedUserId}
                              onClick={async () => {
                                const payload = {};
                                if (userUpdateForm.nickname !== '') payload.nickname = userUpdateForm.nickname;
                                if (userUpdateForm.joined_date !== '') payload.joined_date = userUpdateForm.joined_date;
                                if (userUpdateForm.deposit_total !== '') payload.deposit_total = Number(userUpdateForm.deposit_total);
                                if (userUpdateForm.telegram_ok !== '') payload.telegram_ok = userUpdateForm.telegram_ok === 'true';
                                if (userUpdateForm.review_ok !== '') payload.review_ok = userUpdateForm.review_ok === 'true';
                                if (Object.keys(payload).length === 0) {
                                  setActionError({ 응답: { message: '변경할 값을 입력하세요.' } });
                                  return;
                                }
                                setBusyKey('user-update');
                                setActionError(null);
                                setActionResponse(null);
                                try {
                                  const resp = await callApiRaw(
                                    `/api/vault/admin/users/${selectedUserId}`,
                                    {
                                      method: 'PATCH',
                                      headers: { 'content-type': 'application/json' },
                                      body: JSON.stringify(payload),
                                    },
                                    { key: 'user-update', setLastCall: setActionLastCall, includeExternalQuery: false }
                                  );
                                  setActionKey('user-update');
                                  setActionResponse(resp);
                                  await fetchUserStatus({ skipBusy: true });
                                } catch (e) {
                                  setActionError(e?.payload || { 상태코드: 0, 응답: { message: e?.message || '요청에 실패했어요.' } });
                                } finally {
                                  setBusyKey('');
                                }
                              }}
                            >
                              사용자 수정
                            </button>
                            <button
                              className="px-4 py-3 rounded-[6px] text-sm font-semibold border border-red-500 text-red-300 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={!!busyKey || !selectedUserId}
                              onClick={async () => {
                                setBusyKey('user-delete');
                                setActionError(null);
                                setActionResponse(null);
                                try {
                                  const resp = await callApiRaw(
                                    `/api/vault/admin/users/${selectedUserId}`,
                                    { method: 'DELETE' },
                                    { key: 'user-delete', setLastCall: setActionLastCall, includeExternalQuery: false }
                                  );
                                  setActionKey('user-delete');
                                  setActionResponse(resp);
                                  setSelectedUserId(null);
                                  setStatusData(null);
                                } catch (e) {
                                  setActionError(e?.payload || { 상태코드: 0, 응답: { message: e?.message || '요청에 실패했어요.' } });
                                } finally {
                                  setBusyKey('');
                                }
                              }}
                            >
                              사용자 삭제
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {activeSection === 'status' ? (
                    <>
                      <div className="flex items-center justify-between px-1">
                        <div>
                          <h2 className="text-lg font-semibold text-admin-neon">상태 조회</h2>
                          <p className="text-sm text-admin-muted">지정 사용자 상태 및 금고 액션을 관리합니다.</p>
                        </div>
                        <div className="flex gap-2 flex-wrap justify-end">
                          <button
                            className={buttonGhost}
                            disabled={!!busyKey}
                            onClick={() => setShowInlineUserList((v) => !v)}
                          >
                            {showInlineUserList ? '전체 조회 닫기' : '전체 회원 조회'}
                          </button>
                          <button
                            className={buttonGhost}
                            disabled={!!busyKey}
                            onClick={() => setActiveSection('users')}
                          >
                            전체 조회 탭으로 이동
                          </button>
                        </div>
                      </div>

                      {showInlineUserList ? (
                        <div className={`${cardBase} p-3 md:p-4`}> 
                          <UsersListViewer
                            adminPassword={adminPassword}
                            onSelectUser={(user) => {
                              setExternalUserId(user.external_user_id || '');
                              setSelectedUserId(user.user_id || null);
                              setStatusData(user);
                              setActiveSection('status');
                              setShowInlineUserList(false);
                            }}
                            onRefresh={() => setStatusData((prev) => prev)}
                          />
                        </div>
                      ) : null}

                      <div className="grid grid-cols-1 gap-4">
                        <StatusViewer statusData={statusData} cardBase={cardBase} externalUserId={externalUserId} />
                      </div>

                      <div className="grid grid-cols-1 gap-4 mt-4">
                        <div className={`${cardBase} p-3 md:p-4 space-y-4`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-lg font-semibold text-admin-neon">관리 액션</h3>
                              <p className="text-sm text-admin-muted">선택된 사용자: {selectedUserId ?? '없음'}</p>
                            </div>
                            <button
                              className={buttonGhost}
                              onClick={() => fetchUserStatus()}
                              disabled={!!busyKey}
                            >
                              상태 새로고침
                            </button>
                          </div>

                          <div className="space-y-2">
                            <div className="text-sm font-semibold text-admin-text">금고 상태 변경</div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              {['gold_status', 'platinum_status', 'diamond_status'].map((field) => (
                                <select
                                  key={field}
                                  className={selectBase}
                                  value={statusForm[field]}
                                  onChange={(e) => setStatusForm((prev) => ({ ...prev, [field]: e.target.value }))}
                                  disabled={!!busyKey}
                                >
                                  {statusOptions.map((opt) => (
                                    <option key={opt || 'none'} value={opt}>
                                      {opt || `${field.replace('_status', '').toUpperCase()} 유지`}
                                    </option>
                                  ))}
                                </select>
                              ))}
                            </div>
                            <button
                              className={buttonBase}
                              disabled={!!busyKey || actionLoading}
                              onClick={() => {
                                const payload = {};
                                if (statusForm.gold_status) payload.gold_status = statusForm.gold_status;
                                if (statusForm.platinum_status) payload.platinum_status = statusForm.platinum_status;
                                if (statusForm.diamond_status) payload.diamond_status = statusForm.diamond_status;
                                if (Object.keys(payload).length === 0) {
                                  setActionError({ 응답: { message: '변경할 상태를 선택하세요.' } });
                                  return;
                                }
                                runAdminAction('status', payload);
                              }}
                            >
                              상태 변경
                            </button>
                          </div>

                          <div className="space-y-2">
                            <div className="text-sm font-semibold text-admin-text">플래티넘 출석 일수 조정</div>
                            <p className="text-xs text-admin-muted">플래티넘 금고의 출석 일수를 수동으로 조정합니다.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <input
                                type="number"
                                className={inputBase}
                                placeholder="증가/감소할 일수 (예: +1 또는 -1)"
                                value={attendanceForm.delta_days}
                                onChange={(e) => setAttendanceForm((prev) => ({ ...prev, delta_days: e.target.value }))}
                                disabled={!!busyKey}
                              />
                              <input
                                type="number"
                                className={inputBase}
                                placeholder="설정할 일수 (예: 3)"
                                value={attendanceForm.set_days}
                                onChange={(e) => setAttendanceForm((prev) => ({ ...prev, set_days: e.target.value }))}
                                disabled={!!busyKey}
                              />
                            </div>
                            <button
                              className={buttonBase}
                              disabled={!!busyKey || actionLoading}
                              onClick={() => {
                                const delta = attendanceForm.delta_days === '' ? null : Number(attendanceForm.delta_days);
                                const setDays = attendanceForm.set_days === '' ? null : Number(attendanceForm.set_days);
                                if (delta === null && setDays === null) {
                                  setActionError({ 응답: { message: '증가/감소할 일수 또는 설정할 일수를 입력하세요.' } });
                                  return;
                                }
                                runAdminAction('attendance', { delta_days: delta, set_days: setDays });
                              }}
                            >
                              출석 일수 조정
                            </button>
                          </div>

                          <div className="space-y-2">
                            <div className="text-sm font-semibold text-admin-text">입금/누적 업데이트</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <select
                                className={selectBase}
                                value={depositForm.platinum_deposit_done}
                                onChange={(e) => setDepositForm((prev) => ({ ...prev, platinum_deposit_done: e.target.value }))}
                                disabled={!!busyKey}
                              >
                                <option value="">플래티넘 입금 상태 유지</option>
                                <option value="true">완료로 표시</option>
                                <option value="false">미완료로 표시</option>
                              </select>
                              <input
                                type="number"
                                className={inputBase}
                                placeholder="다이아 누적 입금 (7만 지급, 원)"
                                value={depositForm.diamond_deposit_current}
                                onChange={(e) => setDepositForm((prev) => ({ ...prev, diamond_deposit_current: e.target.value }))}
                                disabled={!!busyKey}
                              />
                            </div>
                            <button
                              className={buttonBase}
                              disabled={!!busyKey || actionLoading}
                              onClick={() => {
                                const payload = {};
                                if (depositForm.platinum_deposit_done !== '') {
                                  payload.platinum_deposit_done = depositForm.platinum_deposit_done === 'true';
                                }
                                if (depositForm.diamond_deposit_current !== '') {
                                  payload.diamond_deposit_current = Number(depositForm.diamond_deposit_current || 0);
                                }
                                if (Object.keys(payload).length === 0) {
                                  setActionError({ 응답: { message: '적용할 입금 값을 입력하세요.' } });
                                  return;
                                }
                                runAdminAction('deposit', payload);
                              }}
                            >
                              입금/누적 업데이트
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : null}

                  {activeSection === 'csv' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className={`${cardBase} p-3 md:p-4`}>
                        <CsvUploader
                          onUpload={(data) => {
                            (async () => {
                              setCsvLoading(true);
                              setCsvError(null);
                              setCsvResponse(null);
                              try {
                                const body = await callApiRaw(
                                  '/api/vault/user-daily-import/',
                                  {
                                    method: 'POST',
                                    headers: { 'content-type': 'application/json' },
                                    body: JSON.stringify(data),
                                  },
                                  { key: 'user-daily-import', setLastCall: setCsvLastCall }
                                );
                                setCsvResponse(body);
                              } catch (e) {
                                setCsvError(e?.payload || { 상태코드: 0, 응답: { message: e?.message || '요청에 실패했어요.' } });
                              } finally {
                                setCsvLoading(false);
                                setBusyKey('');
                              }
                            })();
                          }}
                          loading={csvLoading || !!busyKey}
                          inputBase={inputBase}
                          buttonBase={buttonBase}
                        />
                      </div>

                      <ResponseViewer
                        title="업로드 결과"
                        loading={csvLoading}
                        error={csvError}
                        response={csvResponse}
                        lastCall={csvLastCall}
                        cardBase={cardBase}
                        actionKey="user-daily-import"
                      />
                    </div>
                  ) : null}

                  {activeSection === 'extend' ? (
                    <div className="grid grid-cols-1 gap-4">
                      <div className={`${cardBase} p-3 md:p-4`}>
                        <ExpiryExtensionForm
                          externalUserId={externalUserId}
                          onSubmit={(payload) => {
                            (async () => {
                              setExtendLoading(true);
                              setExtendError(null);
                              setExtendResponse(null);
                              try {
                                const body = await callApiRaw(
                                  '/api/vault/extend-expiry/',
                                  {
                                    method: 'POST',
                                    headers: { 'content-type': 'application/json' },
                                    body: JSON.stringify(payload),
                                  },
                                  { key: 'extend-expiry', setLastCall: setExtendLastCall }
                                );
                                setExtendResponse(body);
                                showToast({ type: 'success', title: '만료 연장 완료', message: '요청이 처리됐어요.' });
                              } catch (e) {
                                setExtendError(e?.payload || { 상태코드: 0, 응답: { message: e?.message || '요청에 실패했어요.' } });
                                const msg = e?.payload?.응답?.message || e?.message || '요청에 실패했어요.';
                                showToast({ type: 'error', title: '만료 연장 실패', message: msg });
                              } finally {
                                setExtendLoading(false);
                                setBusyKey('');
                              }
                            })();
                          }}
                          loading={extendLoading || !!busyKey}
                          inputBase={inputBase}
                          selectBase={selectBase}
                          buttonBase={buttonBase}
                          buttonGhost={buttonGhost}
                        />
                      </div>
                    </div>
                  ) : null}

                  {activeSection === 'notify' ? (
                    <div className="grid grid-cols-1 gap-4">
                      <div className={`${cardBase} p-3 md:p-4`}>
                        <NotificationForm
                          externalUserId={externalUserId}
                          onSubmit={(payload) => {
                            (async () => {
                              setNotifyLoading(true);
                              setNotifyError(null);
                              setNotifyResponse(null);
                              try {
                                const body = await callApiRaw(
                                  '/api/vault/notify/',
                                  {
                                    method: 'POST',
                                    headers: { 'content-type': 'application/json' },
                                    body: JSON.stringify(payload),
                                  },
                                  { key: 'notify', setLastCall: setNotifyLastCall }
                                );
                                setNotifyResponse(body);
                                showToast({ type: 'success', title: '알림 요청 완료', message: '알림이 큐에 등록됐어요.' });
                              } catch (e) {
                                setNotifyError(e?.payload || { 상태코드: 0, 응답: { message: e?.message || '요청에 실패했어요.' } });
                                const msg = e?.payload?.응답?.message || e?.message || '요청에 실패했어요.';
                                showToast({ type: 'error', title: '알림 요청 실패', message: msg });
                              } finally {
                                setNotifyLoading(false);
                                setBusyKey('');
                              }
                            })();
                          }}
                          loading={notifyLoading || !!busyKey}
                          inputBase={inputBase}
                          selectBase={selectBase}
                          buttonBase={buttonBase}
                        />
                      </div>
                    </div>
                  ) : null}

                  {activeSection === 'notify-list' ? (
                    <div className="grid grid-cols-1 gap-4">
                      <div className={`${cardBase} p-3 md:p-4`}>
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="w-full md:w-48">
                              <label className="block text-xs font-semibold mb-1">상태</label>
                              <select
                                className={selectBase}
                                value={notifyListFilters.status}
                                onChange={(e) => setNotifyListFilters({ ...notifyListFilters, status: e.target.value })}
                              >
                                {notifyStatusOptions.map((opt) => (
                                  <option key={opt || 'any'} value={opt}>{opt || '전체'}</option>
                                ))}
                              </select>
                            </div>
                            <div className="w-full md:w-48">
                              <label className="block text-xs font-semibold mb-1">타입</label>
                              <select
                                className={selectBase}
                                value={notifyListFilters.type}
                                onChange={(e) => setNotifyListFilters({ ...notifyListFilters, type: e.target.value })}
                              >
                                {notifyTypeOptions.map((opt) => (
                                  <option key={opt || 'any-type'} value={opt}>{opt || '전체'}</option>
                                ))}
                              </select>
                            </div>
                            <div className="w-full md:w-48">
                              <label className="block text-xs font-semibold mb-1">버전</label>
                              <input
                                className={inputBase}
                                value={notifyListFilters.variant_id}
                                onChange={(e) => setNotifyListFilters({ ...notifyListFilters, variant_id: e.target.value })}
                                placeholder="예: A"
                              />
                            </div>
                            <div className="w-full md:w-64">
                              <label className="block text-xs font-semibold mb-1">외부 아이디</label>
                              <input
                                className={inputBase}
                                value={notifyListFilters.external_user_id}
                                onChange={(e) => setNotifyListFilters({ ...notifyListFilters, external_user_id: e.target.value })}
                                placeholder="필터 없으면 비워두기"
                              />
                            </div>
                          </div>

                          <div className="flex gap-3 justify-end">
                            <button
                              className={buttonGhost}
                              disabled={notifyListLoading}
                              onClick={() => {
                                setNotifyListFilters({ status: '', type: '', variant_id: '', external_user_id: '' });
                                setNotifyListPage(1);
                                setNotifyList(null);
                                setNotifyListError(null);
                              }}
                            >
                              초기화
                            </button>
                            <button
                              className={buttonBase}
                              disabled={notifyListLoading}
                              onClick={() => {
                                setNotifyListPage(1);
                                fetchNotifyList({ page: 1 });
                              }}
                            >
                              조회
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className={`${cardBase} p-3 md:p-4`}> 
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-bold">알림 큐 목록</h3>
                          {notifyListLastCall ? (
                            <span className="text-xs text-admin-muted">마지막 요청: {notifyListLastCall.path}</span>
                          ) : null}
                        </div>

                        {notifyListLoading ? <p className="mt-3 text-sm text-admin-muted">불러오는 중...</p> : null}
                        {notifyListError ? (
                          <p className="mt-3 text-sm text-red-400">
                            {notifyListError?.응답?.message || notifyListError?.message || '조회에 실패했어요.'}
                          </p>
                        ) : null}

                        {notifyList && Array.isArray(notifyList.items) && notifyList.items.length > 0 ? (
                          <div className="mt-3 overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead className="text-left text-admin-muted border-b border-admin-border">
                                <tr>
                                  <th className="py-2 pr-3">ID</th>
                                  <th className="py-2 pr-3">외부ID</th>
                                  <th className="py-2 pr-3">타입</th>
                                  <th className="py-2 pr-3">버전</th>
                                  <th className="py-2 pr-3">상태</th>
                                  <th className="py-2 pr-3">예약시각</th>
                                  <th className="py-2 pr-3">생성시각</th>
                                  <th className="py-2 pr-3">Payload</th>
                                </tr>
                              </thead>
                              <tbody>
                                {notifyList.items.map((item) => (
                                  <tr key={item.id} className="border-b border-admin-border/60">
                                    <td className="py-2 pr-3 text-admin-text">{item.id}</td>
                                    <td className="py-2 pr-3 text-admin-text">{item.external_user_id || '-'}</td>
                                    <td className="py-2 pr-3 text-admin-text">{item.type}</td>
                                    <td className="py-2 pr-3 text-admin-text">{item.variant_id || '-'}</td>
                                    <td className="py-2 pr-3 text-admin-text">{item.status}</td>
                                    <td className="py-2 pr-3 text-admin-text">{item.scheduled_at || '-'}</td>
                                    <td className="py-2 pr-3 text-admin-text">{item.created_at || '-'}</td>
                                    <td className="py-2 pr-3 text-admin-text whitespace-pre-wrap text-xs">{safeJsonPretty(item.payload)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : !notifyListLoading && notifyList && (!notifyList.items || notifyList.items.length === 0) ? (
                          <p className="mt-3 text-sm text-admin-muted">결과가 없습니다.</p>
                        ) : null}

                        {notifyList ? (
                          <div className="mt-4 flex items-center justify-between text-sm text-admin-muted">
                            <div>
                              총 {notifyList.total}건 · 페이지 {notifyList.page}
                            </div>
                            <div className="flex gap-2">
                              <button
                                className={buttonGhost}
                                disabled={notifyListLoading || notifyList.page <= 1}
                                onClick={() => fetchNotifyList({ page: Math.max(1, notifyList.page - 1) })}
                              >
                                이전
                              </button>
                              <button
                                className={buttonGhost}
                                disabled={notifyListLoading || !notifyList.has_more}
                                onClick={() => fetchNotifyList({ page: notifyList.page + 1 })}
                              >
                                다음
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                </div>

                {busyKey ? <div className="mt-6 text-sm text-cc-textSub">처리 중이에요: {busyKey}</div> : null}

                <div className="text-center text-cc-textSub text-xs mt-6 lg:mt-auto pb-6 lg:pt-6">
                  <p>© 2025 CC Casino - 관리자 도구</p>
                </div>
              </div>
            </div>
            </main>
          </div>
        </div>
      </div>
      )}
    </>
  );
}

export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/admin/v2/',
      permanent: false,
    },
  };
}
