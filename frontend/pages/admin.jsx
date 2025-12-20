import Head from 'next/head';
import { useMemo, useState } from 'react';

const TOKENS = {
  bg: '#000000',
  accent1: '#D2FD9C',
  accent2: '#282D1A',
  accent3: '#394508',
  textWhite: '#FFFFFF',
  textSub: '#CBCBCB',
  textBlack: '#000000',
};

function safeJsonPretty(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function parseJsonOrThrow(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    const err = new Error('입력한 내용이 JSON 형식이 아니에요. 예시처럼 { } 모양으로 써주세요.');
    err.cause = e;
    throw err;
  }
}

function generateRequestId(prefix) {
  const rand = Math.random().toString(16).slice(2, 10);
  return `${prefix}-${Date.now()}-${rand}`;
}

function parseExternalUserIdsText(text) {
  const raw = String(text || '')
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const ids = raw;
  if (ids.some((v) => v.length > 128)) {
    throw new Error('외부 아이디가 너무 길어요(128자 이하로 입력해주세요).');
  }
  return ids;
}

function tryParseExternalUserIdsText(text) {
  try {
    return { ok: true, ids: parseExternalUserIdsText(text), message: '' };
  } catch (e) {
    return { ok: false, ids: [], message: e?.message || '외부 아이디 목록을 확인해주세요.' };
  }
}

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
    deposit_total: new Set(['deposit_total', 'total_deposit', '누적입금액', '누적입금', '누적입금액(원)']),
    joined_at: new Set(['joined_at', 'join_date', '가입일', '가입일자']),
    last_deposit_at: new Set(['last_deposit_at', 'deposit_at', '입금일', '입금일자', '최근입금일']),
    telegram_ok: new Set(['telegram_ok', 'telegram', '텔레그램', '채널확인', 'telegram_ok 처리', '텔레그램ok']),
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
    });
  }

  return out;
}

