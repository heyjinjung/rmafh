import { useMemo, useState } from 'react';
import { generateRequestId, tryParseExternalUserIdsText } from './utils';

export function ExpiryExtensionForm({
  externalUserId,
  onSubmit,
  loading,
  inputBase,
  selectBase,
  buttonBase,
  buttonGhost,
}) {
  const [extendScope, setExtendScope] = useState('USER_IDS');
  const [extendUserIdsText, setExtendUserIdsText] = useState('');
  const [extendHours, setExtendHours] = useState(24);
  const [extendReason, setExtendReason] = useState('ADMIN');
  const [extendShadow, setExtendShadow] = useState(true);
  const [extendRequestId, setExtendRequestId] = useState(() => generateRequestId('extend'));

  const extendIdsParsed = useMemo(
    () => tryParseExternalUserIdsText(extendUserIdsText || externalUserId),
    [extendUserIdsText, externalUserId]
  );

  const payload = useMemo(() => {
    const scope = extendScope;
    return {
      request_id: extendRequestId,
      scope,
      extend_hours: Number(extendHours),
      reason: extendReason,
      shadow: !!extendShadow,
      external_user_ids:
        scope === 'USER_IDS' ? (extendIdsParsed.ok ? extendIdsParsed.ids : []) : undefined,
    };
  }, [extendRequestId, extendScope, extendHours, extendReason, extendShadow, extendIdsParsed]);

  const validation = useMemo(() => {
    const h = Number(extendHours);
    if (!Number.isFinite(h) || h < 1 || h > 72) return { ok: false, message: '연장 시간은 1~72 사이 숫자여야 해요.' };
    if (extendScope === 'USER_IDS') {
      if (!extendIdsParsed.ok) return { ok: false, message: extendIdsParsed.message };
      if (!extendIdsParsed.ids.length) return { ok: false, message: '대상 외부 아이디를 1개 이상 입력해주세요.' };
    }
    if (!extendRequestId) return { ok: false, message: '요청번호가 비어있어요.' };
    return { ok: true, message: '' };
  }, [extendHours, extendScope, extendIdsParsed, extendRequestId]);

  return (
    <div>
      <h2 className="text-lg font-bold text-white">만료 시간 늘리기</h2>
      <p className="mt-1 text-sm text-cc-textSub">
        먼저 <strong className="text-white">미리보기(적용 안 함)</strong>로 확인하고, 괜찮으면 <strong className="text-white">진짜 실행</strong>을 해주세요.
      </p>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-2 text-white">적용 방식</label>
          <select className={selectBase} value={extendScope} onChange={(e) => setExtendScope(e.target.value)}>
            <option value="USER_IDS">특정 아이디만</option>
            <option value="ALL_ACTIVE">전체(진행 중인 회원)</option>
          </select>
          <p className="mt-2 text-xs text-cc-textSub">“전체”는 많은 사람에게 영향이 갈 수 있어요.</p>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2 text-white">몇 시간 늘릴까요? (1~72)</label>
          <input
            className={inputBase}
            type="number"
            min={1}
            max={72}
            value={extendHours}
            onChange={(e) => setExtendHours(e.target.value)}
            placeholder="예: 24"
          />
          <p className="mt-2 text-xs text-cc-textSub">숫자는 시간 단위예요. 예: 24 = 하루</p>
        </div>

        {extendScope === 'USER_IDS' ? (
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold mb-2 text-white">대상 외부 아이디(여러 명 가능)</label>
            <input
              className={inputBase}
              value={extendUserIdsText}
              onChange={(e) => setExtendUserIdsText(e.target.value)}
              placeholder={externalUserId ? `예: ${externalUserId}` : '예: ext-1, ext-2'}
            />
            <p className="mt-2 text-xs text-cc-textSub">쉼표(,)나 띄어쓰기로 구분해요. 비워두면 위의 외부 아이디를 사용해요.</p>
            {!extendIdsParsed.ok ? <p className="mt-2 text-xs text-red-600">{extendIdsParsed.message}</p> : null}
          </div>
        ) : null}

        <div>
          <label className="block text-sm font-semibold mb-2 text-white">왜 늘리나요?</label>
          <select className={selectBase} value={extendReason} onChange={(e) => setExtendReason(e.target.value)}>
            <option value="ADMIN">관리자</option>
            <option value="OPS">운영</option>
            <option value="PROMO">프로모션</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2 text-white">미리보기(적용 안 함)</label>
          <div className="flex items-center gap-3 border border-gold-primary/30 rounded-[4px] px-3 py-2 bg-black">
            <input
              id="extendShadow"
              type="checkbox"
              checked={extendShadow}
              onChange={(e) => setExtendShadow(e.target.checked)}
            />
            <label htmlFor="extendShadow" className="text-sm text-cc-textSub">
              체크하면 “적용하지 않고 후보만 보여줘요”
            </label>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2">
          <button className={buttonGhost} disabled={!!loading} onClick={() => setExtendRequestId(generateRequestId('extend'))}>
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
          만료 시간 늘리기 실행
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
