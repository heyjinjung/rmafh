const actions = [
  { title: 'Extend Expiry', desc: 'Shadow preview + apply', tone: 'accent' },
  { title: 'Bulk Update', desc: 'Statuses & flags', tone: 'neutral' },
  { title: 'Notify', desc: 'Queue with dedup', tone: 'neutral' },
];

export default function AdminV2QuickActions() {
  return (
    <div className="rounded-2xl border border-[var(--v2-border)] bg-[var(--v2-surface)]/80 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Quick Actions</p>
          <p className="mt-2 text-sm text-[var(--v2-text)]">Launch common admin workflows.</p>
        </div>
        <span className="rounded-full border border-[var(--v2-border)] px-3 py-1 text-[10px] text-[var(--v2-muted)]">
          Shortcuts
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {actions.map((action) => (
          <button
            key={action.title}
            type="button"
            className={[
              'rounded-xl border px-4 py-3 text-left text-sm font-semibold transition',
              action.tone === 'accent'
                ? 'border-[var(--v2-accent)]/40 bg-[var(--v2-surface-2)] text-[var(--v2-accent)]'
                : 'border-[var(--v2-border)] bg-[var(--v2-surface-2)] text-[var(--v2-text)]',
            ].join(' ')}
          >
            <div>{action.title}</div>
            <div className="mt-1 text-xs font-normal text-[var(--v2-muted)]">{action.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
