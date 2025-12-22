import Head from 'next/head';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  CsvUploader,
  ExpiryExtensionForm,
  NotificationForm,
  ReferralReviveForm,
  ResponseViewer,
  StatusViewer,
  UsersListViewer,
} from '../components/admin';

// Figma Assets (URLs are time-limited by Figma)
const ICON_STAR = 'https://www.figma.com/api/mcp/asset/a121fe05-b028-4a40-a525-9af8852b220d';
const ICON_GAME = 'https://www.figma.com/api/mcp/asset/8625e6d9-bea3-4dd6-9416-86f0f54cb37c';
const ICON_TELEGRAM = 'https://www.figma.com/api/mcp/asset/01bcbc61-1f54-4542-8ffb-a7d7bdd11c9c';

export default function AdminPage() {
  const [adminPassword, setAdminPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [externalUserId, setExternalUserId] = useState('');
  const [activeSection, setActiveSection] = useState('status');
  const [busyKey, setBusyKey] = useState('');

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

  const [reviveResponse, setReviveResponse] = useState(null);
  const [reviveLoading, setReviveLoading] = useState(false);
  const [reviveError, setReviveError] = useState(null);
  const [reviveLastCall, setReviveLastCall] = useState(null);

  const [csvResponse, setCsvResponse] = useState(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvError, setCsvError] = useState(null);
  const [csvLastCall, setCsvLastCall] = useState(null);

  const qs = useMemo(() => {
    const params = new URLSearchParams();
    if (externalUserId) params.set('external_user_id', externalUserId);
    const s = params.toString();
    return s ? `?${s}` : '';
  }, [externalUserId]);

  async function callApiRaw(path, init, { key, setLastCall }) {
    setBusyKey(key);
    const method = (init?.method || 'GET').toUpperCase();
    setLastCall({ key, method, path: `${path}${qs}`, at: new Date().toISOString() });

    const headers = { ...(init?.headers || {}) };
    if (isAuthenticated && adminPassword) {
      headers['x-admin-password'] = adminPassword;
    }

    const res = await fetch(`${path}${qs}`, { ...init, headers });
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
    setExtendError(null);
    setExtendResponse(null);
    setExtendLastCall(null);
    setNotifyError(null);
    setNotifyResponse(null);
    setNotifyLastCall(null);
    setReviveError(null);
    setReviveResponse(null);
    setReviveLastCall(null);
    setCsvError(null);
    setCsvResponse(null);
    setCsvLastCall(null);
  };

  return (
    <>
      <Head>
        <title>CC Casino - 관리자 도구</title>
      </Head>

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
                    setIsAuthenticated(true);
                  }
                }}
                className={inputBase}
              />
              <button
                onClick={() => setIsAuthenticated(true)}
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
                  <Link
                    href="/"
                    className="bg-gold-primary text-black rounded-[2.064px] px-[14px] py-[11px] text-[10px] tracking-[-0.2px] leading-[1.058] font-ibmKr"
                  >
                    금고 가이드
                  </Link>
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

                <div className="flex flex-col gap-[20px] items-start">
                  <p className="font-medium leading-[1.15] text-[20px] text-gold-primary">
                    운영 바로가기
                  </p>
                  <div className="flex gap-[10px] flex-wrap">
                    <button
                      type="button"
                      onClick={() => setActiveSection('users')}
                      disabled={!!busyKey}
                      className="bg-black border border-gold-primary/30 text-gold-primary rounded-[4px] px-[10px] py-[18px] w-[157px] h-[99px] sm:w-[163px] sm:h-[107px] flex flex-col items-center justify-center gap-[14px] hover:bg-gold-dark disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <img alt="" src={ICON_STAR} className="h-[30px] w-[30px]" />
                      <div className="font-medium leading-[1.15] text-[18px] sm:text-[20px] text-center">
                        <p className="mb-0">전체</p>
                        <p>회원</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSection('csv')}
                      disabled={!!busyKey}
                      className="bg-black border border-gold-primary/30 text-gold-primary rounded-[4px] px-[10px] py-[18px] w-[157px] h-[99px] sm:w-[163px] sm:h-[107px] flex flex-col items-center justify-center gap-[14px] hover:bg-gold-dark disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <img alt="" src={ICON_GAME} className="h-[30px] w-[30px]" />
                      <div className="font-medium leading-[1.15] text-[18px] sm:text-[20px] text-center">
                        <p className="mb-0">일일</p>
                        <p>업로드</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSection('extend')}
                      disabled={!!busyKey}
                      className="bg-black border border-gold-primary/30 text-gold-primary rounded-[4px] px-[10px] py-[18px] w-[157px] h-[99px] sm:w-[163px] sm:h-[107px] flex flex-col items-center justify-center gap-[14px] hover:bg-gold-dark disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <img alt="" src={ICON_TELEGRAM} className="h-[30px] w-[30px]" />
                      <div className="font-medium leading-[1.15] text-[18px] sm:text-[20px] text-center">
                        <p className="mb-0">만료</p>
                        <p>연장</p>
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
                    <p>CC고객센터 텔레그램</p>
                    <p>CC카지노 바로가기</p>
                    <p>CC카지노 공식 탤래채널</p>
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
                            (async () => {
                              setStatusLoading(true);
                              setStatusError(null);
                              try {
                                const body = await callApiRaw(
                                  '/api/vault/status/',
                                  { method: 'GET' },
                                  { key: 'status', setLastCall: setStatusLastCall }
                                );
                                setStatusData(body);
                              } catch (e) {
                                setStatusError(e?.payload || { 상태코드: 0, 응답: { message: e?.message || '요청에 실패했어요.' } });
                              } finally {
                                setStatusLoading(false);
                                setBusyKey('');
                              }
                            })();
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
                        <button className={sectionButtonClass('csv')} disabled={!!busyKey} onClick={() => setActiveSection('csv')}>
                          엑셀 업로드
                        </button>
                        <button className={sectionButtonClass('extend')} disabled={!!busyKey} onClick={() => setActiveSection('extend')}>
                          만료 연장
                        </button>
                        <button className={sectionButtonClass('notify')} disabled={!!busyKey} onClick={() => setActiveSection('notify')}>
                          알림
                        </button>
                        <button className={sectionButtonClass('revive')} disabled={!!busyKey} onClick={() => setActiveSection('revive')}>
                          추천 revive
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
                        onSelectUser={(userId) => {
                          setExternalUserId(userId);
                          setActiveSection('status');
                        }}
                      />
                    </div>
                  ) : null}

                  {activeSection === 'status' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <StatusViewer statusData={statusData} cardBase={cardBase} externalUserId={externalUserId} />
                      <ResponseViewer
                        title="상태 조회 결과"
                        loading={statusLoading}
                        error={statusError}
                        response={statusData}
                        lastCall={statusLastCall}
                        cardBase={cardBase}
                        actionKey="status"
                      />
                    </div>
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
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                              } catch (e) {
                                setExtendError(e?.payload || { 상태코드: 0, 응답: { message: e?.message || '요청에 실패했어요.' } });
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

                      <ResponseViewer
                        title="만료 연장 결과"
                        loading={extendLoading}
                        error={extendError}
                        response={extendResponse}
                        lastCall={extendLastCall}
                        cardBase={cardBase}
                        actionKey="extend-expiry"
                      />
                    </div>
                  ) : null}

                  {activeSection === 'notify' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                              } catch (e) {
                                setNotifyError(e?.payload || { 상태코드: 0, 응답: { message: e?.message || '요청에 실패했어요.' } });
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

                      <ResponseViewer
                        title="알림 요청 결과"
                        loading={notifyLoading}
                        error={notifyError}
                        response={notifyResponse}
                        lastCall={notifyLastCall}
                        cardBase={cardBase}
                        actionKey="notify"
                      />
                    </div>
                  ) : null}

                  {activeSection === 'revive' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className={`${cardBase} p-3 md:p-4`}>
                        <ReferralReviveForm
                          externalUserId={externalUserId}
                          onSubmit={(payload) => {
                            (async () => {
                              setReviveLoading(true);
                              setReviveError(null);
                              setReviveResponse(null);
                              try {
                                const body = await callApiRaw(
                                  '/api/vault/referral-revive/',
                                  {
                                    method: 'POST',
                                    headers: { 'content-type': 'application/json' },
                                    body: JSON.stringify(payload),
                                  },
                                  { key: 'referral-revive', setLastCall: setReviveLastCall }
                                );
                                setReviveResponse(body);
                              } catch (e) {
                                setReviveError(e?.payload || { 상태코드: 0, 응답: { message: e?.message || '요청에 실패했어요.' } });
                              } finally {
                                setReviveLoading(false);
                                setBusyKey('');
                              }
                            })();
                          }}
                          loading={reviveLoading || !!busyKey}
                          inputBase={inputBase}
                          buttonBase={buttonBase}
                          buttonGhost={buttonGhost}
                        />
                      </div>

                      <ResponseViewer
                        title="추천 revive 결과"
                        loading={reviveLoading}
                        error={reviveError}
                        response={reviveResponse}
                        lastCall={reviveLastCall}
                        cardBase={cardBase}
                        actionKey="referral-revive"
                      />
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
