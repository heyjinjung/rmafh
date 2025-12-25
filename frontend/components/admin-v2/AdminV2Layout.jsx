import AdminV2Sidebar from './AdminV2Sidebar';
import AdminV2TopBar from './AdminV2TopBar';
import AdminV2ContextPanel from './AdminV2ContextPanel';

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

export default function AdminV2Layout({ active = 'dashboard', children }) {
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
            <AdminV2TopBar />
            <main className="flex-1 px-6 py-6 lg:px-10">{children}</main>
          </div>
          <AdminV2ContextPanel />
        </div>
      </div>
    </div>
  );
}
