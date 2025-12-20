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

export default function AdminPage() {
  const [externalUserId, setExternalUserId] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

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
              이 페이지는 <strong>확인/점검용</strong>이에요. 버튼을 누르면 서버에 바로 요청이 갑니다.
              <br />
              잘 모르겠으면 먼저 “미리보기(shadow)”부터 눌러주세요.
            </p>
          </div>

          <div className={`${cardBase} p-4 md:p-6 mb-6`}>
            <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-4">
              <div className="flex-1">
                <label className="block text-sm font-semibold mb-2" style={{ color: TOKENS.accent1 }}>
                  외부 아이디( external_user_id )
                </label>
                <input
                  className={inputBase}
                  value={externalUserId}
                  onChange={(e) => setExternalUserId(e.target.value)}
                  placeholder="예: ext-123"
                />
                <p className="mt-2 text-xs" style={{ color: TOKENS.textSub }}>
                  팁: 외부 아이디를 넣으면 그 사람 기준으로 상태를 볼 수 있어요.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="px-4 py-3 rounded-xl font-bold border border-white/20 bg-white/10 hover:bg-white/15 disabled:opacity-60"
                  disabled={!!busyKey}
                  onClick={() => callApi('status', '/api/vault/status/', { method: 'GET' })}
                >
                  상태 보기
                </button>
                <button
                  className="px-4 py-3 rounded-xl font-bold border border-white/20 bg-white/10 hover:bg-white/15 disabled:opacity-60"
                  disabled={!!busyKey}
                  onClick={() => setResult(null) || setError(null)}
                >
                  결과 지우기
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
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
                    disabled={!!busyKey}
                    onClick={() => {
                      try {
                        if (!extendRequestId) throw new Error('요청번호가 비어 있어요. “요청번호 새로 만들기”를 눌러주세요.');
                        const hours = Number(extendHours);
                        if (!Number.isFinite(hours) || hours < 1 || hours > 72) throw new Error('늘릴 시간은 1~72 사이 숫자여야 해요.');
                        if (extendScope === 'USER_IDS' && !extendIdsParsed.ok) throw new Error(extendIdsParsed.message);
                        if (extendScope === 'USER_IDS' && !extendIdsParsed.ids.length) throw new Error('대상 외부 아이디가 비어 있어요.');
                        const body = extendPayload;
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
                    className="px-5 py-3 rounded-xl font-bold border border-white/20 bg-white/10 hover:bg-white/15 disabled:opacity-60"
                    disabled={!!busyKey}
                    onClick={() => {
                      try {
                        if (!notifyIdsParsed.ok) throw new Error(notifyIdsParsed.message);
                        if (!notifyIdsParsed.ids.length) throw new Error('대상 외부 아이디가 비어 있어요.');
                        const body = notifyPayload;
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
                    className="px-5 py-3 rounded-xl font-bold border border-white/20 bg-white/10 hover:bg-white/15 disabled:opacity-60"
                    disabled={!!busyKey}
                    onClick={() => {
                      try {
                        if (!externalUserId) throw new Error('외부 아이디(external_user_id)를 먼저 적어주세요.');
                        if (!reviveRequestId) throw new Error('요청번호가 비어 있어요. “요청번호 새로 만들기”를 눌러주세요.');
                        if (!String(reviveChannel || '').trim()) throw new Error('채널을 적어주세요.');
                        if (!String(reviveInviteCode || '').trim()) throw new Error('초대 코드를 적어주세요.');

                        const body = revivePayload;
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
