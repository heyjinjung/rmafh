# Vault v2.0 FE 와이어프레임 (텍스트 스케치)

## 1. 메타
- 문서 타입: FE 와이어프레임
- 버전: v0.1 (초안)
- 작성일: 2025-12-20
- 대상: 프론트엔드/디자이너/기획자

## 2. 홈 상단: 금고 대시보드 섹션
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

## 3. 티켓 0개 시 모달
- 트리거: 잔액 0 및 플레이 시도 → 자동 팝업
- 메시지: "티켓은 다 떨어졌지만 금고에 보관된 30,000원이 있습니다. 지금 해금하고 게임을 계속하세요."
- CTA: "플래티넘 해금하러 가기"

## 4. 알림/토스트 패턴
- 출석 성공: "D-?일, 30,000원 보관 중" 토스트
- 만료 임박: 상단 바(스티키), 붉은 배경, 카운트다운 초 단위 노출

## 5. 레이아웃 메모
- 모바일 우선, 카드 스택 + 고정 하단 CTA
- 데스크톱: 3컬럼 그리드 + 사이드에 완성 보너스 배너

## 6. 상태 매핑 (FE 라벨)
- LOCKED → "보관 중"
- UNLOCKED → "해금 가능"
- CLAIMED → "수령 완료"
- EXPIRED → "소멸됨"

## 7. 컴포넌트 구조 (초안)
- pages/HomePage (또는 VaultPage): 금고 섹션 렌더, query로 상태 조회
- components/VaultSummary: 7일 카운트다운, 완성 보너스 배너
- components/VaultCard:
	- props: type, status, reward, progress, expiresAt, onClaim, onAction
	- 내부: 진행률 바, 상태 배지, CTA 버튼, 타이머
- components/ProgressBar, CountdownBadge, Checklist (골드 미션), Gauge (다이아 %)
- modal/TicketZeroModal: 티켓 0개 시 자동 호출
- toast/AlertToast: 출석/만료 임박 알림

## 8. 상태 관리 & query keys
- 라이브러리: react-query (또는 tanstack-query)
- queryKey: ["vault","status"] → GET /api/vault/status (staleTime 15s, refetchOnWindowFocus true)
- mutation keys:
	- claim: ["vault","claim", vaultType]
	- attendance: ["vault","attendance"]
	- deposit-hook는 FE 직접 호출 안 함 (내부)
- optimistic update: claim/attendance 성공 시 vault status 캐시 invalidate 또는 수동 merge
- 에러 핸들링: INVALID_STATE/EXPIRED/CONFLICT 별 사용자 메시지 분기

## 9. 캐싱/리페치 전략
- 최초 진입 시 status fetch, 30초 간격 background refetch
- Claim/Attendance 성공 후: invalidateQueries(["vault","status"])
- 만료 임박 UI: expires_at 기준 클라이언트 타이머, 5분 주기 서버 동기화
- 티켓 0개 감지: 별도 ticket_balance query가 있다면 onSuccess 훅에서 모달 오픈

## 10. 로딩/에러 UX
- skeleton: 카드별 스켈레톤 3개
- 에러: 상단 배너 "상태를 불러오지 못했습니다. 다시 시도" + 재시도 버튼(refetch)

## 11. 접근성/국제화
- 타이머/금액 읽기용 aria-label 제공
- 카피는 i18n 키로 관리, “보관/소멸” 톤 유지

## 12. 라우팅 맵 (예시)
- /home (또는 /vault): 금고 대시보드 노출, status query 실행
- /vault/claim?type=GOLD: 해금/수령 플로우 진입 (모달 또는 전환)
- /charge: 충전 플로우, 완료 시 vault status invalidate 후 /vault 리다이렉트
- 404: 공통 에러 페이지로, vault 상태 재조회 버튼 제공

## 13. 상태 머신 (요약 텍스트)
- Gold: LOCKED → UNLOCKED (채널 추가) → CLAIMED, 만료 시 LOCKED → EXPIRED
- Platinum: LOCKED → (출석 3/3 AND 단일 50,000 충전) → UNLOCKED → CLAIMED, 만료 시 EXPIRED
- Diamond: LOCKED → (누적 500,000 충전) → UNLOCKED → CLAIMED, 만료 시 EXPIRED
- 공통 가드: expires_at 초과 시 어떤 전이도 거부하고 EXPIRED 표시
