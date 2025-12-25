import { useEffect, useMemo, useState } from 'react';
import { withIdempotency } from '../../lib/apiClient';

const normalizeJob = (j) => ({
  id: j.job_id || j.id,
  type: j.type,
  status: j.status || j.state,
  targets: j.target_count ?? j.total ?? j.targets ?? 0,
  done: j.done ?? j.success ?? j.completed ?? 0,
  failed: j.failed ?? j.errors ?? j.failures ?? 0,
  started_at: j.started_at || j.created_at,
  updated_at: j.updated_at,
  failure_download_url: j.failures_csv || j.failure_download_url,
});

const normalizeAudit = (row) => ({
  id: row.id,
  actor: row.actor || row.admin || row.user,
  action: row.action,
  target: row.target,
  status: row.status,
  request_id: row.request_id || row.idempotency_key,
  at: row.created_at || row.at,
});

export default function AdminV2JobsPanel({ adminPassword, basePath }) {
  const apiFetch = useMemo(() => withIdempotency({ adminPassword, basePath }), [adminPassword, basePath]);
  const [jobFilter, setJobFilter] = useState('ALL');
  const [auditQuery, setAuditQuery] = useState('');
  const [auditStatus, setAuditStatus] = useState('ALL');
  const [jobs, setJobs] = useState([]);
  const [auditRows, setAuditRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobsResp, auditResp] = await Promise.all([
        apiFetch('/api/vault/admin/jobs?limit=10').catch(() => null),
        apiFetch('/api/vault/admin/audit?limit=10').catch(() => null),
      ]);

      const jobsData = jobsResp?.data?.items || jobsResp?.data?.jobs || jobsResp?.data || [];
      const auditData = auditResp?.data?.items || auditResp?.data?.logs || auditResp?.data || [];

      setJobs(jobsData.map(normalizeJob));
      setAuditRows(auditData.map(normalizeAudit));
    } catch (err) {
      setError(err?.parsed?.summary || err?.message || '로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredJobs = jobs.filter((j) => (jobFilter === 'ALL' ? true : j.status === jobFilter));
  const filteredAudit = auditRows.filter((row) => {
    const qOk = auditQuery ? (row.request_id || '').includes(auditQuery) || (row.target || '').includes(auditQuery) : true;
    const sOk = auditStatus === 'ALL' ? true : row.status === auditStatus;
    return qOk && sOk;
  });

  const retryJob = async (jobId) => {
    try {
      await apiFetch(`/api/vault/admin/jobs/${jobId}/retry`, { method: 'POST' });
      load();
    } catch (err) {
      setError(err?.parsed?.summary || err?.message);
    }
  };

  const downloadFailures = (job) => {
    if (job.failure_download_url && typeof window !== 'undefined') {
      window.open(job.failure_download_url, '_blank');
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--v2-border)] bg-[var(--v2-surface)]/80 p-5" id="audit-jobs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Audit & Jobs</p>
          <p className="mt-1 text-sm text-[var(--v2-text)]">Audit trails, job status, retry, and failure downloads.</p>
        </div>
        <div className="flex gap-2 text-xs text-[var(--v2-muted)]">
          <button className="rounded-full border border-[var(--v2-border)] px-3 py-1" onClick={load}>Refresh</button>
          <button className="rounded-full border border-[var(--v2-border)] px-3 py-1">Export Audit</button>
        </div>
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-[var(--v2-muted)]">불러오는 중...</p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-[var(--v2-warning)]">{error}</p>
      ) : null}

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
                    <button className="rounded border border-[var(--v2-border)] px-3 py-1" onClick={() => downloadFailures(job)}>Download Failures</button>
                    <button className="rounded border border-[var(--v2-border)] px-3 py-1" onClick={() => retryJob(job.id)}>Retry</button>
                    <button className="rounded border border-[var(--v2-border)] px-3 py-1" onClick={load}>Refresh</button>
                  </div>
                </div>
              );
            })}
            {filteredJobs.length === 0 ? (
              <p className="text-sm text-[var(--v2-muted)]">표시할 Job이 없습니다.</p>
            ) : null}
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
                {filteredAudit.length === 0 ? (
                  <tr>
                    <td className="px-3 py-2 text-[var(--v2-muted)]" colSpan={5}>표시할 감사 로그가 없습니다.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-[var(--v2-muted)]">
            <span>request_id / idempotency 키 추적용</span>
            <button className="rounded border border-[var(--v2-border)] px-3 py-1" onClick={load}>Reload</button>
          </div>
        </div>
      </div>
    </div>
  );
}
