export default function AdminV2ContextPanel() {
  return (
    <aside className="hidden w-[320px] shrink-0 border-l border-[var(--v2-border)] bg-[var(--v2-surface)]/90 p-6 xl:block">
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">선택된 대상</p>
          <div className="mt-3 rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4">
            <p className="text-sm font-semibold text-[var(--v2-text)]">아직 선택된 항목이 없습니다</p>
            <p className="mt-2 text-xs text-[var(--v2-muted)]">
              사용자 또는 세그먼트를 선택하면 영향 통계와 최근 작업을 볼 수 있어요.
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">최근 작업</p>
          <div className="mt-3 space-y-3">
            {['EXTEND_EXPIRY', 'NOTIFY', 'DAILY_IMPORT'].map((job) => (
              <div
                key={job}
                className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-3"
              >
                <div className="flex items-center justify-between text-xs text-[var(--v2-muted)]">
                  <span>{job}</span>
                  <span>진행 중</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-[var(--v2-text)]">작업 실행 중</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