export default function AdminPage() {
  const [externalUserId, setExternalUserId] = useState('');
  const [activeSection, setActiveSection] = useState('status');
  const [busyKey, setBusyKey] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [lastCall, setLastCall] = useState(null);

  // 만료 연장(extend-expiry) — ExtendExpiryRequest
  const [extendScope, setExtendScope] = useState('USER_IDS');
  const [extendUserIdsText, setExtendUserIdsText] = useState('');
  const [extendHours, setExtendHours] = useState(24);
  const [extendReason, setExtendReason] = useState('ADMIN');
  const [extendShadow, setExtendShadow] = useState(true);
  const [extendRequestId, setExtendRequestId] = useState(() => generateRequestId('extend'));

  // 알림(notify) — NotifyRequest
  const [notifyType, setNotifyType] = useState('EXPIRY_D2');
  const [notifyUserIdsText, setNotifyUserIdsText] = useState('');
  const [notifyVariantId, setNotifyVariantId] = useState('');

  // 추천 상태 되살리기(referral-revive) — ReferralReviveRequest
  const [reviveChannel, setReviveChannel] = useState('TELEGRAM');
  const [reviveInviteCode, setReviveInviteCode] = useState('');
  const [reviveRequestId, setReviveRequestId] = useState(() => generateRequestId('revive'));

  // CSV 업로드(일일 업로드: 아이디/닉넴/누적입금/가입일/입금일/텔레그램OK)
  const [csvName, setCsvName] = useState('');
  const [csvText, setCsvText] = useState('');
  const csvDailyRows = useMemo(() => parseCsvDailyImportRows(csvText), [csvText]);

  const qs = useMemo(() => {
    const params = new URLSearchParams();
    if (externalUserId) params.set('external_user_id', externalUserId);
    const s = params.toString();
    return s ? `?${s}` : '';
  }, [externalUserId]);

  async function callApi(key, path, init) {
    setBusyKey(key);
    setError(null);
    setResult(null);
    try {
      const method = (init?.method || 'GET').toUpperCase();
      setLastCall({ key, method, path: `${path}${qs}`, at: new Date().toISOString() });
      const res = await fetch(`${path}${qs}`, init);
      const ct = res.headers.get('content-type') || '';
      const body = ct.includes('application/json') ? await res.json() : await res.text();
      if (!res.ok) {
        setError({ 상태코드: res.status, 응답: body });
        return;
      }
      setResult(body);
    } catch (e) {
      setError({ 상태코드: 0, 응답: { message: e?.message || '요청에 실패했어요.' } });
    } finally {
      setBusyKey('');
    }
  }

  const cardBase = 'bg-black/70 backdrop-blur-md border border-white/20 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.55)]';
  const inputBase = 'w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/50 outline-none focus:border-white/40';
  const selectBase = `${inputBase} appearance-none`;
  const buttonBase = 'px-5 py-3 rounded-xl font-bold border border-white/20 bg-white/10 hover:bg-white/15 disabled:opacity-60 disabled:cursor-not-allowed';

  const sectionButtonClass = (id) => {
    const active = activeSection === id;
    return `px-4 py-2 rounded-xl border text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed ${
      active ? 'bg-white/20 border-white/30 text-white' : 'bg-white/5 border-white/15 text-white/80 hover:bg-white/10'
    }`;
  };

  const extendIdsParsed = useMemo(
    () => tryParseExternalUserIdsText(extendUserIdsText || externalUserId),
    [extendUserIdsText, externalUserId]
  );
  const notifyIdsParsed = useMemo(
    () => tryParseExternalUserIdsText(notifyUserIdsText || externalUserId),
    [notifyUserIdsText, externalUserId]
  );

  const extendPayload = useMemo(() => {
    const scope = extendScope;
    const payload = {
      request_id: extendRequestId,
      scope,
      extend_hours: Number(extendHours),
      reason: extendReason,
      shadow: Boolean(extendShadow),
    };
    if (scope === 'USER_IDS') {
      payload.external_user_ids = extendIdsParsed.ids;
    }
    return payload;
  }, [extendScope, extendRequestId, extendHours, extendReason, extendShadow, extendIdsParsed.ids]);

  const notifyPayload = useMemo(() => {
    const payload = {
      type: notifyType,
      external_user_ids: notifyIdsParsed.ids,
    };
    if (notifyVariantId && String(notifyVariantId).trim()) {
      payload.variant_id = String(notifyVariantId).trim();
    }
    return payload;
  }, [notifyType, notifyVariantId, notifyIdsParsed.ids]);

  const revivePayload = useMemo(() => {
    return {
      request_id: reviveRequestId,
      channel: reviveChannel,
      invite_code: reviveInviteCode,
    };
  }, [reviveRequestId, reviveChannel, reviveInviteCode]);

  const extendValidation = useMemo(() => {
    const hours = Number(extendHours);
    if (!extendRequestId) return { ok: false, message: '요청번호가 비어 있어요.' };
    if (!Number.isFinite(hours) || hours < 1 || hours > 72) return { ok: false, message: '늘릴 시간은 1~72 사이 숫자여야 해요.' };
    if (extendScope === 'USER_IDS' && !extendIdsParsed.ok) return { ok: false, message: extendIdsParsed.message };
    if (extendScope === 'USER_IDS' && !extendIdsParsed.ids.length) return { ok: false, message: '대상 외부 아이디가 비어 있어요.' };
    return { ok: true, message: '' };
  }, [extendHours, extendRequestId, extendScope, extendIdsParsed.ok, extendIdsParsed.message, extendIdsParsed.ids.length]);

  const notifyValidation = useMemo(() => {
    if (!notifyIdsParsed.ok) return { ok: false, message: notifyIdsParsed.message };
    if (!notifyIdsParsed.ids.length) return { ok: false, message: '대상 외부 아이디가 비어 있어요.' };
    return { ok: true, message: '' };
  }, [notifyIdsParsed.ok, notifyIdsParsed.message, notifyIdsParsed.ids.length]);

  const reviveValidation = useMemo(() => {
    if (!externalUserId) return { ok: false, message: '외부 아이디(external_user_id)를 먼저 적어주세요.' };
    if (!reviveRequestId) return { ok: false, message: '요청번호가 비어 있어요.' };
    if (!String(reviveChannel || '').trim()) return { ok: false, message: '채널을 적어주세요.' };
    if (!String(reviveInviteCode || '').trim()) return { ok: false, message: '초대 코드를 적어주세요.' };
    return { ok: true, message: '' };
  }, [externalUserId, reviveRequestId, reviveChannel, reviveInviteCode]);

  const csvValidation = useMemo(() => {
    if (!csvText) return { ok: false, message: 'CSV 파일을 선택해주세요.' };
    if (!csvDailyRows.length) return { ok: false, message: 'CSV에서 외부 아이디를 하나도 찾지 못했어요.' };
    if (csvDailyRows.length > 10000) return { ok: false, message: '한 번에 최대 10,000개까지 업로드할 수 있어요.' };
    return { ok: true, message: '' };
  }, [csvText, csvDailyRows.length]);

  return (
    <>
      <Head>
        <title>관리자 도구 - 신규회원 전용금고</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;600&family=Noto+Sans+KR:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div
        className="min-h-screen text-white p-4 md:p-6 lg:p-8"
        style={{
          background: TOKENS.bg,
          fontFamily: "'Noto Sans KR', sans-serif",
          backgroundImage: 'radial-gradient(circle at center, #0A0A0A 0%, #050505 70%, #030303 100%)',
          backgroundAttachment: 'fixed',
        }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold">
              <span style={{ color: TOKENS.textWhite }}>관리자 도구</span>
              <span className="ml-2" style={{ color: TOKENS.accent1 }}>(전용금고)</span>
            </h1>
            <p className="mt-2 text-sm md:text-base" style={{ color: TOKENS.textSub }}>
              운영자가 빠르게 처리할 수 있게, 필요한 입력만 남긴 간단한 도구예요.
              <br />
              영향이 큰 작업은 먼저 <strong>미리보기(shadow)</strong>로 확인 후 실행하세요.
            </p>
          </div>

          <div className={`${cardBase} p-4 md:p-6 mb-6`}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-semibold mb-2" style={{ color: TOKENS.accent1 }}>
                    외부 아이디 (external_user_id)
                  </label>
                  <input
                    className={inputBase}
                    value={externalUserId}
                    onChange={(e) => setExternalUserId(e.target.value)}
                    placeholder="예: ext-123"
                  />
                  <p className="mt-2 text-xs" style={{ color: TOKENS.textSub }}>
                    비워도 동작할 수 있지만, 대부분의 작업은 외부 아이디를 넣는 게 안전해요.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className={buttonBase}
                    disabled={!!busyKey}
                    onClick={() => {
                      setActiveSection('status');
                      return callApi('status', '/api/vault/status/', { method: 'GET' });
                    }}
                  >
                    상태 조회
                  </button>
                  <button
                    className={buttonBase}
                    disabled={!!busyKey}
                    onClick={() => {
                      setResult(null);
                      setError(null);
                      setLastCall(null);
                    }}
                  >
                    결과 초기화
                  </button>
                </div>
              </div>

              <div>
                <div className="text-xs mb-2" style={{ color: TOKENS.textSub }}>
                  작업 선택
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className={sectionButtonClass('status')} disabled={!!busyKey} onClick={() => setActiveSection('status')}>
                    상태
                  </button>
                  <button className={sectionButtonClass('csv')} disabled={!!busyKey} onClick={() => setActiveSection('csv')}>
                    엑셀 업로드
                  </button>
                  <button className={sectionButtonClass('extend')} disabled={!!busyKey} onClick={() => setActiveSection('extend')}>
                    만료 연장
                  </button>
                  <button className={sectionButtonClass('notify')} disabled={!!busyKey} onClick={() => setActiveSection('notify')}>
                    알림
                  </button>
                  <button className={sectionButtonClass('revive')} disabled={!!busyKey} onClick={() => setActiveSection('revive')}>
                    추천 revive
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {activeSection === 'csv' ? (
              <div className={`${cardBase} p-4 md:p-6`}>
              <h2 className="text-lg font-bold" style={{ color: TOKENS.accent1 }}>
                엑셀/CSV 업로드 (일일 업데이트)
              </h2>
              <p className="mt-1 text-sm" style={{ color: TOKENS.textSub }}>
                매일 엑셀을 업로드해서 <strong>누적입금액</strong> / <strong>텔레그램 OK</strong> 같은 운영 정보를 반영할 수 있어요.
                <br />
                반영되는 컬럼(권장): <strong>external_user_id</strong>, nickname, deposit_total(누적), joined_at, last_deposit_at, telegram_ok
              </p>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">CSV 파일</label>
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
                  <p className="mt-2 text-xs" style={{ color: TOKENS.textSub }}>
                    선택된 파일: {csvName || '없음'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">읽어온 외부 아이디 개수</label>
                  <div className="bg-black/50 border border-white/20 rounded-xl px-4 py-3">
                    <div className="text-xl font-bold" style={{ color: TOKENS.textWhite }}>
                      {csvDailyRows.length}
                    </div>
                    <div className="text-xs" style={{ color: TOKENS.textSub }}>
                      중복은 자동으로 제거돼요.
                    </div>
                  </div>
                </div>
              </div>

              <details className="mt-4">
                <summary className="cursor-pointer text-sm" style={{ color: TOKENS.textSub }}>
                  고급: 업로드 데이터 미리보기(앞 20개)
                </summary>
                <div className="mt-3">
                  <textarea
                    className={`${inputBase} font-mono text-xs`}
                    rows={7}
                    value={(csvDailyRows.slice(0, 20) || [])
                      .map((r) => `${r.external_user_id}\t${r.deposit_total}\t${r.telegram_ok ? 'OK' : 'NO'}`)
                      .join('\n')}
                    readOnly
                  />
                </div>
              </details>

              <div className="mt-4 flex justify-end">
                <button
                  className={buttonBase}
                  disabled={!!busyKey || !csvValidation.ok}
                  onClick={() => {
                    try {
                      if (!csvValidation.ok) throw new Error(csvValidation.message);

                      setActiveSection('csv');
                      return callApi('user-daily-import', '/api/vault/user-daily-import/', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ rows: csvDailyRows }),
                      });
                    } catch (e) {
                      setError({ 상태코드: 0, 응답: { message: e?.message || '입력을 확인해주세요.' } });
                    }
                  }}
                >
                  업로드 반영하기
                </button>
              </div>

              {!csvValidation.ok ? (
                <p className="mt-3 text-xs" style={{ color: TOKENS.accent1 }}>
                  {csvValidation.message}
                </p>
              ) : null}
            </div>
            ) : null}

            {activeSection === 'extend' ? (
              <div className={`${cardBase} p-4 md:p-6`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: TOKENS.accent1 }}>
                    만료 시간 늘리기
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: TOKENS.textSub }}>
                    쉽게 말해: “이벤트 시간이 끝나기 전에 조금 더 늘려줄게요” 같은 작업이에요.
                    <br />
                    먼저 <strong>미리보기(적용 안 함)</strong>로 확인하고, 괜찮으면 <strong>진짜 실행</strong>을 해주세요.
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">적용 방식</label>
                    <select className={selectBase} value={extendScope} onChange={(e) => setExtendScope(e.target.value)}>
                      <option value="USER_IDS">특정 아이디만</option>
                      <option value="ALL_ACTIVE">전체(진행 중인 회원)</option>
                    </select>
                    <p className="mt-2 text-xs" style={{ color: TOKENS.textSub }}>
                      “전체”는 많은 사람에게 영향이 갈 수 있어요.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">몇 시간 늘릴까요? (1~72)</label>
                    <input
                      className={inputBase}
                      type="number"
                      min={1}
                      max={72}
                      value={extendHours}
                      onChange={(e) => setExtendHours(e.target.value)}
                      placeholder="예: 24"
                    />
                    <p className="mt-2 text-xs" style={{ color: TOKENS.textSub }}>
                      숫자는 시간 단위예요. 예: 24 = 하루
                    </p>
                  </div>

                  {extendScope === 'USER_IDS' && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold mb-2">대상 외부 아이디(여러 명 가능)</label>
                      <input
                        className={inputBase}
                        value={extendUserIdsText}
                        onChange={(e) => setExtendUserIdsText(e.target.value)}
                        placeholder={externalUserId ? `예: ${externalUserId}` : '예: ext-1, ext-2'}
                      />
                      <p className="mt-2 text-xs" style={{ color: TOKENS.textSub }}>
                        쉼표(,)나 띄어쓰기로 구분해요. 비워두면 위의 외부 아이디(external_user_id)를 사용해요.
                      </p>
                      {!extendIdsParsed.ok ? (
                        <p className="mt-2 text-xs" style={{ color: TOKENS.accent1 }}>
                          {extendIdsParsed.message}
                        </p>
                      ) : null}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold mb-2">왜 늘리나요?</label>
                    <select className={selectBase} value={extendReason} onChange={(e) => setExtendReason(e.target.value)}>
                      <option value="ADMIN">관리자</option>
                      <option value="OPS">운영</option>
                      <option value="PROMO">프로모션</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">미리보기(적용 안 함)</label>
                    <div className="flex items-center gap-3 bg-black/50 border border-white/20 rounded-xl px-4 py-3">
                      <input
                        id="extendShadow"
                        type="checkbox"
                        checked={extendShadow}
                        onChange={(e) => setExtendShadow(e.target.checked)}
                      />
                      <label htmlFor="extendShadow" className="text-sm" style={{ color: TOKENS.textSub }}>
                        체크하면 “적용하지 않고 후보만 보여줘요”
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      className="px-4 py-3 rounded-xl font-bold text-black disabled:opacity-60"
                      style={{ background: TOKENS.accent1 }}
                      disabled={!!busyKey}
                      onClick={() => setExtendRequestId(generateRequestId('extend'))}
                    >
                      요청번호 새로 만들기
                    </button>
                    <span className="text-xs" style={{ color: TOKENS.textSub }}>
                      요청번호는 중복 실행을 막는 데 도움돼요.
                    </span>
                  </div>

                  <button
                    className="px-5 py-3 rounded-xl font-bold border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-60"
                    disabled={!!busyKey || !extendValidation.ok}
                    onClick={() => {
                      try {
                        if (!extendValidation.ok) throw new Error(extendValidation.message);
                        const body = extendPayload;
                        setActiveSection('extend');
                        return callApi('extend-expiry', '/api/vault/extend-expiry/', {
                          method: 'POST',
                          headers: { 'content-type': 'application/json' },
                          body: JSON.stringify(body),
                        });
                      } catch (e) {
                        setError({ 상태코드: 0, 응답: { message: e?.message || '입력을 확인해주세요.' } });
                      }
                    }}
                  >
                    만료 시간 늘리기 실행
                  </button>
                </div>

                {!extendValidation.ok ? (
                  <p className="mt-3 text-xs" style={{ color: TOKENS.accent1 }}>
                    {extendValidation.message}
                  </p>
                ) : null}

                <details className="mt-4">
                  <summary className="cursor-pointer text-sm" style={{ color: TOKENS.textSub }}>
                    고급: 서버로 보내는 JSON 보기
                  </summary>
                  <div className="mt-3">
                    <textarea className={`${inputBase} font-mono text-xs`} rows={7} value={safeJsonPretty(extendPayload)} readOnly />
                  </div>
                </details>
              </div>
            </div>
            ) : null}

            {activeSection === 'notify' ? (
              <div className={`${cardBase} p-4 md:p-6`}>
              <h2 className="text-lg font-bold" style={{ color: TOKENS.accent1 }}>
                알림 보내기(큐에 넣기)
              </h2>
              <p className="mt-1 text-sm" style={{ color: TOKENS.textSub }}>
                쉽게 말해: “알림을 보내달라고 요청서를 한 장 넣는 것”이에요. 실제 발송은 워커가 처리할 수 있어요.
              </p>

              <div className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">알림 종류</label>
                    <select className={selectBase} value={notifyType} onChange={(e) => setNotifyType(e.target.value)}>
                      <option value="EXPIRY_D2">만료 2일 전</option>
                      <option value="EXPIRY_D0">만료 당일</option>
                      <option value="ATTENDANCE_D2">출석 2일 차</option>
                      <option value="TICKET_ZERO">티켓 0개</option>
                      <option value="SOCIAL_PROOF">인기/후기(표시용)</option>
                      <option value="REFERRAL_REVIVE">추천 되살리기 안내</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">세부 버전(선택)</label>
                    <input
                      className={inputBase}
                      value={notifyVariantId}
                      onChange={(e) => setNotifyVariantId(e.target.value)}
                      placeholder="예: base"
                    />
                    <p className="mt-2 text-xs" style={{ color: TOKENS.textSub }}>
                      비워도 돼요. 팀에서 정한 값이 있을 때만 넣어요.
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold mb-2">대상 외부 아이디(여러 명 가능)</label>
                    <input
                      className={inputBase}
                      value={notifyUserIdsText}
                      onChange={(e) => setNotifyUserIdsText(e.target.value)}
                      placeholder={externalUserId ? `예: ${externalUserId}` : '예: ext-1, ext-2'}
                    />
                    <p className="mt-2 text-xs" style={{ color: TOKENS.textSub }}>
                      쉼표(,)나 띄어쓰기로 구분해요. 비워두면 위의 외부 아이디(external_user_id)를 사용해요.
                    </p>
                    {!notifyIdsParsed.ok ? (
                      <p className="mt-2 text-xs" style={{ color: TOKENS.accent1 }}>
                        {notifyIdsParsed.message}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    className={buttonBase}
                    disabled={!!busyKey || !notifyValidation.ok}
                    onClick={() => {
                      try {
                        if (!notifyValidation.ok) throw new Error(notifyValidation.message);
                        const body = notifyPayload;
                        setActiveSection('notify');
                        return callApi('notify', '/api/vault/notify/', {
                          method: 'POST',
                          headers: { 'content-type': 'application/json' },
                          body: JSON.stringify(body),
                        });
                      } catch (e) {
                        setError({ 상태코드: 0, 응답: { message: e?.message || '입력을 확인해주세요.' } });
                      }
                    }}
                  >
                    알림 요청 넣기
                  </button>
                </div>

                {!notifyValidation.ok ? (
                  <p className="mt-3 text-xs" style={{ color: TOKENS.accent1 }}>
                    {notifyValidation.message}
                  </p>
                ) : null}

                <details className="mt-4">
                  <summary className="cursor-pointer text-sm" style={{ color: TOKENS.textSub }}>
                    고급: 서버로 보내는 JSON 보기
                  </summary>
                  <div className="mt-3">
                    <textarea className={`${inputBase} font-mono text-xs`} rows={7} value={safeJsonPretty(notifyPayload)} readOnly />
                  </div>
                </details>
              </div>
            </div>
            ) : null}

            {activeSection === 'revive' ? (
              <div className={`${cardBase} p-4 md:p-6`}>
              <h2 className="text-lg font-bold" style={{ color: TOKENS.accent1 }}>
                추천 상태 되살리기
              </h2>
              <p className="mt-1 text-sm" style={{ color: TOKENS.textSub }}>
                쉽게 말해: 추천/초대 관련 상태를 다시 살리는 작업이에요.
              </p>

              <div className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">채널</label>
                    <input
                      className={inputBase}
                      value={reviveChannel}
                      onChange={(e) => setReviveChannel(e.target.value)}
                      placeholder="예: TELEGRAM"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">초대 코드</label>
                    <input
                      className={inputBase}
                      value={reviveInviteCode}
                      onChange={(e) => setReviveInviteCode(e.target.value)}
                      placeholder="예: ABC123"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      className="px-4 py-3 rounded-xl font-bold text-black disabled:opacity-60"
                      style={{ background: TOKENS.accent1 }}
                      disabled={!!busyKey}
                      onClick={() => setReviveRequestId(generateRequestId('revive'))}
                    >
                      요청번호 새로 만들기
                    </button>
                    <span className="text-xs" style={{ color: TOKENS.textSub }}>
                      요청번호는 중복 실행을 막는 데 도움돼요.
                    </span>
                  </div>

                  <button
                    className={buttonBase}
                    disabled={!!busyKey || !reviveValidation.ok}
                    onClick={() => {
                      try {
                        if (!reviveValidation.ok) throw new Error(reviveValidation.message);

                        const body = revivePayload;
                        setActiveSection('revive');
                        return callApi('referral-revive', '/api/vault/referral-revive/', {
                          method: 'POST',
                          headers: { 'content-type': 'application/json' },
                          body: JSON.stringify(body),
                        });
                      } catch (e) {
                        setError({ 상태코드: 0, 응답: { message: e?.message || '입력을 확인해주세요.' } });
                      }
                    }}
                  >
                    추천 상태 되살리기 실행
                  </button>
                </div>

                {!reviveValidation.ok ? (
                  <p className="mt-3 text-xs" style={{ color: TOKENS.accent1 }}>
                    {reviveValidation.message}
                  </p>
                ) : null}

                <details className="mt-4">
                  <summary className="cursor-pointer text-sm" style={{ color: TOKENS.textSub }}>
                    고급: 서버로 보내는 JSON 보기
                  </summary>
                  <div className="mt-3">
                    <textarea className={`${inputBase} font-mono text-xs`} rows={7} value={safeJsonPretty(revivePayload)} readOnly />
                  </div>
                </details>
              </div>
            </div>
            ) : null}
          </div>

          {busyKey ? (
            <div className="max-w-5xl mx-auto mt-6 text-sm" style={{ color: TOKENS.textSub }}>
              처리 중이에요: {busyKey}
            </div>
          ) : null}

          {(error || result) && (
            <div className={`${cardBase} p-4 md:p-6 mt-6`}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold" style={{ color: TOKENS.accent1 }}>
                  결과
                </h2>
                <span className="text-xs" style={{ color: TOKENS.textSub }}>
                  (응답이 길면 스크롤로 내려서 볼 수 있어요)
                </span>
              </div>

              {lastCall ? (
                <div className="mt-3 text-xs" style={{ color: TOKENS.textSub }}>
                  마지막 요청: <span style={{ color: TOKENS.textWhite }}>{lastCall.method}</span>{' '}
                  <span style={{ color: TOKENS.textWhite }}>{lastCall.path}</span>
                </div>
              ) : null}

              {error ? (
                <div className="mt-4 bg-black/30 border border-white/10 rounded-xl p-4">
                  <div className="text-sm font-bold mb-2" style={{ color: TOKENS.textSub }}>
                    에러가 났어요
                  </div>
                  <pre className="text-xs whitespace-pre-wrap break-words" style={{ color: TOKENS.textWhite }}>
                    {safeJsonPretty(error)}
                  </pre>
                </div>
              ) : null}

              {result ? (
                <div className="mt-4 bg-black/30 border border-white/10 rounded-xl p-4">
                  <div className="text-sm font-bold mb-2" style={{ color: TOKENS.textSub }}>
                    성공 응답
                  </div>
                  <pre className="text-xs whitespace-pre-wrap break-words" style={{ color: TOKENS.textWhite }}>
                    {safeJsonPretty(result)}
                  </pre>
                </div>
              ) : null}
            </div>
          )}

          <div className="text-center text-gray-600 text-xs mt-10">
            <p>© 2025 CC Casino - 관리자 도구</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background: ${TOKENS.bg};
          color: ${TOKENS.textWhite};
          font-family: 'Noto Sans KR', sans-serif;
        }
      `}</style>
    </>
  );
}
