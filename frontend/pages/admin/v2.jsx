import Head from 'next/head';
import {
  AdminV2Layout,
  AdminV2KpiCards,
  AdminV2QuickActions,
  AdminV2DataGridPreview,
  AdminV2JobsPanel,
} from '../../components/admin-v2';

export default function AdminV2Page() {
  return (
    <>
      <Head>
        <title>Vault Admin v2</title>
      </Head>
      <AdminV2Layout active="dashboard">
        <section className="space-y-6">
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

          <AdminV2KpiCards />
          <AdminV2QuickActions />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <AdminV2DataGridPreview />
            <AdminV2JobsPanel />
          </div>
        </section>
      </AdminV2Layout>
    </>
  );
}
