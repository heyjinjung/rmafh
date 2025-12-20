# Vault v2.0 개발 순서

## 1) 데이터/스키마
- vault_status 확장 필드(expires_initial_at, expiry_extend_count, last_extension_*) 적용
- notifications_queue variant_id, compensation_queue, vault_expiry_extension_log 생성
- 시드/백필: 신규 유저 기본 레코드, 기존 유저 백필 옵션

## 2) 백엔드 API/도메인
- status/claim/attendance 완료
- deposit-hook은 아직 미구현(문서 설계만 존재)
- referral-revive (+24h), extend-expiry(admin, shadow 지원) 구현
- claim 외부 보상 실패 시 compensation_queue enqueue 로직
- notify API variant_id 검증, social_proof/referral_revive 타입 추가

## 3) 배치/워커
- 만료 배치(스케줄러/잡)는 아직 미구현(워커는 compensation_queue 처리만 존재)
- 알림 필터: EXPIRY_D2/D0, ATTENDANCE_D2, TICKET_ZERO, SOCIAL_PROOF, REFERRAL_REVIVE
- CompensationWorker: 지수 백오프, DLQ 연계

## 4) 프런트엔드
- 카드/배지/그라디언트 스타일 + 메인 페이지 레이아웃(사이드바/푸터/메인) 구현
- 상태 조회/출석/수령 연동: `/api/vault/status|attendance|claim` (Next 프록시 통해 백엔드 호출)
- <1h ms 타이머/손실 시뮬레이터/사회적 증거 토스트/부활권 CTA/티켓0 모달은 아직 미구현

## 5) 관측/로그/메트릭
- 이벤트: EXPIRY_EXTENDED, REFERRAL_REVIVED, COMPENSATION_ENQUEUED
- 메트릭: variant별 전환, loss_banner 클릭→CLAIM, compensation_retry_success
- 알람: compensation_pending, variant 성능 편차

## 6) 테스트
- 단위: 상태 전이, 멱등(request_id/tx_id), 연장 제한
- 통합: referral-revive/extend-expiry shadow·실 적용, notify variant dedup
- E2E: 손실 배너, ms 타이머, 사회적 증거 토스트, 부활권 흐름, 보상 재시도

## 7) 운영/런북
- 연장 롤백: extension_log 기반 prev_expires_at 복원 스크립트
- compensation_queue 수동 지급 플로우, DLQ 대응

## 8) 롤아웃
- 실험 플래그: loss_banner, social_proof, narrative push, ticket_zero variants
- Shadow → 제한적(5%) → 단계별 확장, 지표 감시 후 전량
