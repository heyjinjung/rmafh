export default function AdminV2TopBar({ onLogout }) {

  return (
    <header className="border-b border-[var(--v2-border)] bg-[var(--v2-surface)]/90 px-6 py-4 lg:px-10">
      <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-4 py-2 text-sm font-semibold text-[var(--v2-text)] hover:border-[var(--v2-accent)]/40 transition-colors"
          >
            새 작업
          </button>
          <button
            type="button"
            className="rounded-xl border border-transparent bg-[var(--v2-accent)] px-4 py-2 text-sm font-semibold text-black shadow-[0_0_20px_rgba(183,247,90,0.35)] hover:brightness-110 transition-all"
          >
            빠른 가져오기
          </button>
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
      </div>
    </header>
  );
}
