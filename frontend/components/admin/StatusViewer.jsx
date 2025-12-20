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
    second: '2-digit',
  }).format(d);
}

function formatWon(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return `${n.toLocaleString('ko-KR')} 원`;
}

function vaultTitle(tier) {
  if (tier === 'GOLD') return '골드 금고';
  if (tier === 'PLATINUM') return '플래티넘 금고';
  if (tier === 'DIAMOND') return '다이아 금고';
  return `${tier} 금고`;
}

function statusLabel(status) {
  if (status === 'UNLOCKED') return { text: '활성', className: 'text-admin-neon' };
  if (status === 'LOCKED') return { text: '비활성', className: 'text-cc-textSub' };
  if (!status) return { text: '-', className: 'text-cc-textSub' };
  return { text: String(status), className: 'text-cc-textSub' };
}

function ConditionRow({ ok, children }) {
  return <li className={ok ? 'text-admin-neon' : 'text-admin-muted'}>{children}</li>;
}

function VaultCard({ tier, status, amountWon, expiresAt, conditions, cardBase }) {
  const st = statusLabel(status);
  return (
    <div className="mt-4">
      <div className="text-base font-bold text-admin-neon">{vaultTitle(tier)}</div>
      <div className="mt-3 bg-admin-bg border border-admin-border rounded-[8px] p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-admin-muted">상태</div>
            <div className={`text-sm font-semibold ${st.className}`}>{st.text}</div>
          </div>
          <div>
            <div className="text-xs text-admin-muted">금액</div>
            <div className="text-sm font-semibold text-admin-text">{formatWon(amountWon)}</div>
          </div>
          {expiresAt ? (
            <div className="sm:col-span-2">
              <div className="text-xs text-admin-muted">만료일</div>
              <div className="text-sm font-semibold text-admin-text">{formatKoDateTime(expiresAt)}</div>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <div className="text-xs text-admin-muted">해금 조건</div>
            {conditions?.length ? (
              <ul className="mt-1 list-disc pl-5 text-sm space-y-1">
                {conditions.map((c, idx) => (
                  <ConditionRow key={`${tier}-${idx}`} ok={!!c.ok}>
                    {c.label}
                  </ConditionRow>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-admin-text">현재 없음</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function StatusSummary({ statusData, externalUserId }) {
  if (!statusData) {
    return (
      <>
        <h2 className="text-lg font-bold">상태 정보</h2>
        <p className="mt-2 text-sm text-cc-textSub">외부 아이디를 입력하고 상태 조회를 실행하세요.</p>
      </>
    );
  }

  const goldStatus = statusData?.gold_status;
  const platinumStatus = statusData?.platinum_status;
  const expiresAt = statusData?.expires_at;
  const nowAt = statusData?.now;

  const lossBreakdown = statusData?.loss_breakdown || {};
  const goldAmount = lossBreakdown?.GOLD;
  const platinumAmount = lossBreakdown?.PLATINUM;

  const platinumDays = Number(statusData?.platinum_attendance_days || 0);
  const platinumDepositDone = !!statusData?.platinum_deposit_done;
  const platinumReviewDone = !!statusData?.platinum_review_done;

  const platinumConditions = [
    {
      ok: Number.isFinite(platinumAmount) ? platinumAmount >= 20000 : false,
      label: '금고금액 2만원',
    },
    {
      ok: platinumDays >= 3,
      label: `연속 3일 이용하기 (현재 ${platinumDays}/3)`,
    },
    {
      ok: platinumDepositDone,
      label: '1일 5만원 이상 이용하기',
    },
    {
      ok: platinumReviewDone,
      label: '리뷰 1회 이상 작성하기',
    },
  ];

  return (
    <>
      <h2 className="text-lg font-bold">상태 정보</h2>

      <div className="mt-4">
        <div className="text-base font-bold text-admin-neon">사용자 정보</div>
        <div className="mt-3 border-t border-admin-border pt-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="text-admin-muted">사용자 ID</div>
            <div className="sm:col-span-2 font-semibold text-admin-text">-</div>
            <div className="text-admin-muted">외부 ID</div>
            <div className="sm:col-span-2 font-semibold text-admin-text">{externalUserId || '-'}</div>
            <div className="text-admin-muted">생성일</div>
            <div className="sm:col-span-2 font-semibold text-admin-text">{formatKoDateTime(nowAt)}</div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="text-base font-bold text-admin-neon">금고 정보</div>
        <div className="mt-3 border-t border-admin-border pt-3">
          <VaultCard
            tier="GOLD"
            status={goldStatus}
            amountWon={goldAmount}
            expiresAt={goldStatus === 'UNLOCKED' ? expiresAt : null}
            conditions={[]}
            cardBase={null}
          />

          <VaultCard
            tier="PLATINUM"
            status={platinumStatus}
            amountWon={platinumAmount}
            expiresAt={platinumStatus === 'UNLOCKED' ? expiresAt : null}
            conditions={platinumConditions}
            cardBase={null}
          />
        </div>
      </div>
    </>
  );
}

export function StatusViewer({ statusData, cardBase, externalUserId }) {
  return (
    <div className={`${cardBase} p-4 md:p-6`}>
      <StatusSummary statusData={statusData} externalUserId={externalUserId} />
    </div>
  );
}
