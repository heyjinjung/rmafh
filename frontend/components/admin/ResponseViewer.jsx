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

function getNested(obj, path) {
  if (!obj || typeof obj !== 'object') return undefined;
  return path
    .split('.')
    .reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), obj);
}

function extractErrorMeta(error) {
  const statusCode =
    asNumber(error?.상태코드) ??
    asNumber(error?.statusCode) ??
    asNumber(error?.status) ??
    asNumber(getNested(error, 'payload.상태코드'));

  const body =
    (error && typeof error === 'object' && '응답' in error ? error.응답 : undefined) ??
    getNested(error, 'payload.응답') ??
    getNested(error, 'response') ??
    getNested(error, 'data') ??
    error;

  const code =
    getNested(body, 'error.code') ??
    getNested(body, 'detail') ??
    getNested(body, 'code') ??
    getNested(error, 'code');

  const message =
    getNested(body, 'error.message') ??
    getNested(body, 'message') ??
    getNested(error, 'message');

  const requestId = getNested(body, 'error.request_id') ?? getNested(body, 'request_id');

  return {
    statusCode: statusCode ?? null,
    code: typeof code === 'string' ? code : null,
    message: typeof message === 'string' ? message : null,
    requestId: typeof requestId === 'string' ? requestId : null,
    raw: error,
  };
}

function humanizeError(actionKey, error) {
  const meta = extractErrorMeta(error);
  const code = meta.code;

  const common = {
    UNAUTHORIZED: {
      title: '권한이 없어요',
      message: '로그인/권한 설정을 확인해 주세요.',
    },
    RATE_LIMITED: {
      title: '요청이 너무 많아요',
      message: '잠시 후 다시 시도해 주세요.',
    },
    INTERNAL_ERROR: {
      title: '서버 오류가 발생했어요',
      message: '잠시 후 다시 시도해 주세요. 계속되면 개발팀에 알려주세요.',
    },
    DUPLICATE_REQUEST: {
      title: '이미 처리된 요청이에요',
      message: '같은 요청이 중복으로 들어온 것 같아요. 결과를 확인해 주세요.',
    },
    DUPLICATE_TX: {
      title: '이미 처리된 요청이에요',
      message: '같은 거래/요청이 중복으로 들어온 것 같아요. 결과를 확인해 주세요.',
    },
  };

  const byAction = {
    'extend-expiry': {
      EXTERNAL_USER_IDS_NOT_FOUND: {
        title: '대상 사용자를 찾을 수 없어요',
        message: '입력한 외부 아이디(external_user_id)로 조회되는 사용자가 없습니다.',
        hint: '외부 아이디를 확인한 뒤 다시 시도해 주세요.',
      },
      USER_IDS_REQUIRED: {
        title: '대상 사용자가 비어 있어요',
        message: '연장할 사용자 목록이 필요합니다.',
      },
      EMPTY_USER_IDS: {
        title: '대상 사용자가 비어 있어요',
        message: '연장할 사용자 목록이 비어 있습니다.',
      },
      INVALID_EXTEND_HOURS: {
        title: '연장 시간이 올바르지 않아요',
        message: '연장 시간(extend_hours)을 확인해 주세요.',
      },
      EXTENSION_LIMIT: {
        title: '연장 제한에 걸렸어요',
        message: '정책상 더 이상 연장할 수 없는 상태입니다.',
      },
      EXTENSION_FORBIDDEN: {
        title: '현재 상태에서는 연장할 수 없어요',
        message: '만료 상태/권한/정책 조건을 확인해 주세요.',
      },
      EXPIRED: {
        title: '이미 만료된 상태예요',
        message: '만료 이후에는 연장이 제한될 수 있습니다.',
      },
      NOT_FOUND: {
        title: '대상을 찾을 수 없어요',
        message: '요청한 사용자/대상을 찾지 못했습니다.',
      },
    },
  };

  const fallbackTitle = meta.statusCode ? `요청에 실패했어요 (${meta.statusCode})` : '요청에 실패했어요';
  const fallbackMessage = meta.message || '입력값과 네트워크 상태를 확인해 주세요.';

  const actionMap = actionKey ? byAction[actionKey] : undefined;
  const picked =
    (code && actionMap && actionMap[code]) ||
    (code && common[code]) ||
    null;

  return {
    ...meta,
    title: picked?.title || fallbackTitle,
    message: picked?.message || fallbackMessage,
    hint: picked?.hint || null,
  };
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
        <div key={it.label} className="border border-admin-border rounded-[8px] p-3 bg-admin-bg">
          <div className="text-xs text-admin-muted">{it.label}</div>
          <div className="mt-1 text-sm font-bold text-admin-text">{it.value}</div>
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
    const emptyText =
      actionKey === 'status'
        ? '왼쪽은 카드 요약, 오른쪽은 결과 요약이 표시돼요.'
        : '아직 실행한 요청이 없어요.';
    return (
      <div className={`${cardBase} p-4 md:p-6`}>
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="mt-2 text-sm text-cc-textSub">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className={`${cardBase} p-4 md:p-6`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">{title}</h3>
        <span className="text-xs text-admin-muted">(응답이 길면 스크롤로 내려서 볼 수 있어요)</span>
      </div>

      {lastCall ? (
        <div className="mt-3 text-xs text-admin-muted">
          마지막 요청: <span className="text-white">{lastCall.method}</span>{' '}
          <span className="text-white">{lastCall.path}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 border border-admin-border rounded-[8px] p-4 bg-admin-bg">
          <div className="text-sm font-bold mb-2 text-admin-muted">처리 중...</div>
          <div className="text-xs text-admin-muted">요청이 완료되면 결과가 표시돼요.</div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 bg-admin-bg border border-admin-border rounded-[8px] p-4">
          {(() => {
            const h = humanizeError(actionKey, error);
            return (
              <>
                <div className="text-sm font-bold text-admin-muted">{h.title}</div>
                <div className="mt-2 text-sm text-admin-text">{h.message}</div>
                {h.hint ? <div className="mt-1 text-xs text-admin-muted">{h.hint}</div> : null}
                <div className="mt-3 text-xs text-admin-muted">
                  {h.code ? (
                    <>
                      오류 코드: <span className="text-white">{h.code}</span>
                    </>
                  ) : (
                    '오류 코드 정보가 없어요'
                  )}
                  {h.statusCode != null ? (
                    <>
                      {' '}| 상태코드: <span className="text-white">{h.statusCode}</span>
                    </>
                  ) : null}
                  {h.requestId ? (
                    <>
                      {' '}| 요청 ID: <span className="text-white">{h.requestId}</span>
                    </>
                  ) : null}
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-admin-muted">자세히 보기 (원문)</summary>
                  <pre className="mt-2 text-xs whitespace-pre-wrap break-words text-admin-text">{safeJsonPretty(h.raw)}</pre>
                </details>
              </>
            );
          })()}
        </div>
      ) : null}

      {response ? (
        <>
          {summaryItems.length > 0 ? (
            <div className="mt-4">
              <div className="text-sm font-bold text-admin-muted">결과 요약</div>
              <KpiGrid items={summaryItems} />
            </div>
          ) : (
            <div className="mt-4 bg-admin-bg border border-admin-border rounded-[8px] p-4">
              <div className="text-sm font-bold mb-2 text-admin-muted">성공 결과</div>
              <pre className="text-xs whitespace-pre-wrap break-words text-admin-text">{safeJsonPretty(response)}</pre>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
