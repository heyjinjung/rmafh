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
