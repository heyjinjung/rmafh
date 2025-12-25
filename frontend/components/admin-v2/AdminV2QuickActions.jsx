const actions = [
  { title: '만료 연장', desc: 'Shadow 미리보기 + 적용', tone: 'accent' },
  { title: '일괄 업데이트', desc: '상태/플래그 변경', tone: 'neutral' },
  { title: '알림 발송', desc: '중복 제거 후 큐 적재', tone: 'neutral' },
];

export default function AdminV2QuickActions() {
  // API 호출 및 피드백 함수
  const handleAction = async (type) => {
    let url = '';
    let body = {};
    switch (type) {
      case '만료 연장':
        url = '/api/vault/admin/jobs';
        body = { jobType: 'EXTEND_EXPIRY' };
        break;
      case '일괄 업데이트':
        url = '/api/vault/admin/jobs';
        body = { jobType: 'BULK_UPDATE' };
        break;
      case '알림 발송':
        url = '/api/vault/admin/jobs';
        body = { jobType: 'NOTIFY' };
        break;
      default:
        return;
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('작업 실패');
      alert(`${type} 작업이 성공적으로 실행되었습니다.`);
    } catch (e) {
      alert(`${type} 작업 중 오류 발생: ${e.message}`);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--v2-border)] bg-[var(--v2-surface)]/80 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">빠른 작업</p>
          <p className="mt-2 text-sm text-[var(--v2-text)]">자주 쓰는 운영 작업을 빠르게 실행합니다.</p>
        </div>
        <span className="rounded-full border border-[var(--v2-border)] px-3 py-1 text-[10px] text-[var(--v2-muted)]">
          바로가기
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {actions.map((action) => (
          <button
            key={action.title}
            type="button"
            className={[ 
              'rounded-xl border px-4 py-3 text-left text-sm font-semibold transition',
              action.tone === 'accent'
                ? 'border-[var(--v2-accent)]/40 bg-[var(--v2-surface-2)] text-[var(--v2-accent)]'
                : 'border-[var(--v2-border)] bg-[var(--v2-surface-2)] text-[var(--v2-text)]',
            ].join(' ')}
            onClick={() => handleAction(action.title)}
          >
            <div>{action.title}</div>
            <div className="mt-1 text-xs font-normal text-[var(--v2-muted)]">{action.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
