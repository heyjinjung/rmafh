import Head from 'next/head';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import {
  AdminV2Layout,
  AdminV2KpiCards,
  AdminV2QuickActions,
  AdminV2JobsPanel,
  AdminV2UsersGrid,
  AdminV2SegmentsPanel,
  AdminV2ImportsFlow,
  AdminV2OperationsPanel,
  AdminV2NotificationsPanel,
  AdminV2CommonUxPanel,
} from '../../components/admin-v2';
import { withIdempotency } from '../../lib/apiClient';

export default function AdminV2Page() {
  const router = useRouter();
  const basePath = router?.basePath || '';
  const [adminPassword, setAdminPassword] = useState('');
  const [pingResult, setPingResult] = useState(null);
  const adminV2Enabled = process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED !== 'false';

  const apiFetch = useMemo(
    () => withIdempotency({ adminPassword, basePath }),
    [adminPassword, basePath],
  );

  const pingHealth = async () => {
    setPingResult({ loading: true });
    try {
      const { data, idempotencyKey, idempotencyStatus } = await apiFetch('/health');
      setPingResult({ ok: true, data, idempotencyKey, idempotencyStatus });
    } catch (err) {
      setPingResult({ ok: false, error: err?.payload || err?.message, idempotencyKey: err?.idempotencyKey });
    }
  };

  return (
    <>
      <Head>
        <title>Vault Admin v2</title>
      </Head>
      <AdminV2Layout active="dashboard">
        <section className="space-y-6">
          {!adminV2Enabled ? (
            <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-warning)]/10 px-4 py-3 text-sm text-[var(--v2-text)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[var(--v2-warning)]">NEXT_PUBLIC_ADMIN_V2_ENABLED=false · v2는 프리뷰 전환 상태입니다.</span>
                <Link href="/admin" className="text-[var(--v2-text)] underline">
                  /admin 으로 이동
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)]/70 px-4 py-3 text-sm text-[var(--v2-muted)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>v2 플래그 ON · 필요 시 /admin 으로 즉시 전환 가능합니다.</span>
                <Link href="/admin" className="text-[var(--v2-accent)] underline">
                  Legacy 콘솔 보기
                </Link>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Overview</p>
              <h2 className="mt-2 font-ibm text-3xl font-semibold text-[var(--v2-text)]">
                Operations Command
              </h2>
              <p className="mt-2 text-sm text-[var(--v2-muted)]">
                Consolidated view for high-volume admin tasks and audit trails.
              </p>
            </div>
            <button
              type="button"
              className="rounded-full border border-[var(--v2-border)] px-4 py-2 text-xs text-[var(--v2-muted)]"
            >
              Save View
            </button>
          </div>

          <AdminV2KpiCards adminPassword={adminPassword} basePath={basePath} />
          <AdminV2QuickActions />

          <AdminV2UsersGrid adminPassword={adminPassword} basePath={basePath} />
          <AdminV2SegmentsPanel />
          <AdminV2OperationsPanel />
          <AdminV2NotificationsPanel adminPassword={adminPassword} basePath={basePath} />
          <AdminV2ImportsFlow />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="rounded-2xl border border-[var(--v2-border)] bg-[var(--v2-surface)]/80 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Idempotent Client</p>
                  <p className="mt-1 text-sm text-[var(--v2-text)]">
                    withIdempotency 래퍼로 공통 API 호출 + 헤더 세팅 예시.
                  </p>
                </div>
                <span className="rounded-full border border-[var(--v2-border)] px-3 py-1 text-[10px] text-[var(--v2-muted)]">/health</span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_1fr]">
                <div>
                  <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Admin Password</label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="x-admin-password"
                    className="mt-2 w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-3 py-2 text-sm text-[var(--v2-text)] placeholder:text-[var(--v2-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--v2-accent)]/40"
                  />
                  <button
                    type="button"
                    onClick={pingHealth}
                    className="mt-3 inline-flex items-center justify-center rounded-lg border border-[var(--v2-accent)] bg-[var(--v2-accent)] px-4 py-2 text-sm font-semibold text-black shadow-[0_0_20px_rgba(183,247,90,0.35)] hover:brightness-105"
                  >
                    Health 호출 (Idempotent)
                  </button>
                </div>
                <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-3 text-sm text-[var(--v2-text)]">
                  {pingResult?.loading ? (
                    <p className="text-[var(--v2-muted)]">요청 중...</p>
                  ) : pingResult ? (
                    <div className="space-y-1">
                      <div className="text-[var(--v2-muted)]">idempotency-key: {pingResult.idempotencyKey}</div>
                      {pingResult.idempotencyStatus ? (
                        <div className="text-[var(--v2-muted)]">status: {pingResult.idempotencyStatus}</div>
                      ) : null}
                      {pingResult.ok ? (
                        <pre className="mt-1 whitespace-pre-wrap rounded border border-[var(--v2-border)] bg-[var(--v2-surface)] p-2 text-xs text-[var(--v2-accent)]">{JSON.stringify(pingResult.data, null, 2)}</pre>
                      ) : (
                        <pre className="mt-1 whitespace-pre-wrap rounded border border-[var(--v2-border)] bg-[var(--v2-surface)] p-2 text-xs text-[var(--v2-warning)]">{JSON.stringify(pingResult.error, null, 2)}</pre>
                      )}
                    </div>
                  ) : (
                    <p className="text-[var(--v2-muted)]">호출 결과가 여기 표시됩니다.</p>
                  )}
                </div>
              </div>
            </div>
            <AdminV2JobsPanel adminPassword={adminPassword} basePath={basePath} />
          </div>

          <AdminV2CommonUxPanel />
        </section>
      </AdminV2Layout>
    </>
  );
}
