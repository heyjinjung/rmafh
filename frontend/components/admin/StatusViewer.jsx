function formatKoDateTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

function statusBadge(status) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border';
  if (status === 'UNLOCKED') return <span className={`${base} border-admin-neon text-admin-neon`}>활성</span>;
  if (status === 'LOCKED') return <span className={`${base} border-admin-border text-admin-muted`}>비활성</span>;
  if (status === 'CLAIMED') return <span className={`${base} border-blue-400/60 text-blue-300`}>수령완료</span>;
  if (status === 'EXPIRED') return <span className={`${base} border-red-500/60 text-red-400`}>만료</span>;
  return <span className={`${base} border-admin-border text-admin-muted`}>{status || '-'}</span>;
}

function InfoRow({ label, value }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <div className="text-admin-muted">{label}</div>
      <div className="col-span-2 font-semibold text-admin-text">{value}</div>
    </div>
  );
}

function VaultRow({ title, status, children }) {
  return (
    <div className="border border-admin-border rounded-[8px] p-3 bg-admin-bg">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-admin-neon">{title}</div>
        {statusBadge(status)}
      </div>
      {children ? <div className="mt-3 text-sm text-admin-text space-y-1">{children}</div> : null}
    </div>
  );
}

export function StatusViewer({ statusData, cardBase, externalUserId }) {
  if (!statusData) {
    return (
      <div className={`${cardBase} p-4 md:p-6`}>
        <h2 className="text-lg font-bold">상태 정보</h2>
        <p className="mt-2 text-sm text-cc-textSub">외부 아이디를 입력하고 상태 조회를 실행하세요.</p>
      </div>
    );
  }

  const joined = statusData.joined_date || statusData.created_at;
  const expires = statusData.expires_at;

  return (
    <div className={`${cardBase} p-4 md:p-6`}>
      <h2 className="text-lg font-bold">상태 정보</h2>

      <div className="mt-4 space-y-2">
        <div className="text-base font-bold text-admin-neon">사용자 정보</div>
        <InfoRow label="외부 ID" value={statusData.external_user_id || externalUserId || '-'} />
        <InfoRow label="닉네임" value={statusData.nickname || '-'} />
        <InfoRow label="가입일" value={formatKoDateTime(joined)} />
        <InfoRow label="등록일" value={formatKoDateTime(statusData.created_at)} />
        <InfoRow
          label="텔레그램 / 리뷰"
          value={`${statusData.telegram_ok ? '✓' : '-'} / ${statusData.review_ok ? '✓' : '-'}`}
        />
      </div>

      <div className="mt-6 space-y-3">
        <div className="text-base font-bold text-admin-neon">금고 정보</div>

        <VaultRow title="골드 금고" status={statusData.gold_status}>
          <div>만료일: {expires ? formatKoDateTime(expires) : '-'}</div>
        </VaultRow>

        <VaultRow title="플래티넘 금고" status={statusData.platinum_status}>
          <div>
            출석: {statusData.platinum_attendance_days ?? 0}일
          </div>
          <div>입금(15만): {(statusData.platinum_attendance_days ?? 0) >= 3 ? '완료' : '미완료'}</div>
          <div>리뷰: {statusData.review_ok ? '완료' : '미완료'}</div>
          <div>만료일: {expires ? formatKoDateTime(expires) : '-'}</div>
        </VaultRow>

        <VaultRow title="다이아 금고" status={statusData.diamond_status}>
          <div>누적 입금: {(statusData.diamond_deposit_current ?? 0).toLocaleString('ko-KR')} 원</div>
          <div>만료일: {expires ? formatKoDateTime(expires) : '-'}</div>
        </VaultRow>
      </div>
    </div>
  );
}
