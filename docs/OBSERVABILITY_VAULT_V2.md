# Vault v2.0 관측성/모니터링 설계

## 1. 메타
- 문서 타입: 관측성
- 버전: v0.2
- 작성일: 2025-12-20
- 대상: SRE/백엔드/데이터

## 1.1 현재 구현 상태(2025-12-20)
- 이벤트 로그/메트릭/트레이싱은 문서 설계 수준이며, 코드에 체계적인 수집(StatsD/Prometheus/OTel)은 아직 미연동입니다.
- 현재는 API/워커가 DB 테이블 기반으로 기능 동작을 우선 보장하는 단계입니다.

## 2. 로그 스키마 (핵심 이벤트)
- VAULT_UNLOCKED, VAULT_CLAIMED, VAULT_EXPIRED, ALERT_SENT, ATTENDANCE_MARKED, DEPOSIT_RECORDED, EXPIRY_EXTENDED, REFERRAL_REVIVED, COMPENSATION_ENQUEUED
- 공통 필드: ts, event, user_id, vault_type, req_id, env
- 추가 필드: tx_id(deposit), amount(deposit), attendance_day, expires_at, status_before, status_after, variant_id(notify), extension_reason, shadow (연장 드라이런), compensation_id

## 3. 메트릭 정의
- 전환: vault_claim_rate_by_type (claimed/eligible)
- 만료: vault_expire_rate_by_type (expired/total)
- 출석: platinum_attendance_progress (avg days)
- 충전: diamond_deposit_progress (p50/p90)
- 알림: alert_sent_count, alert_click_rate, alert_claim_within_24h, alert_claim_rate_by_variant
- 사회적 증거: social_proof_impression_count, social_proof_click_rate, social_proof_claim_within_24h
- 손실 시뮬레이터: loss_banner_impressions, loss_banner_click_rate, loss_banner_claim_within_1h
- 부활권/연장: referral_revive_success_count, extend_expiry_applied_count(shadow vs actual)
- 배치/큐: batch_fail_count, dlq_size, notify_enqueue_latency, compensation_pending_count, compensation_retry_success_rate

## 4. 대시보드 레이아웃 (예시)
- 퍼널: LOCKED→UNLOCKED→CLAIMED→EXPIRED by vault_type
- 진행률: 출석/충전 분포 히스토그램
- 알림: 전송/클릭/24h-클레임 전환율 트렌드
- 배치/큐: 실패율, 지연, DLQ 누적
- 실시간: 카운트다운 임박 사용자 수 (D-2/D0)

## 5. 알람 임계치 (초안)
- batch_fail_count > 0 (5분 이동) → Warn
- dlq_size > 100 → Warn, > 500 → Critical
- notify_enqueue_latency p95 > 5s (15분) → Warn
- claim_rate_drop > 20% QoQ → Investigate
- expire_rate_spike > +15% DoD → Investigate
- compensation_pending_count > 0 (10분 지속) → Warn, > 50 → Critical
- alert_claim_rate_by_variant 차이 > 15pp → 실험/템플릿 품질 점검

## 6. 수집/전송
- 로그: JSON line, 중앙 수집(ELK/Cloud Logging)
- 메트릭: Prometheus/StatsD, 레이블(env, vault_type)
- 트레이싱: req_id/trace_id로 API ↔ 배치 상관관계

## 7. 개인정보/보안
- PII 마스킹, 금액은 필요 최소 단위로 기록, 토큰/세션은 로그 금지
