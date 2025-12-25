const jobs = [
  { id: 'job_20251226_001', type: 'EXTEND_EXPIRY', status: 'RUNNING', targets: 1200 },
  { id: 'job_20251226_002', type: 'DAILY_IMPORT', status: 'PENDING', targets: 840 },
  { id: 'job_20251226_003', type: 'NOTIFY', status: 'FAILED', targets: 54 },
];

export default function AdminV2JobsPanel() {
  return (
    <div className="rounded-2xl border border-[var(--v2-border)] bg-[var(--v2-surface)]/80 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Jobs</p>
          <p className="mt-2 text-sm text-[var(--v2-text)]">Track async workloads and retries.</p>
        </div>
        <button
          type="button"
          className="rounded-full border border-[var(--v2-border)] px-4 py-1 text-xs text-[var(--v2-muted)]"
        >
          View All
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-4 py-3"
          >
            <div className="flex items-center justify-between text-xs text-[var(--v2-muted)]">
              <span>{job.type}</span>
              <span>{job.status}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-mono text-sm text-[var(--v2-text)]">{job.id}</span>
              <span className="text-xs text-[var(--v2-muted)]">{job.targets} targets</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
