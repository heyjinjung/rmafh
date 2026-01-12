export default function AdminV2TopBar({ onLogout, onHelp }) {
  return (
    <header className="border-b border-[var(--v2-border)] bg-[var(--v2-surface)]/90 px-6 py-4 lg:px-10">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {onHelp ? (
          <button
            type="button"
            onClick={onHelp}
            data-tour="v2-help"
            className="rounded-xl border border-[var(--v2-border)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--v2-text)] hover:border-[var(--v2-accent)]/40 hover:bg-[var(--v2-surface-2)] transition-colors"
          >
            도움말
          </button>
        ) : null}

        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            data-tour="v2-logout"
            className="rounded-xl border border-[var(--v2-warning)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--v2-warning)] hover:bg-[var(--v2-warning)]/10 transition-colors"
          >
            로그아웃
          </button>
        )}
      </div>
    </header>
  );
}
