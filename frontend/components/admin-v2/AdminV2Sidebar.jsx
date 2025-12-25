import Link from 'next/link';

const navItems = [
  { key: 'dashboard', label: '대시보드', href: '#top' },
  { key: 'users', label: '사용자', href: '#users' },
  { key: 'imports', label: '가져오기', href: '#imports' },
  { key: 'operations', label: '운영', href: '#operations' },
  { key: 'notifications', label: '알림', href: '#notifications' },
];

export default function AdminV2Sidebar({ active }) {
  const handleNavClick = (href) => {
    if (href.startsWith('#')) {
      const el = document.getElementById(href.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  return (
    <aside className="w-64 shrink-0 border-r border-[var(--v2-border)] bg-[var(--v2-surface)]/90 p-6">
      <div className="sticky top-0 space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">메뉴</p>
          <nav className="mt-4 space-y-2">
            {navItems.map((item) => {
              const isActive = active === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => handleNavClick(item.href)}
                  className={[
                    'w-full text-left rounded-lg border px-4 py-3 text-sm font-semibold transition-colors',
                    isActive
                      ? 'border-[var(--v2-accent)]/60 bg-[var(--v2-accent)]/10 text-[var(--v2-accent)]'
                      : 'border-[var(--v2-border)] bg-[var(--v2-surface-2)] text-[var(--v2-text)] hover:bg-[var(--v2-surface-3)]',
                  ].join(' ')}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
        <div className="pt-4 border-t border-[var(--v2-border)]">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">정보</p>
          <div className="mt-3 rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface-2)]/50 p-3">
            <p className="text-xs text-[var(--v2-text)]">Admin v2 콘솔</p>
            <p className="mt-2 text-xs text-[var(--v2-muted)]">좌측 메뉴에서 섹션을 선택하고 작업하세요.</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
