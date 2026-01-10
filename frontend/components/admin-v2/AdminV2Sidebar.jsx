import Link from 'next/link';

const navItems = [
  { key: 'dashboard', label: '대시보드', href: '#top' },
  { key: 'users', label: '사용자', href: '#users' },
  { key: 'imports', label: '가져오기', href: '#imports' },

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

      </div>
    </aside>
  );
}
