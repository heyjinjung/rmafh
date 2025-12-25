import Link from 'next/link';

const navItems = [
  { key: 'dashboard', label: '대시보드', href: '/admin/v2' },
  { key: 'users', label: '사용자', href: '/admin/v2#users' },
  { key: 'imports', label: '가져오기', href: '/admin/v2#imports' },
  { key: 'operations', label: '운영', href: '/admin/v2#operations' },
  { key: 'notifications', label: '알림', href: '/admin/v2#notifications' },
  { key: 'audit', label: '감사/작업', href: '/admin/v2#audit' },
];

export default function AdminV2Sidebar({ active }) {
  return (
    <aside className="hidden w-[240px] shrink-0 border-r border-[var(--v2-border)] bg-[var(--v2-surface)]/90 p-6 lg:block">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">관리자 콘솔</p>
          <h1 className="mt-2 font-ibm text-xl font-semibold text-[var(--v2-accent)]">Vault v2</h1>
        </div>
        <span className="rounded-full border border-[var(--v2-border)] bg-black/40 px-2 py-1 text-[10px] text-[var(--v2-muted)]">
          v2
        </span>
      </div>

      <nav className="mt-8 space-y-1">
        {navItems.map((item) => {
          const isActive = active === item.key;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={[
                'flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium transition',
                isActive
                  ? 'border-[var(--v2-accent)]/40 bg-[var(--v2-surface-2)] text-[var(--v2-accent)]'
                  : 'border-transparent text-[var(--v2-text)] hover:border-[var(--v2-border)] hover:bg-[var(--v2-surface-2)]',
              ].join(' ')}
            >
              <span>{item.label}</span>
              <span className="text-[10px] text-[var(--v2-muted)]">↗</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-10 rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">빠른 상태</p>
        <div className="mt-3 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[var(--v2-muted)]">대기 작업</span>
            <span className="font-semibold text-[var(--v2-accent)]">12</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--v2-muted)]">오늘 실패</span>
            <span className="font-semibold text-[var(--v2-warning)]">2</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
