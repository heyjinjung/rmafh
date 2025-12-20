import { safeJsonPretty } from './utils';

export function StatusViewer({ statusData, cardBase }) {
  if (!statusData) {
    return (
      <div className={`${cardBase} p-4 md:p-6`}>
        <h2 className="text-lg font-bold">상태 조회</h2>
        <p className="mt-2 text-sm text-cc-textSub">외부 아이디를 입력하고 상태 조회를 실행하세요.</p>
      </div>
    );
  }

  return (
    <div className={`${cardBase} p-4 md:p-6`}>
      <h2 className="text-lg font-bold">상태 조회</h2>
      <p className="mt-2 text-sm text-cc-textSub">조회 결과를 요약/원문 형태로 보여줘요.</p>

      <div className="mt-4 bg-black border border-gold-primary/30 rounded-[4px] p-4">
        <div className="text-sm font-bold mb-2 text-cc-textSub">원문(JSON)</div>
        <pre className="text-xs whitespace-pre-wrap break-words text-white">{safeJsonPretty(statusData)}</pre>
      </div>
    </div>
  );
}
