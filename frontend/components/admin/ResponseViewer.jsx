import { safeJsonPretty } from './utils';

export function ResponseViewer({
  title,
  loading,
  error,
  response,
  lastCall,
  cardBase,
}) {
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
        <div className="mt-4 bg-black border border-gold-primary/30 rounded-[4px] p-4">
          <div className="text-sm font-bold mb-2 text-cc-textSub">성공 응답</div>
          <pre className="text-xs whitespace-pre-wrap break-words text-white">{safeJsonPretty(response)}</pre>
        </div>
      ) : null}
    </div>
  );
}
