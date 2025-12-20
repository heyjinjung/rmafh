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

export default function AdminPage() {
  const [memberId, setMemberId] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const [statusBodyText, setStatusBodyText] = useState('');
  const [extendBodyText, setExtendBodyText] = useState(JSON.stringify({ dry_run: true }, null, 2));
  const [notifyBodyText, setNotifyBodyText] = useState(JSON.stringify({}, null, 2));
  const [reviveBodyText, setReviveBodyText] = useState(JSON.stringify({}, null, 2));

  const qs = useMemo(() => {
    const params = new URLSearchParams();
    if (memberId) params.set('user_id', memberId);
    const s = params.toString();
    return s ? `?${s}` : '';
  }, [memberId]);

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

  const cardBase = 'bg-black/50 backdrop-blur-md border border-white/10 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)]';
  const inputBase = 'w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-white/20';

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
              잘 모르겠으면 먼저 “미리보기(드라이런)”부터 눌러주세요.
            </p>
          </div>

          <div className={`${cardBase} p-4 md:p-6 mb-6`}>
            <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-4">
              <div className="flex-1">
                <label className="block text-sm font-semibold mb-2" style={{ color: TOKENS.accent1 }}>
                  회원 번호( user_id )
                </label>
                <input
                  className={inputBase}
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                  inputMode="numeric"
                  placeholder="예: 123"
                />
                <p className="mt-2 text-xs" style={{ color: TOKENS.textSub }}>
                  팁: 회원 번호를 넣으면 그 사람 기준으로 상태를 볼 수 있어요.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="px-4 py-3 rounded-xl font-bold border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-60"
                  disabled={!!busyKey}
                  onClick={() => callApi('status', '/api/vault/status/', { method: 'GET' })}
                >
                  상태 보기
                </button>
                <button
                  className="px-4 py-3 rounded-xl font-bold border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-60"
                  disabled={!!busyKey}
                  onClick={() => setResult(null) || setError(null)}
                >
                  결과 지우기
                </button>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold mb-2" style={{ color: TOKENS.textSub }}>
                (참고) 상태 보기에는 보낼 내용이 없어요
              </label>
              <textarea
                className={`${inputBase} font-mono text-xs`}
                rows={2}
                value={statusBodyText}
                onChange={(e) => setStatusBodyText(e.target.value)}
                placeholder="상태 보기는 GET이라서 내용(body)이 없어요."
                readOnly
              />
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
                    먼저 <strong>dry_run: true</strong>로 “미리보기”를 하고, 괜찮으면 <strong>false</strong>로 바꿔서 진짜 실행하세요.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="px-4 py-3 rounded-xl font-bold text-black disabled:opacity-60"
                    style={{ background: TOKENS.accent1 }}
                    disabled={!!busyKey}
                    onClick={() => setExtendBodyText(JSON.stringify({ dry_run: true }, null, 2))}
                  >
                    미리보기
                  </button>
                  <button
                    className="px-4 py-3 rounded-xl font-bold border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-60"
                    disabled={!!busyKey}
                    onClick={() => setExtendBodyText(JSON.stringify({ dry_run: false }, null, 2))}
                  >
                    진짜 실행용
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-semibold mb-2">보내는 내용(JSON)</label>
                <textarea
                  className={`${inputBase} font-mono text-xs`}
                  rows={6}
                  value={extendBodyText}
                  onChange={(e) => setExtendBodyText(e.target.value)}
                  placeholder={'예: {\n  "dry_run": true\n}'}
                />
                <div className="mt-3 flex justify-end">
                  <button
                    className="px-5 py-3 rounded-xl font-bold border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-60"
                    disabled={!!busyKey}
                    onClick={() => {
                      try {
                        const body = parseJsonOrThrow(extendBodyText);
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
                <label className="block text-sm font-semibold mb-2">보내는 내용(JSON)</label>
                <textarea
                  className={`${inputBase} font-mono text-xs`}
                  rows={6}
                  value={notifyBodyText}
                  onChange={(e) => setNotifyBodyText(e.target.value)}
                  placeholder={'예: {\n  "message": "안내 문구"\n}'}
                />
                <div className="mt-3 flex justify-end">
                  <button
                    className="px-5 py-3 rounded-xl font-bold border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-60"
                    disabled={!!busyKey}
                    onClick={() => {
                      try {
                        const body = parseJsonOrThrow(notifyBodyText);
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
                <label className="block text-sm font-semibold mb-2">보내는 내용(JSON)</label>
                <textarea
                  className={`${inputBase} font-mono text-xs`}
                  rows={6}
                  value={reviveBodyText}
                  onChange={(e) => setReviveBodyText(e.target.value)}
                  placeholder={'예: {\n  "reason": "점검"\n}'}
                />
                <div className="mt-3 flex justify-end">
                  <button
                    className="px-5 py-3 rounded-xl font-bold border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-60"
                    disabled={!!busyKey}
                    onClick={() => {
                      try {
                        const body = parseJsonOrThrow(reviveBodyText);
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
