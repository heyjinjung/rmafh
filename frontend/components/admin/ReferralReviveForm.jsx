import { useMemo, useState } from 'react';
import { generateRequestId } from './utils';

export function ReferralReviveForm({
  externalUserId,
  onSubmit,
  loading,
  inputBase,
  buttonBase,
  buttonGhost,
}) {
  const [reviveChannel, setReviveChannel] = useState('TELEGRAM');
  const [reviveInviteCode, setReviveInviteCode] = useState('');
  const [reviveRequestId, setReviveRequestId] = useState(() => generateRequestId('revive'));

  const payload = useMemo(() => {
    return {
      request_id: reviveRequestId,
      external_user_id: externalUserId || undefined,
      channel: reviveChannel,
      invite_code: reviveInviteCode,
    };
  }, [reviveRequestId, externalUserId, reviveChannel, reviveInviteCode]);

  const validation = useMemo(() => {
    if (!externalUserId) return { ok: false, message: '외부 아이디를 입력해주세요.' };
    if (!reviveChannel) return { ok: false, message: '채널을 입력해주세요.' };
    if (!reviveInviteCode) return { ok: false, message: '초대 코드를 입력해주세요.' };
    if (!reviveRequestId) return { ok: false, message: '요청번호가 비어있어요.' };
    return { ok: true, message: '' };
  }, [externalUserId, reviveChannel, reviveInviteCode, reviveRequestId]);

  return (
    <div>
      <h2 className="text-lg font-bold text-white">추천 상태 되살리기</h2>
      <p className="mt-1 text-sm text-cc-textSub">추천/초대 관련 상태를 다시 살리는 작업이에요.</p>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-2 text-white">채널</label>
          <input
            className={inputBase}
            value={reviveChannel}
            onChange={(e) => setReviveChannel(e.target.value)}
            placeholder="예: TELEGRAM"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2 text-white">초대 코드</label>
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
          <button className={buttonGhost} disabled={!!loading} onClick={() => setReviveRequestId(generateRequestId('revive'))}>
            요청번호 새로 만들기
          </button>
          <span className="text-xs text-cc-textSub">요청번호는 중복 실행을 막는 데 도움돼요.</span>
        </div>

        <button
          className={buttonBase}
          disabled={!!loading || !validation.ok}
          onClick={() => {
            if (!validation.ok) return;
            onSubmit(payload);
          }}
        >
          추천 상태 되살리기 실행
        </button>
      </div>

      {!validation.ok ? <p className="mt-3 text-xs text-red-600">{validation.message}</p> : null}

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-cc-textSub">고급: 서버로 보내는 JSON 보기</summary>
        <div className="mt-3">
          <textarea className={`${inputBase} font-mono text-xs`} rows={7} value={JSON.stringify(payload, null, 2)} readOnly />
        </div>
      </details>
    </div>
  );
}
