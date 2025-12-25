import { useEffect, useMemo, useState } from 'react';
import { withIdempotency } from '../../lib/apiClient';

const fallbackCards = [
  { kind: 'jobs', label: '작업(24시간)', value: '-', delta: '' },
  { kind: 'notifications', label: '알림(24시간)', value: '-', delta: '' },
  { kind: 'failed', label: '실패 작업', value: '-', delta: '' },
];

export default function AdminV2KpiCards({ adminPassword, basePath }) {
  const apiFetch = useMemo(() => withIdempotency({ adminPassword, basePath }), [adminPassword, basePath]);
  const [cards, setCards] = useState(fallbackCards);
  const [badges, setBadges] = useState({ jobs: {}, notifications: {} });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [jobsResp, notiResp] = await Promise.all([
          apiFetch('/api/vault/admin/jobs?page=1&page_size=20&order=desc').catch(() => null),
          apiFetch('/api/vault/admin/notifications?page=1&page_size=20&order=desc').catch(() => null),
        ]);

        const jobs = jobsResp?.data?.items || [];
        const notifications = notiResp?.data?.items || [];

        const countBy = (items, key) => {
          const out = {};
          (items || []).forEach((it) => {
            const v = String(it?.[key] || '').toUpperCase() || 'UNKNOWN';
            out[v] = (out[v] || 0) + 1;
          });
          return out;
        };

        const failedJobs = jobs.filter((j) => String(j.status || '').toUpperCase() === 'FAILED').length;
        const imports = jobs.filter((j) => String(j.type || '').toUpperCase().includes('IMPORT')).length;
        const cardsData = [
          { kind: 'jobs', label: '작업(최근)', value: jobs.length ? jobs.length.toString() : '0', delta: '' },
          { kind: 'notifications', label: '알림(최근)', value: notifications.length ? notifications.length.toString() : '0', delta: '' },
          { kind: 'failed', label: '실패 작업', value: failedJobs.toString(), delta: imports ? `가져오기 ${imports}건` : '' },
        ];
        if (!cancelled) {
          setCards(cardsData);
          setBadges({
            jobs: countBy(jobs, 'status'),
            notifications: countBy(notifications, 'status'),
          });
        }
      } catch (err) {
        if (!cancelled) {
          setCards(fallbackCards);
          setBadges({ jobs: {}, notifications: {} });
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  const renderBadge = (label, value) => (
    <span className="rounded-full border border-[var(--v2-border)] bg-[var(--v2-surface)] px-2 py-0.5 text-[10px] text-[var(--v2-muted)]">
      {label}: {value}
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.kind || card.label}
            className="rounded-2xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">{card.label}</p>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="font-ibm text-2xl font-semibold text-[var(--v2-text)]">{card.value}</span>
              <span className="text-xs text-[var(--v2-accent)]">{card.delta}</span>
            </div>

            {card.kind === 'jobs' ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {renderBadge('대기', badges.jobs.PENDING || 0)}
                {renderBadge('진행', badges.jobs.RUNNING || 0)}
                {renderBadge('완료', badges.jobs.DONE || 0)}
                {renderBadge('실패', badges.jobs.FAILED || 0)}
              </div>
            ) : null}

            {card.kind === 'notifications' ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {renderBadge('대기', badges.notifications.PENDING || 0)}
                {renderBadge('전송됨', badges.notifications.SENT || 0)}
                {renderBadge('실패', badges.notifications.FAILED || 0)}
                {renderBadge('DLQ', badges.notifications.DLQ || 0)}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
