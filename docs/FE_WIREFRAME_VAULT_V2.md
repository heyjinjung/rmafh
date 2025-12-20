# Vault v2.0 FE 와이어프레임 (텍스트 스케치)

## 1. 메타
- 문서 타입: FE 와이어프레임
- 버전: v0.2 (초안)
- 작성일: 2025-12-20
- 대상: 프론트엔드/디자이너/기획자

## 2. 홈 상단: 금고 대시보드 섹션
- 현재 구현(2025-12-20): 3개 카드 UI + 카운트다운 + CTA(출석/수령) + 완성 보너스 섹션까지 구현됨.
- 아직 미구현: 손실 시뮬레이터 플로팅 배너, 사회적 증거 토스트, 부활권 CTA 모달, 티켓 0 모달.
- 헤더: "신규 금고 보관 중 (7일 후 소멸)" + 카운트다운 배지(빨강)
- 3컬럼(모바일은 세로 스택): Gold / Platinum / Diamond 카드
- 공통 요소: 상태 배지(보관/해금/수령/소멸), 남은 시간, CTA 버튼, 진행률 바

### 2.1 Gold 카드
- 보상: 10,000원 표시
- 미션: "CC 채널 + 지민 공지 채널 추가" 체크박스 2개
- CTA: "바로 해금" (채널 연결 플로우 진입) → 성공 시 폭죽 이펙트, 상태 UNLOCKED → CLAIMED

### 2.2 Platinum 카드
- 보상: 30,000원, 강조색(경고)
- 진행률 바 2트랙: (1) 출석 0/3 (2) 충전 0/1 (>=50,000원 단일)
- 카피: "30,000원이 소멸 예정, 3일 뒤" (붉은 경고)
- CTA: "오늘 출석" / "충전하기" 버튼 2개

### 2.3 Diamond 카드
- 보상: 쿠폰 100,000원
- 진행률: 누적 충전 게이지(%) + 현재 금액 표기
- 카피: "현재 18% 달성" 스타일, 소멸 타이머 포함

### 2.4 완성 보너스 배너
- 문구: "7일 내 3개 모두 회수하면 추가 보너스" / "2/3 완료" 강조
- 진행률 바: 3단계 체크아이콘

### 2.5 손실 시뮬레이터 플로팅 배너
- 위치: 화면 하단 우측(모바일은 하단 스티키), 스크롤 시 항상 노출
- 내용: "지금 포기하면 사라질 혜택 합계" = 미수령 금고 보상 총합(골드/플래티넘/다이아 + 완성 보너스 포함) 실시간 계산
- 상태별 표시: CLAIMED 금고는 제외, EXPIRED는 0 처리, UNLOCKED/LOCKED만 합산
- 인터랙션: 클릭 시 가장 긴급한 금고 카드로 스크롤/포커스; 배너 내 CTA "지금 회수" 버튼
- 타이머 연동: 만료 < 1h 남은 경우 배너 내부 타이머는 ms 단위로 전환

