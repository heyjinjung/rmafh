# Vault v2.0 프런트엔드 구현 순서

## 1. 스타일/토큰
- 전역 테마: 배경 #050505 라디얼, 포인트 색상(GOLD #D2FD9C, PLAT #07AF4D, DIA #0AA787, WARN #F97935)
- 폰트: Noto Sans KR(400/500/700) + 모노 숫자(ms 타이머)
- CSS 변수화: 색상/그라디언트/보더/쉐도우 토큰

## 2. 상태/데이터 페칭
- react-query: ["vault","status"] (staleTime 15s) → loss_total, loss_breakdown, ms_countdown, referral_revive_available, social_proof, curation_tier 사용
- mutation: claim, attendance, referral-revive; 성공 시 status invalidate

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
