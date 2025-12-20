# Vault v2.0 테스트 전략

## 1. 메타
- 문서 타입: 테스트 전략
- 버전: v0.2
- 작성일: 2025-12-20
- 대상: QA/백엔드/프론트엔드

## 2. 범위
- BE: 상태 조회, 수령, 출석, (추가 예정) 입금 훅, (추가 예정) 만료 배치, 알림 트리거
- FE: 금고 대시보드 UI, 진행률/타이머, 모달/토스트, 상태 라벨/카피
- 데이터: vault_status 스키마, 만료/아카이빙

## 3. 테스트 유형
- 단위: 서비스/도메인 로직, 상태 전이, 검증 로직
- 통합: API + DB, deposit-hook idempotency, attendance 일일 락
- 계약(API): 응답 스키마/에러 코드 검증
- E2E(UI): 대시보드 노출, 해금/출석/만료 플로우
- 배치/잡: 만료 배치, 알림 배치, DLQ 재처리

## 3.1 현재 자동화 테스트 현황(2025-12-20)
- 존재: `/health`, `/api/vault/notify`, `/api/vault/compensation-enqueue`, `/api/vault/referral-revive`
- TODO: `/api/vault/status`, `/api/vault/claim`, `/api/vault/attendance`에 대한 통합/계약 테스트 추가

## 4. 주요 케이스 (발췌)
- 상태 전이: LOCKED→UNLOCKED→CLAIMED, 만료 시 EXPIRED
- 플래티넘 조건: (출석 3 AND 단일 50,000) 만족/불만족/부분만족
- 다이아 조건: 누적 500,000 미만/이상 경계값
- 출석: 하루 1회, 중복 시 409
- 입금: tx_id 중복 409, 음수/0 금액 400, 미래 occurred_at 400
- 만료: expires_at 경과 후 수령/출석 시 403
- 알림: EXPIRY_D2 필터링 정확도, ATTENDANCE_D2 대상 선정
- UI: 카운트다운 표시, 게이지 퍼센트 계산, 티켓0 모달 자동 표시
- UI 추가: 손실 시뮬레이터 총합 계산 정확도, 만료 <1h ms 타이머 전환, 사회적 증거 토스트 노출/쿨다운, 개인화 배너 노출 조건
- 부활권/연장: referral-revive 1회 제한, extend-expiry shadow 모드 미적용 확인, 실제 적용 시 expires_at 증가 검증
- A/B 알림: variant_id별 템플릿 분기, dedup_key에 variant 포함, variant별 전환 집계
- 보상 재시도: claim 외부 실패 시 202 + compensation_queue enqueue, 워커 재시도 후 최종 상태/중복 방지

## 5. 픽스처/모킹
- Clock mock: now 고정, 만료/출석/배치 테스트에 사용
- Payment mock: deposit-hook 콜백 더미(tx_id 고유)
- Notification mock: 큐/발송 어댑터 더블, enqueue/assert 호출
- DB seed: user + vault_status 초기 LOCKED, expires_at 가변

## 6. 커버리지 목표
- 도메인/서비스 단위 라인/분기 커버리지 80%+
- API 계약: 스키마 스냅샷 또는 OpenAPI 검증
- E2E: 핵심 플로우(골드 해금, 플래티넘 조건 충족, 만료) 최소 3 시나리오

## 7. 자동화/파이프라인
- PR: 단위+통합+계약 테스트 실행, 린트, 타입체크
- 배치: 스케줄러 로직은 통합 테스트와 별도 배치 시뮬레이션

## 8. 회귀/릴리스 체크
- 만료 로직, 알림 필터, idempotency는 릴리스 전 회귀 필수