### 2.6 긴박 타이머(ms) 전환
- 조건: expires_at - now < 1시간 → 초 단위에서 ms 단위(###:##:###)로 자동 전환
- 시각 효과: 배경 점멸(저채도 빨강) 1초 간격, ms 숫자는 모노스페이스 폰트
- 동기화: 30초 간격으로 서버 now와 보정, 오프셋 보정값을 타이머에 반영
- 접근성: aria-live polite, 시각 효과는 prefers-reduced-motion 시 정지

## 3. 티켓 0개 시 모달
- 트리거: 잔액 0 및 플레이 시도 → 자동 팝업
- 메시지: "잠시만요! 그냥 나가시게요? 금고에 30,000원이 울고 있어요." (보관/소멸 프레이밍)
- 서브 카피: "티켓은 없지만 플래티넘 금고가 열리면 즉시 30,000원 회수"
- CTA: "플래티넘 해금하러 가기" (secondary: "나중에 다시 보기")

## 4. 알림/토스트 패턴
- 출석 성공: "D-?일, 30,000원 보관 중" 토스트
- 만료 임박: 상단 바(스티키), 붉은 배경, 카운트다운 초 → 1시간 전부터 ms 단위 전환
- 사회적 증거 토스트: "지금 4,231명이 플래티넘 금고를 회수했습니다" (A/B: 강한 어조 vs 부드러운 어조, variant_id 기반)
- 의인화 푸시/인앱: "주인님, 저 여기서 48시간 뒤면 영영 사라져요... 꼭 찾아가 주세요" (A/B 실험 대상)
- CLAIMED 즉시 피드백: "똑똑한 선택입니다! 10,000원의 손실을 막아냈습니다." 토스트/모달
- 티켓 0 모달 재진입 시 인터럽션 카피 유지

## 5. 개인화/큐레이션 배너
- 초기 플레이 패턴 기반: "당신은 '골드'보다 '다이아몬드'에 더 가까운 고액 예치자 관상이네요!"
- 노출 위치: 금고 카드 상단 혹은 플로팅 배너 상단
- 조건: 충전액/플레이타임/출석 빈도 기반 퍼널 스코어 → HIGH_VALUE, MID_VALUE 등급으로 매핑
- CTA: 해당 사용자가 가까운 금고 타입 카드로 스크롤/포커스

## 6. 레이아웃 메모
- 모바일 우선, 카드 스택 + 고정 하단 CTA
- 데스크톱: 3컬럼 그리드 + 사이드에 완성 보너스 배너

## 6.1 시각 디자인 가이드(보스 요구 반영)
- 톤/배경: 암흑 배경(#050505) + 라디얼 그라디언트, 네온 포인트색(골드: #D2FD9C, 플래티넘: #07AF4D, 다이아: #0AA787, 경고: #F97935)
- 카드: 라운드 20px+, 컬러별 그라디언트 헤더 + 살짝 어두운 바디, 2px 하이라이트 테두리
- 배지: 상태/리워드 배지는 그라디언트 + drop-shadow; AVAILABLE는 카드 우상단 대각 배지, LOCKED는 주황 경고 배지
- 미션 체크리스트: 반투명 블랙 패널 + 컬러체크 아이콘 + 힌트 텍스트(이탤릭)
- 타이머: 헤더/배너에 강조 배경(주황), <1h 구간은 ms 단위 표기와 점멸 애니메이션(저채도)
- CTA: 그라디언트 버튼 + 흐르는 빛(shine) 애니메이션; 잠김 상태는 desat + 회색 보더
- 헤더: 상단 제목 그라디언트 텍스트 + NEW 라벨 + 얇은 언더라인 글로우; 서브배지로 "이벤트 종료까지 N일 N시간" + LIMITED EVENT 토큰
- 폰트: Noto Sans KR, 가중치 400/500/700 사용

## 7. 상태 매핑 (FE 라벨)
- LOCKED → "보관 중"
- UNLOCKED → "해금 가능"
- CLAIMED → "수령 완료"
- EXPIRED → "소멸됨"

## 8. 컴포넌트 구조 (초안)
- pages/HomePage (또는 VaultPage): 금고 섹션 렌더, query로 상태 조회
- components/VaultSummary: 7일 카운트다운, 완성 보너스 배너
- components/VaultCard:
	- props: type, status, reward, progress, expiresAt, onClaim, onAction
	- 내부: 진행률 바, 상태 배지, CTA 버튼, 타이머
- components/ProgressBar, CountdownBadge, Checklist (골드 미션), Gauge (다이아 %)
- modal/TicketZeroModal: 티켓 0개 시 자동 호출
- modal/ReferralRevive: D-1 사용자를 위한 부활권 CTA, 성공 시 만료 +24h
- toast/AlertToast: 출석/만료 임박/CLAIMED 축하/사회적 증거 알림
- banner/FloatingLossBanner: 손실 시뮬레이터 플로팅, ms 타이머 연동
- banner/PersonalCuration: 개인화 큐레이션 카피/CTA
- timer/UrgentCountdown: 1h 미만 ms 전환, 오프셋 보정 지원

## 9. 상태 관리 & query keys
- 라이브러리: react-query (또는 tanstack-query)
- queryKey: ["vault","status"] → GET /api/vault/status (staleTime 15s, refetchOnWindowFocus true)
- mutation keys:
	- claim: ["vault","claim", vaultType]
	- attendance: ["vault","attendance"]
	- referral revive: ["vault","referral-revive"] (D-1 부활권)
	- deposit-hook는 FE 직접 호출 안 함 (내부)
- optimistic update: claim/attendance 성공 시 vault status 캐시 invalidate 또는 수동 merge
- 에러 핸들링: INVALID_STATE/EXPIRED/CONFLICT 별 사용자 메시지 분기

## 10. 캐싱/리페치 전략
- 최초 진입 시 status fetch, 30초 간격 background refetch
- Claim/Attendance 성공 후: invalidateQueries(["vault","status"])
- 만료 임박 UI: expires_at 기준 클라이언트 타이머, 5분 주기 서버 동기화
- 티켓 0개 감지: 별도 ticket_balance query가 있다면 onSuccess 훅에서 모달 오픈

## 11. 긴급/만료 UX
- 만료 < 1h: ms 타이머 + 붉은 배경 상단 바 + 플로팅 배너 동기화
- 만료 D-1: ReferralRevive CTA 노출, 성공 시 expires_at +24h 갱신 후 토스트
- 사회적 증거: 상단 토스트는 30초 주기 업데이트(옵션 SSE/폴링)

## 12. 로딩/에러 UX
- skeleton: 카드별 스켈레톤 3개
- 에러: 상단 배너 "상태를 불러오지 못했습니다. 다시 시도" + 재시도 버튼(refetch)

## 13. 접근성/국제화
- 타이머/금액 읽기용 aria-label 제공
- 카피는 i18n 키로 관리, “보관/소멸” 톤 유지

## 14. 라우팅 맵 (예시)
- /home (또는 /vault): 금고 대시보드 노출, status query 실행
- /vault/claim?type=GOLD: 해금/수령 플로우 진입 (모달 또는 전환)
- /charge: 충전 플로우, 완료 시 vault status invalidate 후 /vault 리다이렉트
- 404: 공통 에러 페이지로, vault 상태 재조회 버튼 제공

## 15. 상태 머신 (요약 텍스트)
- Gold: LOCKED → UNLOCKED (채널 추가) → CLAIMED, 만료 시 LOCKED → EXPIRED
- Platinum: LOCKED → (출석 3/3 AND 단일 50,000 충전) → UNLOCKED → CLAIMED, 만료 시 EXPIRED
- Diamond: LOCKED → (누적 500,000 충전) → UNLOCKED → CLAIMED, 만료 시 EXPIRED
- 공통 가드: expires_at 초과 시 어떤 전이도 거부하고 EXPIRED 표시
