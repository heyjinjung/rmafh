const columns = [
  'external_user_id',
  'nickname',
  'status',
  'attendance',
  'deposit_total',
  'expires_at',
];

const rows = [
  {
    external_user_id: 'ext-1024',
    nickname: '사용자 1024',
    status: 'UNLOCKED',
    attendance: '2 / 5',
    deposit_total: '120,000',
    expires_at: '2025-12-30',
  },
  {
    external_user_id: 'ext-2048',
    nickname: '사용자 2048',
    status: 'LOCKED',
    attendance: '0 / 3',
    deposit_total: '45,000',
    expires_at: '2025-12-29',
  },
  {
    external_user_id: 'ext-4096',
    nickname: '사용자 4096',
    status: 'EXPIRED',
    attendance: '3 / 7',
    deposit_total: '580,000',
    expires_at: '2025-12-18',
  },
];

export default function AdminV2DataGridPreview() {
  return (
    <div className="rounded-2xl border border-[var(--v2-border)] bg-[var(--v2-surface)]/80 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">사용자</p>
          <p className="mt-2 text-sm text-[var(--v2-text)]">필터/세그먼트가 포함된 고밀도 그리드 미리보기.</p>
        </div>
        <button
          type="button"
          className="rounded-full border border-[var(--v2-border)] px-4 py-1 text-xs text-[var(--v2-muted)]"
        >
          컬럼 설정
        </button>
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-[var(--v2-border)]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--v2-surface-2)] text-[var(--v2-muted)]">
            <tr>
              {columns.map((col) => (
                <th key={col} className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em]">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--v2-border)]">
            {rows.map((row) => (
              <tr key={row.external_user_id} className="hover:bg-[var(--v2-surface-2)]/60">
                <td className="px-4 py-3 font-mono text-[var(--v2-accent)]">{row.external_user_id}</td>
                <td className="px-4 py-3">{row.nickname}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full border border-[var(--v2-border)] px-3 py-1 text-xs">
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3">{row.attendance}</td>
                <td className="px-4 py-3">{row.deposit_total}</td>
                <td className="px-4 py-3">{row.expires_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
