import { useEffect, useState } from 'react';
import { pushToast, useToastSubscription } from './toastBus';

const sampleError = {
  code: 'IDEMPOTENCY_KEY_REUSE',
  summary: '동일 idempotency_key 로 상이한 payload',
  detail: 'Previous payload hash mismatch. Reuse blocked.',
};

const randomKey = () => `idem_${Math.random().toString(36).slice(2, 12)}`;

export default function AdminV2CommonUxPanel() {
  const [idemKey, setIdemKey] = useState(randomKey());
  const [auto, setAuto] = useState(true);
  const [detailLink, setDetailLink] = useState('job/job_20251226_001');
  const { toasts, clear } = useToastSubscription();

  useEffect(() => {
    if (!auto) return undefined;
    const id = setInterval(() => setIdemKey(randomKey()), 15000);
    return () => clearInterval(id);
  }, [auto]);

  const copyKey = () => {
    if (typeof navigator !== 'undefined') navigator.clipboard?.writeText(idemKey);
    pushToast({ ok: true, message: '멱등성 키를 복사했습니다', detail: detailLink });
  };

  const regenerate = () => {
    setIdemKey(randomKey());
    pushToast({ ok: true, message: '새 키 생성', detail: detailLink });
  };

  const simulateError = () => {
    pushToast({ ok: false, message: sampleError.summary, detail: sampleError.code, requestId: 'req_sim', idempotencyKey: randomKey() });
  };

  const latest = toasts[0];

  return (
    <div className="rounded-2xl border border-[var(--v2-border)] bg-[var(--v2-surface)]/80 p-5" id="common-ux">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">공통 UX</p>
          <p className="mt-1 text-sm text-[var(--v2-text)]">멱등성 위젯, 결과 토스트, 오류 표준</p>
        </div>
        <span className="rounded-full border border-[var(--v2-border)] px-3 py-1 text-[10px] text-[var(--v2-muted)]">UX 킷</span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-3 rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">멱등성 키</p>
              <p className="text-sm text-[var(--v2-text)]">자동 생성/복사/재생성 토글.</p>
            </div>
            <label className="flex items-center gap-2 text-xs text-[var(--v2-muted)]">
              <input aria-label="15초마다 자동 변경" type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
              15초마다 자동 변경
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--v2-text)]">
            <input
              value={idemKey}
              onChange={(e) => setIdemKey(e.target.value)}
              className="w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 font-mono md:w-[360px]"
            />
            <button className="rounded border border-[var(--v2-border)] px-3 py-2" onClick={copyKey}>복사</button>
            <button className="rounded border border-[var(--v2-border)] px-3 py-2" onClick={regenerate}>재생성</button>
          </div>
          <p className="text-xs text-[var(--v2-muted)]">서버 응답 헤더 `Idempotency-Status`가 toast 영역에 표기됩니다.</p>
        </div>

        <div className="space-y-3 rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4">
          <div className="flex items-center justify-between text-xs text-[var(--v2-muted)]">
            <span>결과 토스트 + 상세 링크</span>
            <div className="flex gap-2">
              <button className="rounded border border-[var(--v2-border)] px-3 py-1" onClick={simulateError}>오류 시뮬레이션</button>
              <button className="rounded border border-[var(--v2-border)] px-3 py-1" onClick={clear}>지우기</button>
            </div>
          </div>
          <div className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] p-3 text-sm text-[var(--v2-text)]">
            {latest ? (
              <div className="space-y-1">
                <div className={latest.ok ? 'text-[var(--v2-accent)]' : 'text-[var(--v2-warning)]'}>
                  {latest.message}
                </div>
                <div className="text-[var(--v2-muted)]">상세: {latest.detail}</div>
                {latest.requestId ? <div className="text-[var(--v2-muted)]">요청 ID: {latest.requestId}</div> : null}
                {latest.idempotencyKey ? <div className="text-[var(--v2-muted)]">멱등 키: {latest.idempotencyKey}</div> : null}
                <div className="text-xs text-[var(--v2-muted)]">링크 예: {detailLink}</div>
              </div>
            ) : (
              <p className="text-[var(--v2-muted)]">API 호출 후 결과 메시지가 토스트로 표시됩니다.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-[var(--v2-muted)]">
            <button className="rounded border border-[var(--v2-border)] px-3 py-1" onClick={() => pushToast({ ok: true, message: '적용 완료', detail: detailLink })}>성공 시뮬레이션</button>
            <input
              value={detailLink}
              onChange={(e) => setDetailLink(e.target.value)}
              className="w-full rounded border border-[var(--v2-border)] bg-[var(--v2-surface)] px-2 py-1 text-[var(--v2-text)] md:w-[240px]"
              placeholder="job/job_id 또는 audit/log 링크"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">오류 메시지 표준</p>
        <div className="mt-2 grid gap-3 md:grid-cols-[0.35fr_1fr]">
          <div className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] p-3 text-xs text-[var(--v2-text)]">
            <p className="font-semibold text-[var(--v2-accent)]">형태</p>
            <pre className="mt-2 whitespace-pre-wrap text-[var(--v2-muted)]">{`{
  code: string,
  summary: string,
  detail?: string,
  request_id?: string
}`}</pre>
          </div>
          <div className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] p-3 text-xs text-[var(--v2-text)]">
            <p className="font-semibold text-[var(--v2-warning)]">샘플 응답</p>
            <pre className="mt-2 whitespace-pre-wrap text-[var(--v2-warning)]">{JSON.stringify(sampleError, null, 2)}</pre>
            <p className="mt-2 text-[var(--v2-muted)]">코드/요약/세부를 토스트 + 패널에 동일하게 노출.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
