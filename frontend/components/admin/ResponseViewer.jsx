import { safeJsonPretty } from './utils';

function formatKoDateTime(value) {
  if (!value) return '-';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
}

function asNumber(v) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function actionSummary(actionKey, response) {
  if (!actionKey || !response || typeof response !== 'object') return [];

  if (actionKey === 'notify') {
    const enqueued = asNumber(response.enqueued);
    return [{ label: '알림 등록', value: enqueued != null ? `${enqueued}건` : '완료' }];
  }

  if (actionKey === 'extend-expiry') {
    const shadow = Boolean(response.shadow);
    if (shadow) {
      const candidates = asNumber(response.candidates);
      const sampleCount = Array.isArray(response.sample_user_ids) ? response.sample_user_ids.length : null;
      return [
        { label: '실행 모드', value: '미리보기(Shadow)' },
        { label: '대상 추정', value: candidates != null ? `${candidates}명` : '-' },
        { label: '샘플 사용자', value: sampleCount != null ? `${sampleCount}명` : '-' },
      ];
    }

    const updated = asNumber(response.updated);
    const newExpiresAt = response.new_expires_at;
    return [
      { label: '실행 모드', value: '적용' },
      { label: '연장 처리', value: updated != null ? `${updated}명` : '완료' },
      { label: '새 만료일', value: formatKoDateTime(newExpiresAt) },
    ];
  }

  if (actionKey === 'referral-revive') {
    const revived = response.revived;
    const expiresAt = response.expires_at;
    return [
      { label: '추천 리바이브', value: revived ? '성공' : '미적용' },
      { label: '만료일', value: formatKoDateTime(expiresAt) },
    ];
  }

  if (actionKey === 'user-daily-import') {
    const rows = asNumber(response.total_rows) ?? asNumber(response.rows) ?? asNumber(response.imported_rows);
    const updated = asNumber(response.updated);
    const created = asNumber(response.created);
    const skipped = asNumber(response.skipped);
    const failed = asNumber(response.failed);
    const items = [];
    if (rows != null) items.push({ label: '처리 행', value: `${rows}건` });
    if (created != null) items.push({ label: '신규 생성', value: `${created}건` });
    if (updated != null) items.push({ label: '업데이트', value: `${updated}건` });
    if (skipped != null) items.push({ label: '건너뜀', value: `${skipped}건` });
    if (failed != null) items.push({ label: '실패', value: `${failed}건` });
    return items.length > 0 ? items : [{ label: '업로드', value: '완료' }];
  }

  return [];
}

function KpiGrid({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((it) => (
        <div key={it.label} className="border border-gold-primary/30 rounded-[4px] p-3 bg-black">
          <div className="text-xs text-cc-textSub">{it.label}</div>
          <div className="mt-1 text-sm font-bold text-white">{it.value}</div>
        </div>
      ))}
    </div>
  );
}

export function ResponseViewer({
  title,
  loading,
  error,
  response,
  lastCall,
  cardBase,
  actionKey,
}) {
  const summaryItems = actionSummary(actionKey, response);
  const hasAny = loading || error || response;
  if (!hasAny) {
    return (
      <div className={`${cardBase} p-4 md:p-6`}>
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="mt-2 text-sm text-cc-textSub">아직 실행한 요청이 없어요.</p>
      </div>
    );
  }

  return (
    <div className={`${cardBase} p-4 md:p-6`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">{title}</h3>
        <span className="text-xs text-cc-textSub">(응답이 길면 스크롤로 내려서 볼 수 있어요)</span>
      </div>

      {lastCall ? (
        <div className="mt-3 text-xs text-cc-textSub">
          마지막 요청: <span className="text-white">{lastCall.method}</span>{' '}
          <span className="text-white">{lastCall.path}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 border border-gold-primary/30 rounded-[4px] p-4 bg-black">
          <div className="text-sm font-bold mb-2 text-cc-textSub">처리 중...</div>
          <div className="text-xs text-cc-textSub">요청이 완료되면 결과가 표시돼요.</div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 bg-black border border-gold-primary/30 rounded-[4px] p-4">
          <div className="text-sm font-bold mb-2 text-cc-textSub">에러가 났어요</div>
          <pre className="text-xs whitespace-pre-wrap break-words text-white">{safeJsonPretty(error)}</pre>
        </div>
      ) : null}

      {response ? (
        <>
          {summaryItems.length > 0 ? (
            <div className="mt-4">
              <div className="text-sm font-bold text-cc-textSub">결과 요약</div>
              <KpiGrid items={summaryItems} />
            </div>
          ) : (
            <div className="mt-4 bg-black border border-gold-primary/30 rounded-[4px] p-4">
              <div className="text-sm font-bold mb-2 text-cc-textSub">성공 결과</div>
              <pre className="text-xs whitespace-pre-wrap break-words text-white">{safeJsonPretty(response)}</pre>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
