import { useMemo, useState } from 'react';
import { tryParseExternalUserIdsText } from './utils';

export function NotificationForm({
  externalUserId,
  onSubmit,
  loading,
  inputBase,
  selectBase,
  buttonBase,
}) {
  const [notifyType, setNotifyType] = useState('EXPIRY_D2');
  const [notifyUserIdsText, setNotifyUserIdsText] = useState('');
  const [notifyVariantId, setNotifyVariantId] = useState('');

  const notifyIdsParsed = useMemo(
    () => tryParseExternalUserIdsText(notifyUserIdsText || externalUserId),
    [notifyUserIdsText, externalUserId]
  );

  const payload = useMemo(() => {
    const ids = notifyIdsParsed.ok ? notifyIdsParsed.ids : [];
    return {
      type: notifyType,
      variant_id: notifyVariantId || undefined,
      external_user_ids: ids,
    };
  }, [notifyIdsParsed, notifyType, notifyVariantId]);

  const validation = useMemo(() => {
    if (!notifyType) return { ok: false, message: '알림 종류를 선택해주세요.' };
    if (!notifyIdsParsed.ok) return { ok: false, message: notifyIdsParsed.message };
    if (!notifyIdsParsed.ids.length) return { ok: false, message: '대상 외부 아이디를 1개 이상 입력해주세요.' };
    return { ok: true, message: '' };
  }, [notifyType, notifyIdsParsed]);

  return (
    <div>
      <h2 className="text-lg font-bold text-white">알림 보내기(큐에 넣기)</h2>
      <p className="mt-1 text-sm text-cc-textSub">“알림을 보내달라고 요청서를 한 장 넣는 것”이에요. 실제 발송은 워커가 처리할 수 있어요.</p>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-2 text-white">알림 종류</label>
          <select className={selectBase} value={notifyType} onChange={(e) => setNotifyType(e.target.value)}>
            <option value="EXPIRY_D2">만료 2일 전</option>
            <option value="EXPIRY_D0">만료 당일</option>
            <option value="ATTENDANCE_D2">출석 2일 차</option>
            <option value="TICKET_ZERO">티켓 0개</option>
            <option value="SOCIAL_PROOF">인기/후기(표시용)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2 text-white">세부 버전(선택)</label>
          <input
            className={inputBase}
            value={notifyVariantId}
            onChange={(e) => setNotifyVariantId(e.target.value)}
            placeholder="예: base"
          />
          <p className="mt-2 text-xs text-cc-textSub">알림 문구/배너 버전(A/B)을 나눌 때만 입력해요. 비우면 기본(base) 버전이에요.</p>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-semibold mb-2 text-white">대상 외부 아이디(여러 명 가능)</label>
          <input
            className={inputBase}
            value={notifyUserIdsText}
            onChange={(e) => setNotifyUserIdsText(e.target.value)}
            placeholder={externalUserId ? `예: ${externalUserId}` : '예: ext-1, ext-2'}
          />
          <p className="mt-2 text-xs text-cc-textSub">쉼표(,)나 띄어쓰기로 구분해요. 비워두면 위의 외부 아이디를 사용해요.</p>
          {!notifyIdsParsed.ok ? <p className="mt-2 text-xs text-red-600">{notifyIdsParsed.message}</p> : null}
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          className={buttonBase}
          disabled={!!loading || !validation.ok}
          onClick={() => {
            if (!validation.ok) return;
            onSubmit(payload);
          }}
        >
          알림 요청 넣기
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
