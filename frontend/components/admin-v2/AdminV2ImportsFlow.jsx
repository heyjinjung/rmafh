import { useMemo, useState } from 'react';
import { extractErrorInfo, withIdempotency } from '../../lib/apiClient';
import { pushToast } from './toastBus';

const requiredFields = ['external_user_id'];
const optionalFields = ['nickname', 'deposit_total', 'joined_at', 'last_deposit_at', 'telegram_ok', 'review_ok'];

function parseDelimited(text) {
  const rawLines = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');

  const lines = rawLines
    .map((l) => String(l).trim())
    .filter((l) => l && !l.startsWith('#'));

  if (!lines.length) return { header: [], rows: [] };

  const toCells = (line) => line.split(/[\t,;]/).map((c) => String(c).trim().replace(/^"|"$/g, ''));
  const header = toCells(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    rows.push(toCells(lines[i]));
  }
  return { header, rows };
}

function coerceBool(v) {
  const s = String(v || '').trim().toLowerCase();
  if (!s) return false;
  return ['1', 'true', 't', 'yes', 'y', 'ok', 'o', 'ㅇㅇ', '확인', '완료'].includes(s);
}

function coerceInt(v) {
  const s = String(v || '').replace(/,/g, '').trim();
  const digits = s.replace(/[^0-9-]/g, '');
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

function buildRowsForApi({ header, rows, mapping }) {
  const idxByName = new Map();
  header.forEach((name, idx) => {
    idxByName.set(String(name || '').trim(), idx);
  });

  const get = (cells, colName) => {
    const idx = idxByName.get(colName);
    if (idx === undefined) return '';
    return cells[idx];
  };

  const seen = new Set();
  const out = [];
  rows.forEach((cells) => {
    const ext = String(get(cells, mapping.external_user_id) || '').trim();
    if (!ext) return;
    if (seen.has(ext)) return;
    seen.add(ext);

    const row = {
      external_user_id: ext,
    };

    if (mapping.nickname) {
      const v = String(get(cells, mapping.nickname) || '').trim();
      if (v) row.nickname = v;
    }
    if (mapping.deposit_total) row.deposit_total = coerceInt(get(cells, mapping.deposit_total));
    if (mapping.joined_at) {
      const v = String(get(cells, mapping.joined_at) || '').trim();
      if (v) row.joined_at = v;
    }
    if (mapping.last_deposit_at) {
      const v = String(get(cells, mapping.last_deposit_at) || '').trim();
      if (v) row.last_deposit_at = v;
    }
    if (mapping.telegram_ok) row.telegram_ok = coerceBool(get(cells, mapping.telegram_ok));
    if (mapping.review_ok) row.review_ok = coerceBool(get(cells, mapping.review_ok));

    out.push(row);
  });
  return out;
}

export default function AdminV2ImportsFlow({ adminPassword, basePath }) {
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState('');
  const [csvText, setCsvText] = useState('');
  const [parsed, setParsed] = useState({ header: [], rows: [] });
  const [mapping, setMapping] = useState({
    external_user_id: '',
    nickname: '',
    deposit_total: '',
    joined_at: '',
    last_deposit_at: '',
    telegram_ok: '',
    review_ok: '',
  });
  const [mode, setMode] = useState('SHADOW');
  const [riskAck, setRiskAck] = useState('');
  const [submitState, setSubmitState] = useState(null);
  const [serverError, setServerError] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const apiFetch = useMemo(() => withIdempotency({ adminPassword, basePath }), [adminPassword, basePath]);

  const availableColumns = useMemo(() => parsed.header || [], [parsed.header]);
  const rowCount = useMemo(() => (parsed.rows || []).length, [parsed.rows]);

  const rowsForApi = useMemo(() => {
    if (!parsed.header.length || !parsed.rows.length) return [];
    if (!mapping.external_user_id) return [];
    return buildRowsForApi({ header: parsed.header, rows: parsed.rows, mapping });
  }, [parsed.header, parsed.rows, mapping]);

  const validation = useMemo(() => {
    const errors = [];
    if (!csvText) errors.push('CSV 파일을 선택해주세요.');
    if (!mapping.external_user_id) errors.push('필수 매핑: external_user_id');
    if (mapping.external_user_id && rowsForApi.length === 0) errors.push('CSV에서 external_user_id를 하나도 찾지 못했어요.');
    if (rowCount > 10000) errors.push('10,000행 초과 시 10,000행 단위로 배치 Job으로 분할됩니다.');
    return { errors, warnings: rowCount > 0 && rowCount <= 10000 ? [] : errors.length ? [] : ['경고 없음'] };
  }, [csvText, mapping.external_user_id, rowCount, rowsForApi.length]);

  const canProceed = () => {
    if (step === 1) return Boolean(fileName && csvText);
    if (step === 2) return Boolean(mapping.external_user_id);
    if (step === 3) return true;
    if (step === 4) {
      if (mode === 'SHADOW') return true;
      const raw = String(riskAck || '').trim();
      const lower = raw.toLowerCase();
      return lower === 'i understand' || raw === '이해했습니다';
    }
    return false;
  };

  const nextStep = () => setStep((s) => Math.min(4, s + 1));
  const prevStep = () => setStep((s) => Math.max(1, s - 1));

  const uploadLabel = fileName ? `${fileName} (${rowCount.toLocaleString()}행)` : 'CSV 파일 선택';

  const runImport = async ({ runMode }) => {
    setSubmitState({ loading: true });
    setServerError(null);
    try {
      const body = {
        mode: runMode,
        rows: rowsForApi,
      };
      const res = await apiFetch('/api/vault/admin/imports', { method: 'POST', body });
      const data = res?.data;

      setSubmitState({ ok: true, idempotencyKey: res.idempotencyKey, idempotencyStatus: res.idempotencyStatus });
      if (runMode === 'SHADOW') {
        setValidationResult(data);
        pushToast({ ok: true, message: '서버 검증(SHADOW) 완료', detail: res.idempotencyKey, idempotencyKey: res.idempotencyKey });
      } else {
        pushToast({ ok: true, message: '가져오기 실행(APPLY) 요청 완료', detail: res.idempotencyKey, idempotencyKey: res.idempotencyKey });
      }
    } catch (err) {
      const info = extractErrorInfo(err);
      setServerError(info);
      setSubmitState({ ok: false, message: info.summary, idempotencyKey: info.idempotencyKey });
      pushToast({ ok: false, message: info.summary || '가져오기 실패', detail: info.requestId || info.detail, requestId: info.requestId, idempotencyKey: info.idempotencyKey });
    } finally {
      setSubmitState((prev) => ({ ...prev, loading: false }));
    }
  };

  const openErrorReportCsv = () => {
    const url = validationResult?.error_report_csv;
    if (url && typeof window !== 'undefined') window.open(url, '_blank');
  };

  return (
    <section id="imports" className="rounded-2xl border border-[var(--v2-border)] bg-[var(--v2-surface)]/80 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">가져오기</p>
          <p className="mt-1 text-sm text-[var(--v2-text)]">4단계 흐름: 파일 → 매핑 → 검증 → 실행.</p>
        </div>
        <span className="rounded-full border border-[var(--v2-border)] px-3 py-1 text-[10px] text-[var(--v2-muted)]">단계 {step} / 4</span>
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
                    file.text().then((text) => {
                      setCsvText(text);
                      const p = parseDelimited(text);
                      setParsed(p);
                      // best-effort default mapping: exact match
                      const headerSet = new Set((p.header || []).map((h) => String(h || '').trim()));
                      setMapping((prev) => ({
                        ...prev,
                        external_user_id: headerSet.has('external_user_id') ? 'external_user_id' : (p.header || [])[0] || '',
                        nickname: headerSet.has('nickname') ? 'nickname' : prev.nickname,
                        deposit_total: headerSet.has('deposit_total') ? 'deposit_total' : prev.deposit_total,
                        joined_at: headerSet.has('joined_at') ? 'joined_at' : prev.joined_at,
                        last_deposit_at: headerSet.has('last_deposit_at') ? 'last_deposit_at' : prev.last_deposit_at,
                        telegram_ok: headerSet.has('telegram_ok') ? 'telegram_ok' : prev.telegram_ok,
                        review_ok: headerSet.has('review_ok') ? 'review_ok' : prev.review_ok,
                      }));
                    });
                  }}
                />
                <span className="text-[var(--v2-muted)]">찾아보기</span>
              </label>
              <p className="mt-2 text-xs text-[var(--v2-muted)]">최대 10,000행 단위로 Job 분할 예정. 헤더가 포함된 UTF-8 CSV.</p>
            </div>
          )}

          {step === 2 && (
            <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4 space-y-3">
              <p className="text-sm font-semibold text-[var(--v2-text)]">2) 컬럼 매핑</p>
              {[...requiredFields, ...optionalFields].map((field) => (
                <div key={field} className="grid grid-cols-[160px_1fr] items-center gap-3 text-sm">
                  <span className="text-[var(--v2-muted)]">{field}</span>
                  <select
                    value={mapping[field] || ''}
                    onChange={(e) => setMapping((prev) => ({ ...prev, [field]: e.target.value }))}
                    className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-[var(--v2-text)]"
                  >
                    <option value="">선택</option>
                    {availableColumns.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              ))}
              <p className="text-xs text-[var(--v2-muted)]">필수: external_user_id. 나머지는 선택입니다.</p>
            </div>
          )}

          {step === 3 && (
            <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--v2-text)]">3) 검증 & 미리보기 (최대 200행)</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--v2-muted)]">샘플 3행</span>
                  <button
                    type="button"
                    onClick={() => runImport({ runMode: 'SHADOW' })}
                    disabled={submitState?.loading || validation.errors.length > 0}
                    className="rounded border border-[var(--v2-border)] px-3 py-1 text-xs text-[var(--v2-text)] disabled:opacity-50"
                  >
                    서버 검증(SHADOW)
                  </button>
                </div>
              </div>
              <div className="mt-3 overflow-auto rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)]">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[var(--v2-surface-2)] text-[var(--v2-muted)]">
                    <tr>
                      {Object.keys((rowsForApi[0] || { external_user_id: '' })).map((col) => (
                        <th key={col} className="px-3 py-2 uppercase tracking-[0.12em]">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--v2-border)]">
                    {(rowsForApi.slice(0, 3) || []).map((row) => (
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
                  <span>오류</span>
                  <span>{validation.errors.length}</span>
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--v2-warning)]">
                  {validation.errors.length === 0 ? <li>샘플에서 오류가 감지되지 않았습니다.</li> : validation.errors.map((e) => <li key={e}>{e}</li>)}
                </ul>
              </div>

              <div className="mt-3 rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2">
                <div className="flex items-center justify-between text-xs text-[var(--v2-muted)]">
                  <span>서버 검증 결과</span>
                  <div className="space-x-2">
                    <button
                      type="button"
                      className="rounded border border-[var(--v2-border)] px-3 py-1 text-xs text-[var(--v2-text)] disabled:opacity-50"
                      onClick={openErrorReportCsv}
                      disabled={!validationResult?.error_report_csv}
                    >
                      CSV로 저장
                    </button>
                  </div>
                </div>

                {!validationResult ? (
                  <p className="mt-2 text-xs text-[var(--v2-muted)]">서버 검증(SHADOW)을 실행하면 오류 목록과 CSV 링크가 표시됩니다.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    <div className="text-xs text-[var(--v2-muted)]">
                      shadow: {String(validationResult.shadow)} · total: {validationResult.total} · processed: {validationResult.processed} · dedup_removed: {validationResult.dedup_removed}
                    </div>
                    {validationResult.error_report_csv ? (
                      <div className="text-xs text-[var(--v2-text)]">error_report_csv: {validationResult.error_report_csv}</div>
                    ) : null}

                    <div className="overflow-hidden rounded-lg border border-[var(--v2-border)]">
                      <table className="min-w-full table-fixed text-left text-xs">
                        <thead className="border-b border-[var(--v2-border)] text-[var(--v2-muted)]">
                          <tr>
                            <th className="px-3 py-2">행</th>
                            <th className="px-3 py-2">external_user_id</th>
                            <th className="px-3 py-2">코드</th>
                            <th className="px-3 py-2">상세</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--v2-border)] text-[var(--v2-text)]">
                          {(validationResult.errors || []).slice(0, 200).map((e, idx) => (
                            <tr key={`${e.row_index}-${idx}`}>
                              <td className="px-3 py-2">{e.row_index}</td>
                              <td className="px-3 py-2 font-mono text-[var(--v2-accent)]">{e.external_user_id || '-'}</td>
                              <td className="px-3 py-2">{e.code}</td>
                              <td className="px-3 py-2">{e.detail || ''}</td>
                            </tr>
                          ))}
                          {!validationResult.errors?.length ? (
                            <tr>
                              <td className="px-3 py-2 text-[var(--v2-muted)]" colSpan={4}>오류가 없습니다.</td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4 space-y-3">
              <p className="text-sm font-semibold text-[var(--v2-text)]">4) 실행</p>
              <div className="flex items-center gap-3 text-sm text-[var(--v2-text)]">
                <label className="inline-flex items-center gap-2">
                  <input aria-label="Mode: SHADOW" type="radio" name="mode" value="SHADOW" checked={mode === 'SHADOW'} onChange={() => setMode('SHADOW')} />
                  Shadow (검증만)
                </label>
                <label className="inline-flex items-center gap-2">
                  <input aria-label="Mode: APPLY" type="radio" name="mode" value="APPLY" checked={mode === 'APPLY'} onChange={() => setMode('APPLY')} />
                  Apply (실행)
                </label>
              </div>
              <div className="rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)]">
                <div className="flex items-center justify-between text-[var(--v2-muted)]">
                  <span>영향도 미리보기</span>
                  <span>{rowCount.toLocaleString()}행</span>
                </div>
                <p className="mt-2 text-xs text-[var(--v2-muted)]">10,000행 단위로 배치로 분할합니다. 서버에서 external_user_id 기준으로 중복 제거합니다.</p>
              </div>
              <div className="space-y-2 text-sm text-[var(--v2-text)]">
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">위험 작업 확인</label>
                <input
                  value={riskAck}
                  onChange={(e) => setRiskAck(e.target.value)}
                  placeholder="'I understand' 또는 '이해했습니다' 입력"
                  className="w-full rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-sm text-[var(--v2-text)] placeholder:text-[var(--v2-muted)]"
                />
                <p className="text-xs text-[var(--v2-warning)]">위험 작업: Apply 모드에서는 되돌릴 수 없습니다.</p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4 text-sm text-[var(--v2-text)]">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">단계 안내</p>
            <ol className="mt-3 list-decimal space-y-2 pl-4 text-[var(--v2-muted)]">
              <li>CSV 업로드 (UTF-8, header 포함)</li>
              <li>컬럼 매핑 확인</li>
              <li>샘플 검증 및 오류 확인</li>
              <li>Shadow/Apply 선택 후 실행</li>
            </ol>
            <p className="mt-3 rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-xs text-[var(--v2-muted)]">
              POST /api/vault/admin/imports 호출 시 idempotency-key 포함, 실패 시 request_id/idem-key를 아래 응답 카드와 토스트에서 확인하세요.
            </p>
          </div>

          <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4 text-sm text-[var(--v2-text)]">
            <div className="flex items-center justify-between text-xs text-[var(--v2-muted)]">
              <span>서버 응답</span>
              {submitState?.idempotencyKey ? <span className="font-mono">{submitState.idempotencyKey}</span> : null}
            </div>
            <div className="mt-2 space-y-1 rounded border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-xs">
              {submitState?.loading ? <p className="text-[var(--v2-muted)]">요청 중...</p> : null}
              {submitState?.ok ? (
                <>
                  <p className="text-[var(--v2-accent)]">Import 요청이 접수되었습니다.</p>
                  {submitState.idempotencyStatus ? <p className="text-[var(--v2-muted)]">Idem-Status: {submitState.idempotencyStatus}</p> : null}
                </>
              ) : null}
              {serverError ? (
                <div className="space-y-1 text-[var(--v2-warning)]">
                  <p>{serverError.summary || '오류 발생'}</p>
                  {serverError.detail ? <p className="text-[var(--v2-muted)]">{serverError.detail}</p> : null}
                  {serverError.requestId ? <p className="text-[var(--v2-muted)]">request_id: {serverError.requestId}</p> : null}
                  {serverError.idempotencyKey ? <p className="text-[var(--v2-muted)]">idem-key: {serverError.idempotencyKey}</p> : null}
                </div>
              ) : null}
              {!submitState && !serverError ? <p className="text-[var(--v2-muted)]">실행 요청 시 서버 응답과 idempotency 정보가 표시됩니다.</p> : null}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-4 text-sm text-[var(--v2-text)]">
            <div className="flex items-center justify-between text-xs text-[var(--v2-muted)]">
              <span>오류 리포트 CSV</span>
              <button
                className="rounded border border-[var(--v2-border)] px-3 py-1 disabled:opacity-50"
                onClick={openErrorReportCsv}
                disabled={!validationResult?.error_report_csv}
              >
                CSV로 저장
              </button>
            </div>
            <div className="mt-2 rounded border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-2 text-xs text-[var(--v2-muted)]">
              {validationResult?.error_report_csv ? (
                <p className="text-[var(--v2-text)]">{validationResult.error_report_csv}</p>
              ) : (
                <p>서버 검증(SHADOW) 결과에 error_report_csv가 있으면 여기서 다운로드할 수 있습니다.</p>
              )}
            </div>
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
              onClick={step === 4 ? () => runImport({ runMode: mode }) : nextStep}
              disabled={!canProceed() || (step === 4 && submitState?.loading)}
              className="flex-1 rounded-lg border border-[var(--v2-accent)] bg-[var(--v2-accent)] px-4 py-3 text-sm font-semibold text-black shadow-[0_0_20px_rgba(183,247,90,0.35)] disabled:opacity-50"
            >
              {step === 4 ? (submitState?.loading ? '실행 요청 중...' : mode === 'SHADOW' ? 'SHADOW 실행' : 'APPLY 실행') : '다음 단계'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
