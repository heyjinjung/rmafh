# Vault v2.0 프런트엔드 구현 순서

## Changelog
- 2025-12-20 v0.1: 현재 구현 상태에 맞춰 출석 CTA 제거/수령 중심 UX로 정합화

## 0. 현재 구현 상태(2025-12-20)
- 구현 위치: `frontend/pages/index.jsx`
- 데이터 패칭: `react-query` 대신 `fetch + useState/useEffect` 기반
- API 호출: Next 설정(`trailingSlash: true`)에 맞춰 `/api/vault/status/`, `/api/vault/claim/` 형태로 호출
- 프록시: `frontend/pages/api/vault/*`가 백엔드(`NEXT_PUBLIC_API_BASE`, 기본 `http://api:8000`)로 프록시
- UI: 3개 금고 카드 + 카운트다운 + CTA(수령) + 완성 보너스(프론트 계산)까지 구현
- 미구현: 손실 플로팅 배너/사회적 증거 토스트/부활권 모달/티켓0 모달/개인화 배너

## 1. 스타일/토큰
- 전역 테마: 배경 #050505 라디얼, 포인트 색상(GOLD #D2FD9C, PLAT #07AF4D, DIA #0AA787, WARN #F97935)
- 폰트: Noto Sans KR(400/500/700) + 모노 숫자(ms 타이머)
- CSS 변수화: 색상/그라디언트/보더/쉐도우 토큰

## 2. 상태/데이터 페칭
- (추가 구현 예정) react-query 도입 시
	- query: ["vault","status"] (staleTime 15s)
	- mutation: claim, referral-revive; 성공 시 status invalidate

## 3. 컴포넌트
- VaultCard: 네온 그라디언트 헤더/배지, 진행률 바, CTA 버튼 shine
- FloatingLossBanner: loss_total 표시, 긴급 시 ms 타이머 연동, CTA 스크롤 포커스
- UrgentCountdown: <1h ms 타이머, 오프셋 보정, prefers-reduced-motion 대응
- SocialProofToast: variant_id별 카피, 24h 쿨다운 로직
- PersonalCurationBanner: curation_tier 기반 카피/CTA
- ReferralReviveModal: D-1 사용자 CTA, 성공 시 toast+refetch
- TicketZeroModal: 인터럽션 카피 유지
- BonusProgress: 완성 보너스 진행률/마커

## 4. 인터랙션/모션
- hover/tap scale, 아이콘 부유, 배지/토스트 scale-in
- 버튼 shine 2s 주기, progress edge glow
- prefers-reduced-motion 시 애니메이션 비활성

## 5. 에러/빈 상태
- INVALID_STATE/EXPIRED/CONFLICT 메시지 매핑
- 만료/데이터 실패: 상단 배너 + 재시도 버튼

## 6. figma:react 연동
- defineProperties로 animationIntensity, showTimer, showCompletionBonus 등 노출
- Figma 토큰: 색/그라디언트/라운드 수치 동기화 (옵션)

## 7. 실험/플래그
- loss_banner, social_proof, narrative push, ticket_zero variants 플래그/variant_id 매핑 적용
- 카피는 [docs/EXPERIMENTS_AND_COPY_VAULT_V2.md] 기준 i18n 키 매핑
