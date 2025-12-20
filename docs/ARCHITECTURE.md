# Vault Retention v2.0 기술 설계서

## 1. 메타
- 문서 타입: 모듈(기능: FE+BE+DB)
- 버전: v2.0 (신규 유저 전용 전략 반영)
- 작성일: 2025-12-19
- 대상: 기획자, 백엔드/프론트엔드 개발자

## 2. 개요 및 철학
- 손실 회피(Loss Aversion) 기반 금고: 이미 가진 자산이 소멸될 수 있다는 압박을 통해 행동 유도
- Endowment Effect: 금고 재화를 유저 소유로 인지시키는 UI/카피
- Investment: 출석/충전 누적 투자로 포기 비용 상승

## 3. 금고 구조 (Immutable)
- 골드: 10,000원, CC/공지 채널 추가, 진입장벽 0
- 플래티넘: 30,000원, 단일 50,000원 충전 + 3일 출석
- 다이아: 쿠폰 100,000원, 누적 500,000원 충전
- 완성 보너스: 가입 7일 내 3종 모두 클리어 시 추가 보상

## 4. 운영 전략 (UX/카피)
- 가입 직후: “보관 중(Stored)” 상태로 3개 금고 지급, 7일 카운트다운 노출
- 골드: 가입 24시간 내 80% 이상 달성 목표, 즉시 해금 연출 강조
- 플래티넘: 손실 공포 핵심 — “30,000원이 3일 뒤 소멸” 메시지, 출석 누적 표시
- 다이아: 진행률 게이지(%)로 시각적 앵커 제공
- 티켓 0개 시: “잠긴 금고” 모달로 소멸 프레이밍 전환
- 초기 5판 보정: 최소 1회 Win → 골드 금고 적립 연출

## 5. 리텐션 트리거 (알림)
- 48시간 미충전: 플래티넘 소멸 경고
- 출석 2일차: “마지막 1일 남음, 포기 시 소멸” 경고

## 6. 데이터 모델
- 테이블: vault_status (유저별 금고 상태)

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| user_id | INT, PK/FK | 유저 식별자 |
| gold_status | ENUM(LOCKED, UNLOCKED, CLAIMED, EXPIRED) | 골드 상태 |
| platinum_status | ENUM(LOCKED, UNLOCKED, CLAIMED, EXPIRED) | 플래티넘 상태 |
| diamond_status | ENUM(LOCKED, UNLOCKED, CLAIMED, EXPIRED) | 다이아 상태 |
| platinum_attendance_days | INT | 플래티넘 출석 일수(0~3) |
| platinum_deposit_done | BOOLEAN | 단일 50,000원 충전 여부 |
| diamond_deposit_current | INT | 누적 충전액 |
| created_at | DATETIME | 가입 기준 시점 |
| expires_at | DATETIME | 가입 +7일 만료 |

### 6.1 상태 전이 규칙 (요약)
- 골드: 채널 추가 시 UNLOCKED → CLAIMED, 미달성 만료 시 EXPIRED
- 플래티넘: (단일 50,000원 충전) AND (출석 3일) 시 UNLOCKED → CLAIMED, 만료 시 EXPIRED
- 다이아: 누적 500,000원 시 UNLOCKED → CLAIMED, 만료 시 EXPIRED
- 만료 스케줄러: expires_at 도래 시 LOCKED 상태를 EXPIRED로 일괄 전환

## 7. 백엔드 설계 (가안)
- API (예시)
	- GET /api/vault/status: 금고 3종 상태/진행률/만료 타이머 반환
	- POST /api/vault/claim: 금고별 수령 처리, 중복 수령 방지
	- POST /api/vault/attendance: 출석 체크 후 플래티넘 진행률 반영
- 도메인 서비스
	- VaultService: 상태 조회/전이, 만료 처리, 보상 지급
	- Hooks: DepositHook(단일 50,000원, 누적 500,000원), AttendanceHook(일 1회 증가)
- 스케줄러
	- 만료 배치: expires_at 기준 EXPIRED 처리
	- 알림 배치: 소멸 D-2, 출석 2일차 경고
- 관측성
	- 이벤트 로그: UNLOCKED, CLAIMED, EXPIRED, ALERT_SENT
	- 메트릭: 단계별 이탈률, 출석 진행률, 누적 충전 분포

## 8. 프런트엔드 설계 (가안)
- 금고 대시보드: 골드/플래티넘/다이아 카드, 7일 카운트다운, 진행률 게이지
- 카피: “보관 중/소멸 예정/회수 경고” 톤 유지, “충전” 단어 최소화
- 플로우
	- 온보딩 완료 → 금고 지급 화면 → 골드 즉시 해금 연출 → 플래티넘/다이아 진행률 노출
	- 티켓 0개 상황에서 금고 해금 유도 모달 자동 호출
- 상태 표현
	- LOCKED=보관 중, UNLOCKED=해금 가능, CLAIMED=수령 완료, EXPIRED=소멸

## 9. 갭 분석 (2025-12-19)
- DB: vault_status 테이블 미구현
- BE: 3단계 미션 트랙/출석/충전 훅/만료 배치 미구현
- FE: 금고 UI/타이머/게이지/완성 보너스 미구현

## 10. 단계별 계획
- Phase 1: DB 마이그레이션 및 모델 작성 → 상태 조회 API
- Phase 2: 입금/출석 훅, 만료 배치, 알림 트리거
- Phase 3: FE 금고 대시보드, 타이머/게이지, 카피/모달 적용
- Phase 4: 관측성(로그/메트릭) 및 퍼널 대시보드

## 11. 보안/운영 메모
- 비밀정보는 환경 변수/비밀관리 사용, 최소 권한 DB 계정
- 입력 검증 및 중복 수령 방지 로직 필수
- 오류/만료/수령 이벤트 로깅으로 감사 추적 확보
