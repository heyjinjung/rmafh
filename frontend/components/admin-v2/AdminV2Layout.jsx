import { useEffect, useState } from 'react';
import AdminV2Sidebar from './AdminV2Sidebar';
import AdminV2TopBar from './AdminV2TopBar';

const themeVars = {
  '--v2-bg': '#101214',
  '--v2-surface': '#161a20',
  '--v2-surface-2': '#1c2128',
  '--v2-border': '#2b3139',
  '--v2-accent': '#b7f75a',
  '--v2-accent-2': '#e2c15b',
  '--v2-warning': '#f08c3a',
  '--v2-muted': '#8b9199',
  '--v2-text': '#e9eef5',
};

export default function AdminV2Layout({ active = 'dashboard', children, onLogout, onHelp }) {
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      if (typeof window === 'undefined') return;
      setShowBackToTop(window.scrollY > 240);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => {
    if (typeof window === 'undefined') return;
    const el = document.getElementById('top');
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen text-[var(--v2-text)]" style={themeVars}>
      <div
        className="relative min-h-screen"
        style={{
          backgroundColor: 'var(--v2-bg)',
          backgroundImage:
            'radial-gradient(1200px 700px at 8% -10%, #20381d 0%, transparent 60%), radial-gradient(900px 600px at 90% 0%, #3d2d10 0%, transparent 55%)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="relative z-10 flex min-h-screen">
          <AdminV2Sidebar active={active} />
          <div className="flex min-h-screen flex-1 flex-col">
            <AdminV2TopBar onLogout={onLogout} onHelp={onHelp} />
            <main className="flex-1 px-6 py-6 lg:px-10">
              <div id="top" />
              {children}
            </main>
          </div>
        </div>

        {showBackToTop ? (
          <button
            type="button"
            onClick={scrollToTop}
            aria-label="맨 위로 이동"
            className="fixed bottom-6 right-6 z-50 rounded-full border border-[var(--v2-border)] bg-[var(--v2-surface)]/90 px-4 py-2 text-sm text-[var(--v2-text)] hover:border-[var(--v2-accent)]/40 xl:right-[344px]"
          >
            ↑ 맨 위로
          </button>
        ) : null}
      </div>
    </div>
  );
}
