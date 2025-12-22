import { useMemo, useState } from 'react';

function parseCsvDailyImportRows(text) {
  const rawLines = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');

  const lines = rawLines
    .map((l) => String(l).trim())
    .filter((l) => l && !l.startsWith('#'));

  if (!lines.length) return [];

  const toCells = (line) => line.split(/[\t,;]/).map((c) => c.trim().replace(/^"|"$/g, ''));
  const headerCells = toCells(lines[0]).map((c) => c.toLowerCase());

  const headerMap = {
    external_user_id: new Set(['external_user_id', 'external_id', 'id', '아이디', '외부아이디', 'externaluserid']),
    nickname: new Set(['nickname', 'nick', '닉네임', '별명']),
    deposit_total: new Set(['deposit_total', 'total_deposit', '입금액', '누적입금액', '누적입금', '누적입금액(원)', '총입금액']),
    joined_at: new Set(['joined_at', 'join_date', '가입일', '가입일자']),
    last_deposit_at: new Set(['last_deposit_at', 'deposit_at', '입금일', '입금일자', '최근입금일']),
    telegram_ok: new Set(['telegram_ok', 'telegram', '텔레그램', '채널확인', 'telegram_ok 처리', '텔레그램ok']),
    review_ok: new Set(['review_ok', 'review', '리뷰', '리뷰체크', '리뷰확인', '리뷰작성', '리뷰작성여부']),
  };

  const findIndex = (keys) => headerCells.findIndex((c) => keys.has(c));
  const idxExternal = findIndex(headerMap.external_user_id);
  const hasHeader = idxExternal !== -1;

  const getBool = (v) => {
    const s = String(v || '').trim().toLowerCase();
    if (!s) return false;
    return ['1', 'true', 't', 'yes', 'y', 'ok', 'o', 'ㅇㅇ', '확인', '완료'].includes(s);
  };
  const getInt = (v) => {
    const s = String(v || '').replace(/,/g, '').trim();
    const digits = s.replace(/[^0-9-]/g, '');
    const n = Number(digits);
    return Number.isFinite(n) ? n : 0;
  };

  const idxNickname = hasHeader ? findIndex(headerMap.nickname) : 1;
  const idxDepositTotal = hasHeader ? findIndex(headerMap.deposit_total) : 2;
  const idxJoinedAt = hasHeader ? findIndex(headerMap.joined_at) : 3;
  const idxLastDepositAt = hasHeader ? findIndex(headerMap.last_deposit_at) : 4;
  const idxTelegramOk = hasHeader ? findIndex(headerMap.telegram_ok) : 5;
  const idxReviewOk = hasHeader ? findIndex(headerMap.review_ok) : 6;

  const out = [];
  const seen = new Set();
  for (let i = 0; i < lines.length; i += 1) {
    if (i === 0 && hasHeader) continue;
    const cells = toCells(lines[i]);
    const ext = String(cells[hasHeader ? idxExternal : 0] || '').trim();
    if (!ext) continue;
    if (seen.has(ext)) continue;
    seen.add(ext);

    out.push({
      external_user_id: ext,
      nickname: String(cells[idxNickname] || '').trim() || undefined,
      deposit_total: getInt(cells[idxDepositTotal]),
      joined_at: String(cells[idxJoinedAt] || '').trim() || undefined,
      last_deposit_at: String(cells[idxLastDepositAt] || '').trim() || undefined,
      telegram_ok: getBool(cells[idxTelegramOk]),
      review_ok: getBool(cells[idxReviewOk]),
    });
  }

  return out;
}

export function CsvUploader({ onUpload, loading, inputBase, buttonBase }) {
  const [csvName, setCsvName] = useState('');
  const [csvText, setCsvText] = useState('');

  const rows = useMemo(() => parseCsvDailyImportRows(csvText), [csvText]);

  const validation = useMemo(() => {
    if (!csvText) return { ok: false, message: 'CSV 파일을 선택해주세요.' };
    if (!rows.length) return { ok: false, message: 'CSV에서 외부 아이디를 하나도 찾지 못했어요.' };
    if (rows.length > 10000) return { ok: false, message: '한 번에 최대 10,000개까지 업로드할 수 있어요.' };
    return { ok: true, message: '' };
  }, [csvText, rows.length]);

  return (
    <div>
      <h2 className="text-lg font-bold text-white">엑셀/CSV 업로드 (일일 업데이트)</h2>
      <p className="mt-1 text-sm text-cc-textSub">
        매일 엑셀을 업로드해서 <strong className="text-white">누적입금액</strong> / <strong className="text-white">텔레그램 OK</strong> 같은 운영 정보를 반영할 수 있어요.
      </p>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-2 text-white">CSV 파일</label>
          <input
            className={inputBase}
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              const f = e.target.files && e.target.files[0];
              if (!f) return;
              setCsvName(f.name);
              const text = await f.text();
              setCsvText(text);
            }}
          />
          <p className="mt-2 text-xs text-cc-textSub">선택된 파일: {csvName || '없음'}</p>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2 text-white">읽어온 외부 아이디 개수</label>
          <div className="border border-gold-primary/30 rounded-[4px] px-3 py-2 bg-black">
            <div className="text-xl font-bold text-white">{rows.length}</div>
            <div className="text-xs text-cc-textSub">중복은 자동으로 제거돼요.</div>
          </div>
        </div>
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-cc-textSub">고급: 업로드 데이터 미리보기(앞 20개)</summary>
        <div className="mt-3">
          <textarea
            className={`${inputBase} font-mono text-xs`}
            rows={7}
            value={(rows.slice(0, 20) || [])
              .map((r) => `${r.external_user_id}\t${r.nickname || '-'}\t${r.deposit_total}\t${r.telegram_ok ? 'OK' : 'NO'}\t${r.review_ok ? 'OK' : 'NO'}`)
              .join('\n')}
            readOnly
          />
        </div>
      </details>

      <div className="mt-4 flex justify-end">
        <button
          className={buttonBase}
          disabled={!!loading || !validation.ok}
          onClick={() => {
            if (!validation.ok) return;
            onUpload({ rows });
          }}
        >
          업로드 반영하기
        </button>
      </div>

      {!validation.ok ? <p className="mt-3 text-xs text-red-600">{validation.message}</p> : null}
    </div>
  );
}
