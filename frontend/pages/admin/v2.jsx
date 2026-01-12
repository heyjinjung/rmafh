import Head from 'next/head';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import {
  AdminV2Layout,
  AdminV2KpiCards,
  AdminV2UsersGrid,
  AdminV2ImportsFlow,
  AdminV2NotificationsPanel,
} from '../../components/admin-v2';

const Joyride = dynamic(() => import('react-joyride'), { ssr: false });
const ADMIN_V2_TOUR_STORAGE_KEY = 'admin_v2_tour_seen_v1';

export default function AdminV2Page() {
  const router = useRouter();
  const basePath = router?.basePath || '';
  const [adminPassword, setAdminPassword] = useState('');
  const [userLoggedIn, setUserLoggedIn] = useState(false);
  const [didBoot, setDidBoot] = useState(false);
  const [usersTarget, setUsersTarget] = useState(null);
  const adminV2Enabled = process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED !== 'false';
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tourRun, setTourRun] = useState(false);

  const tourSteps = useMemo(
    () => [
      {
        target: '[data-tour="v2-kpi"]',
        placement: 'bottom',
        title: '요약',
        content: '최근 작업/알림/실패 건수를 한 번에 확인합니다.',
        disableBeacon: true,
      },
      {
        target: '[data-tour="v2-users-search"]',
        placement: 'bottom',
        title: '사용자 찾기',
        content: 'CC ID 또는 닉네임으로 검색하세요. 결과는 아래 표에 뜹니다.',
      },
      {
        target: '[data-tour="v2-users"]',
        placement: 'top',
        title: '사용자 목록',
        content: '표에서 사용자를 클릭하면 오른쪽에 상세/편집 패널이 열립니다.',
      },
      {
        target: '[data-tour="v2-users-detail"]',
        placement: 'left',
        title: '상세/편집',
        content: '오른쪽 패널에서 사용자 정보/상태를 확인하고 필요한 항목만 수정하세요. (비어있으면 표에서 사용자를 먼저 클릭하세요)',
      },
      {
        target: '[data-tour="v2-imports-upload"]',
        placement: 'bottom',
        title: 'CSV 업로드',
        content: '회원정보를 CSV로 올립니다. 먼저 미리보기로 값이 맞는지 확인하세요.',
      },
      {
        target: '[data-tour="v2-imports-apply"]',
        placement: 'top',
        title: '적용',
        content: '오류가 없을 때만 적용됩니다. 적용 전에 파일/행 수를 꼭 확인하세요.',
      },
      {
        target: '[data-tour="v2-logout"]',
        placement: 'left',
        title: '로그아웃',
        content: '작업이 끝나면 로그아웃해서 접근을 종료하세요.',
      },
    ],
    []
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedPassword = sessionStorage.getItem('adminPassword');
    if (savedPassword) {
      setAdminPassword(savedPassword);
    }

    const savedUser = localStorage.getItem('user');
    setUserLoggedIn(Boolean(savedUser));
    setDidBoot(true);
  }, []);

  useEffect(() => {
    if (!didBoot) return;
    if (typeof window === 'undefined') return;
    // 자동 실행은 하지 않음(요청대로 도움말 버튼 트리거)
    // 다만, 저장소 키가 없으면 초기값을 심어둠(추후 버전 관리용)
    if (localStorage.getItem(ADMIN_V2_TOUR_STORAGE_KEY) === null) {
      localStorage.setItem(ADMIN_V2_TOUR_STORAGE_KEY, '0');
    }
  }, [didBoot]);

  useEffect(() => {
    if (!didBoot) return;
    if (userLoggedIn && !adminPassword) {
      router.replace('/');
    }
  }, [didBoot, userLoggedIn, adminPassword, router]);

  if (didBoot && userLoggedIn && !adminPassword) {
    return null;
  }

  // adminPassword가 없으면 비밀번호 입력 창 표시
  if (!adminPassword) {
    return (
      <>
        <Head>
          <title>Vault 어드민 v2 - 로그인</title>
        </Head>
        <div
          className="min-h-screen flex items-center justify-center"
          style={{
            backgroundColor: '#101214',
            backgroundImage:
              'radial-gradient(1200px 700px at 8% -10%, #20381d 0%, transparent 60%), radial-gradient(900px 600px at 90% 0%, #3d2d10 0%, transparent 55%)',
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-[#2b3139] bg-[#161a20] p-8">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-[#e9eef5]">Vault 어드민 v2</h1>
              <p className="mt-2 text-sm text-[#8b9199]">관리자 비밀번호를 입력하세요</p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                setLoading(true);
                const value = e.currentTarget.password.value.trim();

                if (!value) {
                  setLoading(false);
                  return;
                }

                try {
                  // 백엔드 검증 시도 (Admin Users 목록 조회로 권한 확인)
                  const res = await fetch(`${basePath}/api/vault/admin/users?page_size=1`, {
                    headers: {
                      'x-admin-password': value,
                      'x-idempotency-key': `login-check-${Date.now()}`
                    }
                  });

                  if (res.ok) {
                    if (typeof window !== 'undefined') {
                      sessionStorage.setItem('adminPassword', value);
                    }
                    setAdminPassword(value);
                  } else {
                    if (res.status === 401) {
                      throw new Error('비밀번호가 올바르지 않습니다.');
                    } else if (res.status === 403) {
                      throw new Error('접근 권한이 없습니다.');
                    } else {
                      throw new Error(`서버 오류 (${res.status})`);
                    }
                  }
                } catch (err) {
                  setError(err.message || '로그인에 실패했습니다.');
                } finally {
                  setLoading(false);
                }
              }}
            >
              <div className="mb-4">
                <label htmlFor="password" className="block text-xs uppercase tracking-[0.2em] text-[#8b9199] mb-2">
                  비밀번호
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  disabled={loading}
                  placeholder="비밀번호 입력"
                  className="w-full rounded-lg border border-[#2b3139] bg-[#1c2128] px-4 py-3 text-[#e9eef5] placeholder:text-[#8b9199] focus:outline-none focus:ring-2 focus:ring-[#b7f75a]/40 disabled:opacity-50"
                  autoFocus
                />
              </div>

              {error && (
                <div className="mb-4 text-sm text-[var(--v2-warning)] bg-[var(--v2-warning)]/10 p-3 rounded border border-[var(--v2-warning)]/20">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg border border-[#b7f75a] bg-[#b7f75a] px-4 py-2 text-sm font-semibold text-black hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '확인 중...' : '로그인'}
              </button>
            </form>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Vault 어드민 v2</title>
      </Head>
      {didBoot ? (
        <Joyride
          run={tourRun}
          steps={tourSteps}
          continuous
          showSkipButton={false}
          showProgress={false}
          hideCloseButton
          scrollToFirstStep
          scrollDuration={450}
          scrollOffset={120}
          spotlightPadding={10}
          disableOverlayClose
          // 투어 중에도 '하이라이트된 영역'은 클릭 가능해야
          // 사용자 클릭 → 상세 패널 확인 같은 흐름이 막히지 않습니다.
          spotlightClicks
          callback={(data) => {
            const status = String(data?.status || '').toLowerCase();
            const type = String(data?.type || '').toLowerCase();

            if (type === 'error:target_not_found') {
              return;
            }

            if (status === 'finished' || status === 'skipped') {
              setTourRun(false);
              if (typeof window !== 'undefined') {
                localStorage.setItem(ADMIN_V2_TOUR_STORAGE_KEY, '1');
              }
            }
          }}
          locale={{
            back: '이전',
            close: '완료',
            last: '완료',
            next: '다음',
          }}
          styles={{
            options: {
              zIndex: 10000,
              arrowColor: '#161a20',
              backgroundColor: '#161a20',
              overlayColor: 'rgba(0, 0, 0, 0.65)',
              primaryColor: '#b7f75a',
              textColor: '#e9eef5',
              // 툴팁/스포트라이트 이동 체감 개선
              transition: 'all 220ms ease-in-out',
            },
            tooltip: {
              borderRadius: 14,
              boxShadow: '0 20px 70px rgba(0,0,0,0.55)',
            },
            tooltipContainer: {
              padding: 16,
            },
            tooltipTitle: {
              color: '#e9eef5',
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: '0.02em',
            },
            tooltipContent: {
              color: '#e9eef5',
              fontSize: 13,
              lineHeight: 1.55,
            },
            buttonNext: {
              backgroundColor: '#b7f75a',
              color: '#000000',
              fontWeight: 800,
              borderRadius: 10,
              padding: '10px 14px',
            },
            buttonBack: {
              color: '#e9eef5',
              backgroundColor: 'transparent',
              border: '1px solid #2b3139',
              borderRadius: 10,
              padding: '10px 14px',
            },
            buttonSkip: {
              color: '#e9eef5',
              backgroundColor: 'transparent',
              border: '1px solid rgba(233,238,245,0.25)',
              borderRadius: 10,
              padding: '10px 14px',
            },
            spotlight: {
              borderRadius: 14,
              transition: 'all 220ms ease-in-out',
            },
          }}
        />
      ) : null}
      <AdminV2Layout
        active="dashboard"
        onHelp={() => {
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
          setTourRun(true);
        }}
        onLogout={() => {
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('adminPassword');
          }
          setAdminPassword('');
        }}
      >
        <section className="space-y-6">

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">개요</p>
              <h2 className="mt-2 font-ibm text-3xl font-semibold text-[var(--v2-text)]">
                운영 컨트롤
              </h2>
              <p className="mt-2 text-sm text-[var(--v2-muted)]">
                대량 운영 작업과 감사 로그를 한 화면에서 처리합니다.
              </p>
            </div>
            <button
              type="button"
              className="rounded-full border border-[var(--v2-border)] px-4 py-2 text-xs text-[var(--v2-muted)]"
            >
              뷰 저장
            </button>
          </div>

          <AdminV2KpiCards adminPassword={adminPassword} basePath={basePath} />
          <AdminV2UsersGrid
            adminPassword={adminPassword}
            basePath={basePath}
            onTargetChange={setUsersTarget}
          />
          <AdminV2ImportsFlow adminPassword={adminPassword} basePath={basePath} />
        </section>
      </AdminV2Layout>
    </>
  );
}
