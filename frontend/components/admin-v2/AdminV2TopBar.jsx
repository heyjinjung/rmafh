export default function AdminV2TopBar({ onLogout }) {

  return (
    <header className="border-b border-[var(--v2-border)] bg-[var(--v2-surface)]/90 px-6 py-4 lg:px-10">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="rounded-xl border border-[var(--v2-warning)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--v2-warning)] hover:bg-[var(--v2-warning)]/10 transition-colors"
          >
            로그아웃
          </button>
        )}
      </div>
    </header>
  );
}
