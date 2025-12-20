# Vault v2.0 백엔드 구현 순서

## 1. 상태/도메인 업데이트
- vault_status 모델: expires_initial_at, expiry_extend_count, last_extension_reason/at 필드 반영
- 요청 멱등: request_id(X-Request-Id)로 DUPLICATE_REQUEST 처리

## 2. API
- GET /api/vault/status: loss_total, loss_breakdown, ms_countdown, referral_revive_available, social_proof, curation_tier 반환
- POST /api/vault/claim: (현재) UNLOCKED만 수령 가능, 응답은 claimed/vault_type/now/expires_at
- POST /api/vault/claim: (추가 구현 예정) 외부 지급 실패 시 202 + compensation_queue enqueue
- POST /api/vault/attendance: 중복/만료 가드
- POST /api/vault/deposit-hook: (현재 미구현)
- POST /api/vault/referral-revive: 만료 D-1(24~48h), expiry_extend_count=0, request_id 멱등, expires_at +=24h, log insert(reason=REFERRAL)
- POST /api/vault/extend-expiry (admin): scope ALL_ACTIVE|USER_IDS, extend_hours 1~72, reason OPS|PROMO|ADMIN, shadow 지원(미적용 프리뷰)
- POST /api/vault/notify: variant_id 검증, type = EXPIRY_D2/D0, ATTENDANCE_D2, TICKET_ZERO, SOCIAL_PROOF, REFERRAL_REVIVE

## 3. 서비스/도메인 로직
- VaultService: 상태 전이 가드(EXPIRED/CLAIMED), 만료 시 EXPIRED 일괄 전환, loss_total 계산
- ExtensionService: shadow=true면 미적용, log만 기록; shadow=false면 vault_status 업데이트 + log
- ReferralReviveService: 1회 제한(expiry_extend_count), window [24h,48h] 체크
- CompensationService: enqueue(request_id, external_service, payload)

## 4. 에러/예외 매핑
- VARIANT_NOT_FOUND → 400
- DUPLICATE_REQUEST → 409
- EXTENSION_LIMIT → 409
- EXTENSION_FORBIDDEN → 403 (창구/만료 밖)
- 기존 코드와 API_ERRORS_VAULT_V2.md 일관성 유지

## 5. 멱등/동시성
- claim/attendance/extend/referral: request_id 또는 상태 조건으로 WHERE guard
- deposit-hook: tx_id unique 인덱스, 중복 시 409 + 기존 응답 재사용 가능 설계

## 6. 관측/로그
- 이벤트: EXPIRY_EXTENDED, REFERRAL_REVIVED, COMPENSATION_ENQUEUED 추가
- 필드: variant_id, extension_reason, shadow, compensation_id/attempts

## 7. 설정/플래그
- enable_expiry_batch, enable_alerts, enable_shadow_expiry, enable_loss_banner_experiment 등 환경변수/플래그 정의

## 8. 배포 주의
- 마이그레이션 선반영 → 코드 배포 → 배치/워커 플래그 순차 ON
