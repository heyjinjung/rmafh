import { useEffect, useMemo, useState } from 'react';
import { extractErrorInfo, withIdempotency } from '../../lib/apiClient';
import { pushToast } from './toastBus';

const normalizeJobListItem = (j) => ({
  id: j.job_id,
  type: j.type,
  status: j.status,
  request_id: j.request_id,
  targets: Number(j.target_count || 0),
});

const normalizeJobDetail = (j) => ({
  id: j.job_id,
  processed: Number(j.processed || 0),
  failed: Number(j.failed || 0),
  created_at: j.created_at,
  updated_at: j.updated_at,
  payload: j.payload,
});

const normalizeAudit = (row) => ({
  id: row.id,
  admin_user: row.admin_user,
  action: row.action,
  endpoint: row.endpoint,
  response_status: row.response_status,
  error_message: row.error_message,
  job_id: row.job_id,
  request_id: row.request_id,
  idempotency_key: row.idempotency_key,
  at: row.created_at,
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

  const downloadFailedItemsCsv = async (jobId) => {
    try {
      const res = await fetch(
        `${basePath || ''}/api/vault/admin/jobs/${jobId}/items?format=csv&failed_only=true`,
        {
          method: 'GET',
          headers: {
            ...(adminPassword ? { 'x-admin-password': adminPassword } : {}),
          },
        },
      );

      if (!res.ok) {
        const contentType = res.headers.get('content-type') || '';
        const payload = contentType.includes('application/json') ? await res.json() : await res.text();
        const err = new Error('Download failed');
        err.status = res.status;
        err.payload = payload;
        err.parsed = typeof payload === 'object' ? payload : undefined;
        throw err;
      }

      const cd = res.headers.get('content-disposition') || '';
      const match = cd.match(/filename="?([^";]+)"?/i);
      const filename = match?.[1] || `${jobId}-items-failed.csv`;

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      pushToast({ ok: true, message: 'CSV 다운로드 시작', detail: filename });
    } catch (err) {
      const info = extractErrorInfo(err);
      setError(info.summary || 'CSV 다운로드 실패');
      pushToast({ ok: false, message: info.summary || 'CSV 다운로드 실패', detail: info.requestId || info.detail, requestId: info.requestId, idempotencyKey: info.idempotencyKey });
    }
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobsResp, auditResp] = await Promise.all([
        apiFetch('/api/vault/admin/jobs?page=1&page_size=10&order=desc').catch(() => null),
        apiFetch('/api/vault/admin/audit-log?page=1&page_size=10&order=desc').catch(() => null),
      ]);

      const jobsData = jobsResp?.data?.items || [];
      const auditData = auditResp?.data?.items || [];

      const listItems = jobsData.map(normalizeJobListItem);
      const detailById = new Map();
      await Promise.all(
        listItems.map(async (item) => {
          try {
            const detailResp = await apiFetch(`/api/vault/admin/jobs/${item.id}`);
            const detail = detailResp?.data ? normalizeJobDetail(detailResp.data) : null;
            if (detail) detailById.set(item.id, detail);
          } catch {
            // ignore per-item detail errors; list view still renders
          }
        }),
      );

      setJobs(
        listItems.map((item) => {
          const detail = detailById.get(item.id);
          return {
            ...item,
            processed: detail?.processed ?? 0,
            failed: detail?.failed ?? 0,
            created_at: detail?.created_at,
            updated_at: detail?.updated_at,
          };
        }),
      );
      setAuditRows(auditData.map(normalizeAudit));
    } catch (err) {
      const info = extractErrorInfo(err);
      setError(info.summary || '로드 실패');
      pushToast({ ok: false, message: info.summary || '로드 실패', detail: info.requestId || info.detail, requestId: info.requestId, idempotencyKey: info.idempotencyKey });
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
    const q = String(auditQuery || '').trim();
    const qOk = q
      ? [row.request_id, row.idempotency_key, row.endpoint, row.action, row.job_id].some((v) => String(v || '').includes(q))
      : true;
    const sOk = auditStatus === 'ALL' ? true : row.response_status === auditStatus;
    return qOk && sOk;
  });

  const retryJob = async (jobId) => {
    try {
      await apiFetch(`/api/vault/admin/jobs/${jobId}/retry`, { method: 'POST' });
      load();
    } catch (err) {
      const info = extractErrorInfo(err);
      setError(info.summary || '재시도 실패');
      pushToast({ ok: false, message: info.summary || '재시도 실패', detail: info.requestId || info.detail, requestId: info.requestId, idempotencyKey: info.idempotencyKey });
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
              const canDownloadFailures = Number(job.failed || 0) > 0;
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
                    <span>processed {job.processed ?? 0} · failed {job.failed ?? 0}</span>
                    <span>{job.created_at || 'queued'}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-[var(--v2-border)]">
                    <div
                      className="h-2 rounded-full bg-[var(--v2-accent)]"
                      style={{ width: `${Math.min(100, progress)}%` }}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--v2-text)]">
                    <button className="rounded border border-[var(--v2-border)] px-3 py-1" onClick={() => retryJob(job.id)}>Retry</button>
                    <button className="rounded border border-[var(--v2-border)] px-3 py-1" onClick={load}>Refresh</button>
                    <button
                      className="rounded border border-[var(--v2-border)] px-3 py-1 disabled:opacity-40"
                      disabled={!canDownloadFailures}
                      onClick={() => downloadFailedItemsCsv(job.id)}
                      title={canDownloadFailures ? '실패 아이템 CSV 다운로드' : '실패 아이템이 없습니다'}
                    >
                      Download failures CSV
                    </button>
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
                {['ALL', 'SUCCESS', 'ERROR'].map((s) => (
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
                    <td className="px-3 py-2 font-mono text-[var(--v2-accent)]">{row.idempotency_key || row.request_id || '-'}</td>
                    <td className="px-3 py-2">{row.action} · {row.endpoint || '-'}</td>
                    <td className="px-3 py-2">{row.admin_user || '-'}</td>
                    <td className="px-3 py-2">{row.response_status || '-'}</td>
                    <td className="px-3 py-2">{row.at || '-'}</td>
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
