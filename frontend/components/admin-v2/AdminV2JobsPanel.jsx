import { useState } from 'react';

const jobRows = [
  { id: 'job_20251226_001', type: 'EXTEND_EXPIRY', status: 'RUNNING', targets: 1200, done: 420, failed: 2, started_at: '2025-12-26T02:01Z' },
  { id: 'job_20251226_002', type: 'DAILY_IMPORT', status: 'PENDING', targets: 840, done: 0, failed: 0, started_at: null },
  { id: 'job_20251226_003', type: 'NOTIFY', status: 'FAILED', targets: 54, done: 30, failed: 24, started_at: '2025-12-25T23:40Z' },
];

const auditRows = [
  { id: 'audit_701', actor: 'admin@vault', action: 'EXTEND_EXPIRY', target: 'segment:expiring_3d', status: 'OK', request_id: 'req_123', at: '2025-12-26T02:05Z' },
  { id: 'audit_702', actor: 'admin@vault', action: 'NOTIFY', target: 'upload:ids.csv', status: 'FAILED', request_id: 'req_124', at: '2025-12-26T01:55Z' },
  { id: 'audit_703', actor: 'ops@vault', action: 'IMPORT', target: 'file:test.csv', status: 'OK', request_id: 'req_125', at: '2025-12-26T01:40Z' },
];

export default function AdminV2JobsPanel() {
  const [jobFilter, setJobFilter] = useState('ALL');
  const [auditQuery, setAuditQuery] = useState('');
  const [auditStatus, setAuditStatus] = useState('ALL');

  const filteredJobs = jobRows.filter((j) => (jobFilter === 'ALL' ? true : j.status === jobFilter));
  const filteredAudit = auditRows.filter((row) => {
    const qOk = auditQuery ? row.request_id.includes(auditQuery) || row.target.includes(auditQuery) : true;
    const sOk = auditStatus === 'ALL' ? true : row.status === auditStatus;
    return qOk && sOk;
  });

  return (
    <div className="rounded-2xl border border-[var(--v2-border)] bg-[var(--v2-surface)]/80 p-5" id="audit-jobs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Audit & Jobs</p>
          <p className="mt-1 text-sm text-[var(--v2-text)]">Audit trails, job status, retry, and failure downloads.</p>
        </div>
        <div className="flex gap-2 text-xs text-[var(--v2-muted)]">
          <button className="rounded-full border border-[var(--v2-border)] px-3 py-1">Export Audit</button>
          <button className="rounded-full border border-[var(--v2-border)] px-3 py-1">View All</button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Jobs</p>
              <p className="text-sm text-[var(--v2-text)]">Progress, failures, retry hooks.</p>
            </div>
            <select
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value)}
              className="rounded border border-[var(--v2-border)] bg-[var(--v2-surface)] px-2 py-1 text-xs text-[var(--v2-text)]"
            >
              {['ALL', 'PENDING', 'RUNNING', 'FAILED', 'DONE'].map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div className="mt-3 space-y-3">
            {filteredJobs.map((job) => {
              const progress = job.targets ? Math.round((job.done / job.targets) * 100) : 0;
              return (
                <div key={job.id} className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] p-3">
                  <div className="flex items-center justify-between text-xs text-[var(--v2-muted)]">
                    <span>{job.type}</span>
                    <span>{job.status}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm text-[var(--v2-text)]">
                    <span className="font-mono text-[var(--v2-accent)]">{job.id}</span>
                    <span className="text-xs text-[var(--v2-muted)]">{job.targets.toLocaleString()} targets</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-[var(--v2-muted)]">
                    <span>done {job.done} · failed {job.failed}</span>
                    <span>{job.started_at || 'queued'}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-[var(--v2-border)]">
                    <div
                      className="h-2 rounded-full bg-[var(--v2-accent)]"
                      style={{ width: `${Math.min(100, progress)}%` }}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--v2-text)]">
                    <button className="rounded border border-[var(--v2-border)] px-3 py-1">Download Failures</button>
                    <button className="rounded border border-[var(--v2-border)] px-3 py-1">Retry</button>
                    <button className="rounded border border-[var(--v2-border)] px-3 py-1">Refresh</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Audit Log</p>
              <p className="text-sm text-[var(--v2-text)]">Filter by request_id/actor/status.</p>
            </div>
            <div className="flex gap-2 text-xs text-[var(--v2-muted)]">
              <input
                value={auditQuery}
                onChange={(e) => setAuditQuery(e.target.value)}
                placeholder="request_id / target"
                className="w-[150px] rounded border border-[var(--v2-border)] bg-[var(--v2-surface)] px-2 py-1 text-xs text-[var(--v2-text)]"
              />
              <select
                value={auditStatus}
                onChange={(e) => setAuditStatus(e.target.value)}
                className="rounded border border-[var(--v2-border)] bg-[var(--v2-surface)] px-2 py-1 text-xs text-[var(--v2-text)]"
              >
                {['ALL', 'OK', 'FAILED'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 overflow-hidden rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)]">
            <table className="min-w-full table-fixed text-left text-xs">
              <thead className="border-b border-[var(--v2-border)] text-[var(--v2-muted)]">
                <tr>
                  <th className="px-3 py-2">Request</th>
                  <th className="px-3 py-2">Action/Target</th>
                  <th className="px-3 py-2">Actor</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--v2-border)] text-[var(--v2-text)]">
                {filteredAudit.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 font-mono text-[var(--v2-accent)]">{row.request_id}</td>
                    <td className="px-3 py-2">{row.action} · {row.target}</td>
                    <td className="px-3 py-2">{row.actor}</td>
                    <td className="px-3 py-2">{row.status}</td>
                    <td className="px-3 py-2">{row.at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-[var(--v2-muted)]">
            <span>Job/Audit API 연동 전: 스키마 필드 검증용 자리</span>
            <button className="rounded border border-[var(--v2-border)] px-3 py-1">Download</button>
          </div>
        </div>
      </div>
    </div>
  );
}
