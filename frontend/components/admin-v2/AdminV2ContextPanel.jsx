export default function AdminV2ContextPanel() {
  return (
    <aside className="hidden w-[320px] shrink-0 border-l border-[var(--v2-border)] bg-[var(--v2-surface)]/90 p-6 xl:block">
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Selected Target</p>
          <div className="mt-3 rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4">
            <p className="text-sm font-semibold text-[var(--v2-text)]">No selection yet</p>
            <p className="mt-2 text-xs text-[var(--v2-muted)]">
              Pick users or a segment to see impact stats and recent actions.
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Recent Jobs</p>
          <div className="mt-3 space-y-3">
            {['EXTEND_EXPIRY', 'NOTIFY', 'DAILY_IMPORT'].map((job) => (
              <div
                key={job}
                className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-3"
              >
                <div className="flex items-center justify-between text-xs text-[var(--v2-muted)]">
                  <span>{job}</span>
                  <span>RUNNING</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-[var(--v2-text)]">Job in progress</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
