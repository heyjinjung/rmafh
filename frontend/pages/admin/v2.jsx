import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  AdminV2Layout,
  AdminV2KpiCards,
  AdminV2UsersGrid,
  AdminV2ImportsFlow,
  AdminV2NotificationsPanel,
} from '../../components/admin-v2';

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
      <AdminV2Layout
        active="dashboard"
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
