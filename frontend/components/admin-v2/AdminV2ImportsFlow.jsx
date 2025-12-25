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

  // 예시 파일 다운로드 함수
  const downloadExample = () => {
    const example = 'external_user_id,nickname,deposit_total\nuser1,홍길동,10000\nuser2,김철수,20000';
    const blob = new Blob([example], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import_example.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section id="imports" className="rounded-2xl border border-[var(--v2-border)] bg-[var(--v2-surface)]/80 p-5">
      <h2 className="text-lg font-bold text-[var(--v2-accent)] mb-2">회원정보 가져오기</h2>
      <ol className="mb-4 list-decimal pl-4 text-sm text-[var(--v2-muted)]">
        <li>아래에서 CSV 파일을 올려주세요. <button type="button" className="ml-2 underline text-[var(--v2-accent)]" onClick={downloadExample}>예시 파일 다운로드</button></li>
        <li>파일 내용과 오류를 미리 확인하세요.</li>
        <li>문제가 없으면 &apos;적용&apos; 버튼을 눌러주세요.</li>
      </ol>
      <div className="space-y-4">
        {/* 파일 업로드 */}
        <label className="flex items-center gap-3">
          <span className="font-semibold">CSV 파일 올리기</span>
          <input type="file" accept=".csv" className="hidden" aria-label="CSV 파일 업로드" onChange={(e) => {
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
          }} />
          <span className="text-[var(--v2-muted)]">{fileName ? fileName : '파일 선택'}</span>
        </label>
        {/* 미리보기 및 오류 안내 */}
        {csvText && (
          <div>
            <h3 className="text-sm font-bold mt-4">미리보기</h3>
            <div className="overflow-auto rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] mt-2">
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
            {/* 오류 안내 */}
            {validation.errors.length > 0 ? (
              <div className="mt-2 text-[var(--v2-warning)]">
                <b>오류가 있습니다:</b>
                <ul>{validation.errors.map((e) => <li key={e}>{e}</li>)}</ul>
              </div>
            ) : (
              <div className="mt-2 text-[var(--v2-accent)]">오류가 없습니다. 적용 가능합니다.</div>
            )}
          </div>
        )}
        {/* 실행 버튼 */}
        <button
          type="button"
          className="w-full rounded-lg bg-[var(--v2-accent)] px-4 py-3 text-sm font-semibold text-black mt-4"
          disabled={!csvText || validation.errors.length > 0}
          onClick={() => runImport({ runMode: 'APPLY' })}
        >
          적용하기
        </button>
      </div>
      {/* 오류 리포트 CSV 다운로드 안내 */}
      {validationResult?.error_report_csv && (
        <div className="mt-4">
          <button type="button" className="underline text-[var(--v2-accent)]" onClick={openErrorReportCsv}>
            오류 CSV 다운로드
          </button>
        </div>
      )}
    </section>
  );
}
