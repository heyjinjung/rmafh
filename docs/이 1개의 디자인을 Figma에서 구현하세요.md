이 1개의 디자인을 Figma에서 구현하세요. [모든 뷰포트용 레이아웃]
@https://www.figma.com/design/vTESGchw1bzOuJp8SRMmQq/%EC%94%A8%EC%94%A8001?node-id=64-388&m=dev

이 1개의 디자인을 Figma에서 구현하세요. [사이드바컨테이너 - 데스크탑]
@https://www.figma.com/design/vTESGchw1bzOuJp8SRMmQq/%EC%94%A8%EC%94%A8001?node-id=64-310&m=dev

이 1개의 디자인을 Figma에서 구현하세요. . [사이드바컨테이너 -태블릿]
@https://www.figma.com/design/vTESGchw1bzOuJp8SRMmQq/%EC%94%A8%EC%94%A8001?node-id=64-337&m=dev

이 1개의 디자인을 Figma에서 구현하세요.  [사이드바컨테이너 -모바일]
@https://www.figma.com/design/vTESGchw1bzOuJp8SRMmQq/%EC%94%A8%EC%94%A8001?node-id=64-372&m=dev

이 1개의 디자인을 Figma에서 구현하세요. [푸터]
@https://www.figma.com/design/vTESGchw1bzOuJp8SRMmQq/%EC%94%A8%EC%94%A8001?node-id=64-326&m=dev

이 1개의 디자인을 Figma에서 구현하세요. [핵심 금고디자인 = 메인]
@https://www.figma.com/design/vTESGchw1bzOuJp8SRMmQq/%EC%94%A8%EC%94%A8001?node-id=64-307&m=dev

이 1개의 디자인을 Figma에서 구현하세요. [완전체 데스크탑]
@https://www.figma.com/design/vTESGchw1bzOuJp8SRMmQq/%EC%94%A8%EC%94%A8001?node-id=64-305&m=dev

이 1개의 디자인을 Figma에서 구현하세요. [완전체태블릿]
@https://www.figma.com/design/vTESGchw1bzOuJp8SRMmQq/%EC%94%A8%EC%94%A8001?node-id=64-334&m=dev

이 1개의 디자인을 Figma에서 구현하세요. [완전체 모바일]
@https://www.figma.com/design/vTESGchw1bzOuJp8SRMmQq/%EC%94%A8%EC%94%A8001?node-id=64-361&m=dev


프론트는 완전히 이렇게 진행할건데
1) 피그마 MCP활용할것
1-1) 먼저 본 소스와 내용을 문서화 할것 
그 후 적정 토큰과 프론트 개발순서에 따라 개발을 진행할 것 
2) 우리 백앤드 개발요소에 맞추어 본 프론트앤드 디자인을 변경할것
3) 즉 API/스키마/테이블은 우리 백앤드를 활용할것 
4) 기타 디자인 에 필요한 스택은 현재 구현된 피그마의 기준을 따를 것 


Figma 접근: MCP로 연동 가능한지, 토큰/파일 접근 권한을 알려주세요.
ㄴ 니가 현재 상태 알아봐봐
2. 우선순위: 완전체 vs 개별 섹션(메인/사이드바/푸터) 중 어떤 것부터 진행할까요? - 보통 개발 순서를 따라줘 / 효율적인 순서
3. 백엔드 연동 정보: API 스펙/스키마(예: 문서나 샘플 응답)와 로컬 호출 방법이 필요합니다. - 프로젝트 서치하여 찾아
UI 가이드: FE 스타일 가이드나 컴포넌트 규칙이 있다면 알려주세요(없다면 제가 정리해서 제안드릴게요). - 니가 정리해서 제안해줘 
산출물 형태: 먼저 구현 계획서(구성/라우팅/데이터바인딩/컴포넌트 매핑)부터 작성할까요, 아니면 바로 코드 작업에 착수할까요? - 1번 작업 완료되면 구현계획서 작성

추천 개발 순서(효율 기준)

전역 토큰·폰트·CSS 변수 세팅(배경/그라디언트/라운드/쉐도우, Noto Sans KR+모노).
페이지 뼈대/레이아웃(모바일 우선): 헤더/그리드/플로팅 배너.
데이터 패칭 훅(query: ["vault","status"]), 에러·로딩 UI.
핵심 카드 컴포넌트(VaultCard 3종) + 진행률/타이머.
플로팅 손실 배너, 긴급 ms 타이머, 토스트/알림.
모달(티켓 0, Referral Revive) 및 실험 플래그/카피.
접근성/모션 토글, i18n 키 정리.
제안 UI 가이드(문서 기반 압축)

컬러/톤: 배경 #050505 라디얼, 포인트 GOLD #D2FD9C, PLAT #07AF4D, DIA #0AA787, WARN #F97935. CSS 변수로 정의.
카드: 20px+ 라운드, 헤더 그라디언트 + 어두운 바디, 1–2px 하이라이트 보더, box-shadow+살짝 글로우.
버튼: 그라디언트+shine(2s), hover 1.02/tap 0.98, disabled는 desat+반투명 보더.
배지/타이머: 상태 배지 그라디언트, <1h 구간 ms·모노스페이스·저채도 점멸, aria-live polite.
모션: 카드 hover y-5px, 아이콘 부유, 토스트 scale-in; prefers-reduced-motion 시 중단.
레이아웃: 모바일 1열, 태블릿 2열, 데스크탑 3열 그리드; 플로팅 손실 배너는 모바일 하단 스티키/데스크탑 우하단.


우선순위: 데스크탑 완전체 → 핵심 메인(금고 카드) → 사이드바 컨테이너 → 푸터 → 태블릿 → 모바일.
레이아웃/라우팅
페이지: /(또는 /vault), 모바일 1열/태블릿 2열/데스크탑 3열 그리드.
고정 요소: 플로팅 손실 배너(모바일 하단 스티키, 데스크탑 우하단), 상단 헤더+카운트다운 배지.
데이터 바인딩
query: ["vault","status"] → GET /api/vault/status (staleTime 15s, background refetch 30s).
mutation: claim/attendance/referral-revive 성공 시 status invalidate.
만료 <1h: ms 타이머 전환, ms_countdown.remaining_ms 사용.
loss_total/loss_breakdown → 플로팅 배너 금액 합산(LOCKED/UNLOCKED만).
컴포넌트 매핑
VaultCard 3종: status 배지, 타이머, 진행률(출석/충전/누적), CTA(shine), 상태별 버튼 가드.
FloatingLossBanner: loss_total, 긴급 ms 타이머, CTA 스크롤 포커스.
UrgentCountdown: <1h ms 표기, 오프셋 보정, prefers-reduced-motion 대응.
BonusProgress: 완성 보너스 3단계 마커.
SocialProofToast, ReferralReviveModal, TicketZeroModal.
스타일/토큰
CSS 변수: 배경 #050505 라디얼, GOLD #D2FD9C, PLAT #07AF4D, DIA #0AA787, WARN #F97935, 라운드 20px+, 하이라이트 보더 1–2px, box-shadow+살짝 글로우.
폰트: Noto Sans KR 400/500/700 + 모노 숫자(타이머).
모션: 카드 hover y-5px, 버튼 shine 2s, 토스트 scale-in, prefers-reduced-motion 시 비활성.
에러/빈 상태
API 에러 배너 + 재시도 버튼.
INVALID_STATE/EXPIRED/CONFLICT 메시지 매핑.
skeleton: 카드별 스켈레톤 3개.
접근성/i18n
타이머/금액 aria-label, i18n 키로 카피 관리, “보관/소멸” 톤 유지.