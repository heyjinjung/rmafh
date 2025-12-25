import { useEffect, useMemo, useState } from 'react';
import { withIdempotency } from '../../lib/apiClient';

const fallbackCards = [
  { label: 'Jobs (24h)', value: '-', delta: '' },
  { label: 'Notifications (24h)', value: '-', delta: '' },
  { label: 'Failed Jobs', value: '-', delta: '' },
];

export default function AdminV2KpiCards({ adminPassword, basePath }) {
  const apiFetch = useMemo(() => withIdempotency({ adminPassword, basePath }), [adminPassword, basePath]);
  const [cards, setCards] = useState(fallbackCards);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [jobsResp, notiResp] = await Promise.all([
          apiFetch('/api/vault/admin/jobs?limit=20').catch(() => null),
          apiFetch('/api/vault/admin/notifications?limit=20').catch(() => null),
        ]);

        const jobs = jobsResp?.data?.items || jobsResp?.data?.jobs || jobsResp?.data || [];
        const notifications = notiResp?.data?.items || notiResp?.data?.notifications || notiResp?.data || [];

        const failedJobs = jobs.filter((j) => (j.status || j.state) === 'FAILED').length;
        const imports = jobs.filter((j) => (j.type || '').includes('IMPORT')).length;
        const cardsData = [
          { label: 'Jobs (recent)', value: jobs.length ? jobs.length.toString() : '0', delta: '' },
          { label: 'Notifications (recent)', value: notifications.length ? notifications.length.toString() : '0', delta: '' },
          { label: 'Failed Jobs', value: failedJobs.toString(), delta: imports ? `${imports} imports` : '' },
        ];
        if (!cancelled) setCards(cardsData);
      } catch (err) {
        if (!cancelled) setCards(fallbackCards);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">{card.label}</p>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="font-ibm text-2xl font-semibold text-[var(--v2-text)]">{card.value}</span>
            <span className="text-xs text-[var(--v2-accent)]">{card.delta}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
