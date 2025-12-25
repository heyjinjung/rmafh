export default function AdminV2ContextPanel() {
  return (
    <aside className="hidden w-[320px] shrink-0 border-l border-[var(--v2-border)] bg-[var(--v2-surface)]/90 p-6 xl:block">
      <div className="sticky top-0 space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">빠른 메뉴</p>
          <div className="mt-3 space-y-2">
            <a href="#top" className="block rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-4 py-3 text-sm font-semibold text-[var(--v2-text)] hover:bg-[var(--v2-surface-3)] transition-colors">
              상단으로
            </a>
            <a href="#users" className="block rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-4 py-3 text-sm font-semibold text-[var(--v2-text)] hover:bg-[var(--v2-surface-3)] transition-colors">
              사용자 관리
            </a>
            <a href="#imports" className="block rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-4 py-3 text-sm font-semibold text-[var(--v2-text)] hover:bg-[var(--v2-surface-3)] transition-colors">
              데이터 가져오기
            </a>
            <a href="#operations" className="block rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-4 py-3 text-sm font-semibold text-[var(--v2-text)] hover:bg-[var(--v2-surface-3)] transition-colors">
              운영 작업
            </a>
            <a href="#notifications" className="block rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface-2)] px-4 py-3 text-sm font-semibold text-[var(--v2-text)] hover:bg-[var(--v2-surface-3)] transition-colors">
              알림 관리
            </a>
          </div>
        </div>

        <div className="pt-4 border-t border-[var(--v2-border)]">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">팁</p>
          <div className="mt-3 rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)]/50 p-4">
            <p className="text-xs text-[var(--v2-text)]">
              좌측의 섹션에서 작업을 선택하고, 상단의 빠른 메뉴로 다른 기능으로 빠르게 이동할 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
