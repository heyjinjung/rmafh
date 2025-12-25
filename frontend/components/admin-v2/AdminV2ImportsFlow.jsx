import { useMemo, useState } from 'react';

const sampleColumns = ['external_user_id', 'nickname', 'deposit_total', 'telegram_ok', 'review_ok'];
const samplePreview = [
  { external_user_id: 'ext-1001', nickname: 'Alpha', deposit_total: 5000, telegram_ok: true, review_ok: false },
  { external_user_id: 'ext-1002', nickname: 'Bravo', deposit_total: 12000, telegram_ok: false, review_ok: true },
  { external_user_id: 'ext-1003', nickname: 'Charlie', deposit_total: 8000, telegram_ok: true, review_ok: true },
];

export default function AdminV2ImportsFlow() {
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState('');
  const [rowCount, setRowCount] = useState(0);
  const [mapping, setMapping] = useState({ external_user_id: 'external_user_id', nickname: 'nickname', deposit_total: 'deposit_total' });
  const [mode, setMode] = useState('SHADOW');
  const [riskAck, setRiskAck] = useState('');

  const validation = useMemo(() => {
    const errors = [];
    if (!mapping.external_user_id) errors.push('external_user_id is required');
    if (rowCount > 10000) errors.push('Rows > 10,000 will be split into batch jobs');
    return { errors, warnings: rowCount > 0 && rowCount <= 10000 ? [] : errors.length ? [] : ['No warnings'] };
  }, [mapping, rowCount]);

  const canProceed = () => {
    if (step === 1) return Boolean(fileName);
    if (step === 2) return Boolean(mapping.external_user_id && mapping.nickname);
    if (step === 3) return true;
    if (step === 4) return riskAck.trim().toLowerCase() === 'i understand';
    return false;
  };

  const nextStep = () => setStep((s) => Math.min(4, s + 1));
  const prevStep = () => setStep((s) => Math.max(1, s - 1));

  const uploadLabel = fileName ? `${fileName} (${rowCount.toLocaleString()} rows)` : 'CSV 파일 선택';

  return (
    <section id="imports" className="rounded-2xl border border-[var(--v2-border)] bg-[var(--v2-surface)]/80 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Imports</p>
          <p className="mt-1 text-sm text-[var(--v2-text)]">4-step flow: file → mapping → 검증 → 실행.</p>
        </div>
        <span className="rounded-full border border-[var(--v2-border)] px-3 py-1 text-[10px] text-[var(--v2-muted)]">Step {step} / 4</span>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          {step === 1 && (
            <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4">
              <p className="text-sm font-semibold text-[var(--v2-text)]">1) 파일 업로드</p>
              <label className="mt-3 flex cursor-pointer items-center justify-between rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-4 py-3 text-sm text-[var(--v2-text)] hover:border-[var(--v2-accent)]/50">
                <span>{uploadLabel}</span>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setFileName(file.name);
                    setRowCount(Math.max(200, Math.floor(file.size / 32)));
                  }}
                />
                <span className="text-[var(--v2-muted)]">Browse</span>
              </label>
              <p className="mt-2 text-xs text-[var(--v2-muted)]">최대 10,000행 단위로 Job 분할 예정. 헤더가 포함된 UTF-8 CSV.</p>
            </div>
          )}

          {step === 2 && (
            <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4 space-y-3">
              <p className="text-sm font-semibold text-[var(--v2-text)]">2) 컬럼 매핑</p>
              {['external_user_id', 'nickname', 'deposit_total', 'telegram_ok', 'review_ok'].map((field) => (
                <div key={field} className="grid grid-cols-[160px_1fr] items-center gap-3 text-sm">
                  <span className="text-[var(--v2-muted)]">{field}</span>
                  <select
                    value={mapping[field] || ''}
                    onChange={(e) => setMapping((prev) => ({ ...prev, [field]: e.target.value }))}
                    className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-[var(--v2-text)]"
                  >
                    <option value="">선택</option>
                    {sampleColumns.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              ))}
              <p className="text-xs text-[var(--v2-muted)]">필수: external_user_id, nickname. 선택: deposit_total, telegram_ok, review_ok.</p>
            </div>
          )}

          {step === 3 && (
            <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--v2-text)]">3) 검증 & 미리보기 (최대 200행)</p>
                <span className="text-xs text-[var(--v2-muted)]">샘플 3행</span>
              </div>
              <div className="mt-3 overflow-auto rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)]">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[var(--v2-surface-2)] text-[var(--v2-muted)]">
                    <tr>
                      {Object.keys(samplePreview[0]).map((col) => (
                        <th key={col} className="px-3 py-2 uppercase tracking-[0.12em]">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--v2-border)]">
                    {samplePreview.map((row) => (
                      <tr key={row.external_user_id}>
                        {Object.entries(row).map(([col, val]) => (
                          <td key={col} className="px-3 py-2 font-mono text-[var(--v2-text)]">{String(val)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm">
                <div className="flex items-center justify-between text-[var(--v2-muted)]">
                  <span>Errors</span>
                  <span>{validation.errors.length}</span>
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--v2-warning)]">
                  {validation.errors.length === 0 ? <li>No errors detected in sample.</li> : validation.errors.map((e) => <li key={e}>{e}</li>)}
                </ul>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4 space-y-3">
              <p className="text-sm font-semibold text-[var(--v2-text)]">4) 실행</p>
              <div className="flex items-center gap-3 text-sm text-[var(--v2-text)]">
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="mode" value="SHADOW" checked={mode === 'SHADOW'} onChange={() => setMode('SHADOW')} />
                  Shadow (검증만)
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="mode" value="APPLY" checked={mode === 'APPLY'} onChange={() => setMode('APPLY')} />
                  Apply (실행)
                </label>
              </div>
              <div className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]">
                <div className="flex items-center justify-between text-[var(--v2-muted)]">
                  <span>Impact Preview</span>
                  <span>{rowCount.toLocaleString()} rows</span>
                </div>
                <p className="mt-2 text-xs text-[var(--v2-muted)]">Split into batches of 10,000 rows. Dedup by external_user_id on server.</p>
              </div>
              <div className="space-y-2 text-sm text-[var(--v2-text)]">
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Risk Acknowledgement</label>
                <input
                  value={riskAck}
                  onChange={(e) => setRiskAck(e.target.value)}
                  placeholder="type 'I understand'"
                  className="w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)] placeholder:text-[var(--v2-muted)]"
                />
                <p className="text-xs text-[var(--v2-warning)]">위험 작업: Apply 모드에서는 되돌릴 수 없습니다.</p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4 text-sm text-[var(--v2-text)]">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">Step Guide</p>
            <ol className="mt-3 list-decimal space-y-2 pl-4 text-[var(--v2-muted)]">
              <li>CSV 업로드 (UTF-8, header 포함)</li>
              <li>컬럼 매핑 확인</li>
              <li>샘플 검증 및 오류 확인</li>
              <li>Shadow/Apply 선택 후 실행</li>
            </ol>
            <p className="mt-3 rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-xs text-[var(--v2-muted)]">
              Backend wiring TODO: POST /api/vault/admin/imports with idempotency key and job creation. Current UI simulates state only.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={prevStep}
              disabled={step === 1}
              className="flex-1 rounded-lg border border-[var(--v2-border)] px-4 py-3 text-sm text-[var(--v2-text)] disabled:opacity-50"
            >
              이전 단계
            </button>
            <button
              type="button"
              onClick={nextStep}
              disabled={!canProceed()}
              className="flex-1 rounded-lg border border-[var(--v2-accent)] bg-[var(--v2-accent)] px-4 py-3 text-sm font-semibold text-black shadow-[0_0_20px_rgba(183,247,90,0.35)] disabled:opacity-50"
            >
              {step === 4 ? '실행 준비 완료' : '다음 단계'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
