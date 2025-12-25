export default function AdminV2TopBar() {
  return (
    <header className="border-b border-[var(--v2-border)] bg-[var(--v2-surface)]/90 px-6 py-4 lg:px-10">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-[240px] flex-1">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Global Search</p>
          <input
            type="search"
            placeholder="Search external_user_id, nickname, user_id"
            className="mt-2 w-full rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-4 py-2 text-sm text-[var(--v2-text)] placeholder:text-[var(--v2-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--v2-accent)]/40"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-4 py-2 text-sm font-semibold text-[var(--v2-text)] hover:border-[var(--v2-accent)]/40"
          >
            New Job
          </button>
          <button
            type="button"
            className="rounded-xl border border-transparent bg-[var(--v2-accent)] px-4 py-2 text-sm font-semibold text-black shadow-[0_0_20px_rgba(183,247,90,0.35)]"
          >
            Quick Import
          </button>
        </div>
      </div>
    </header>
  );
}
