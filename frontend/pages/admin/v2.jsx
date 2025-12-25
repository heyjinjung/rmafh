import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/router';
import {
  AdminV2Layout,
  AdminV2KpiCards,
  AdminV2QuickActions,
  AdminV2UsersGrid,
  AdminV2SegmentsPanel,
  AdminV2ImportsFlow,
  AdminV2OperationsPanel,
  AdminV2NotificationsPanel,
} from '../../components/admin-v2';

export default function AdminV2Page() {
  const router = useRouter();
  const basePath = router?.basePath || '';
  const [adminPassword, setAdminPassword] = useState('');
  const [usersTarget, setUsersTarget] = useState(null);
  const [segmentTarget, setSegmentTarget] = useState(null);
  const adminV2Enabled = process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED !== 'false';

  return (
    <>
      <Head>
        <title>Vault 어드민 v2</title>
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
          <AdminV2QuickActions />

          <AdminV2UsersGrid
            adminPassword={adminPassword}
            basePath={basePath}
            onTargetChange={setUsersTarget}
          />
          <AdminV2SegmentsPanel
            adminPassword={adminPassword}
            basePath={basePath}
            onSegmentChange={setSegmentTarget}
          />
          <AdminV2OperationsPanel
            adminPassword={adminPassword}
            basePath={basePath}
            usersTarget={usersTarget}
            segmentTarget={segmentTarget}
          />
          <AdminV2NotificationsPanel adminPassword={adminPassword} basePath={basePath} />
          <AdminV2ImportsFlow adminPassword={adminPassword} basePath={basePath} />
        </section>
      </AdminV2Layout>
    </>
  );
}
