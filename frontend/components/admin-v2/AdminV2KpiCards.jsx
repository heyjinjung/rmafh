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
  const [badges, setBadges] = useState({ jobs: {}, notifications: {} });
  const [auditMini, setAuditMini] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [jobsResp, notiResp, auditResp] = await Promise.all([
          apiFetch('/api/vault/admin/jobs?page=1&page_size=20&order=desc').catch(() => null),
          apiFetch('/api/vault/admin/notifications?page=1&page_size=20&order=desc').catch(() => null),
          apiFetch('/api/vault/admin/audit-log?page=1&page_size=5&order=desc').catch(() => null),
        ]);

        const jobs = jobsResp?.data?.items || [];
        const notifications = notiResp?.data?.items || [];
        const audits = auditResp?.data?.items || [];

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
          { label: 'Jobs (recent)', value: jobs.length ? jobs.length.toString() : '0', delta: '' },
          { label: 'Notifications (recent)', value: notifications.length ? notifications.length.toString() : '0', delta: '' },
          { label: 'Failed Jobs', value: failedJobs.toString(), delta: imports ? `${imports} imports` : '' },
        ];
        if (!cancelled) {
          setCards(cardsData);
          setBadges({
            jobs: countBy(jobs, 'status'),
            notifications: countBy(notifications, 'status'),
          });
          setAuditMini(audits);
        }
      } catch (err) {
        if (!cancelled) {
          setCards(fallbackCards);
          setBadges({ jobs: {}, notifications: {} });
          setAuditMini([]);
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
            key={card.label}
            className="rounded-2xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">{card.label}</p>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="font-ibm text-2xl font-semibold text-[var(--v2-text)]">{card.value}</span>
              <span className="text-xs text-[var(--v2-accent)]">{card.delta}</span>
            </div>

            {card.label.startsWith('Jobs') ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {renderBadge('PENDING', badges.jobs.PENDING || 0)}
                {renderBadge('RUNNING', badges.jobs.RUNNING || 0)}
                {renderBadge('DONE', badges.jobs.DONE || 0)}
                {renderBadge('FAILED', badges.jobs.FAILED || 0)}
              </div>
            ) : null}

            {card.label.startsWith('Notifications') ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {renderBadge('PENDING', badges.notifications.PENDING || 0)}
                {renderBadge('SENT', badges.notifications.SENT || 0)}
                {renderBadge('FAILED', badges.notifications.FAILED || 0)}
                {renderBadge('DLQ', badges.notifications.DLQ || 0)}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-[var(--v2-border)] bg-[var(--v2-surface)]/80 p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Recent Audit (5)</p>
          <span className="text-xs text-[var(--v2-muted)]">/api/vault/admin/audit-log</span>
        </div>
        <div className="mt-3 overflow-hidden rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface-2)]">
          <table className="min-w-full table-fixed text-left text-xs">
            <thead className="border-b border-[var(--v2-border)] text-[var(--v2-muted)]">
              <tr>
                <th className="px-3 py-2">At</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Endpoint</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--v2-border)] text-[var(--v2-text)]">
              {(auditMini || []).map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2">{row.created_at || '-'}</td>
                  <td className="px-3 py-2">{row.action || '-'}</td>
                  <td className="px-3 py-2">{row.endpoint || '-'}</td>
                  <td className="px-3 py-2">{row.response_status || '-'}</td>
                </tr>
              ))}
              {!auditMini?.length ? (
                <tr>
                  <td className="px-3 py-2 text-[var(--v2-muted)]" colSpan={4}>표시할 감사 로그가 없습니다.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
