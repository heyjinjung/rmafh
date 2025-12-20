# Vault v2.0 배치/워커 구현 순서

## 1. 만료 배치
- 입력: enable_expiry_batch, enable_shadow_expiry
- 현재 상태: 스케줄러/잡 자체는 아직 미구현(문서 설계 단계)
- shadow=true: 대상 집계만, vault_status 미변경, Slack 리포트
- shadow=false: expires_at < now AND status!=CLAIMED → EXPIRED 업데이트 (idempotent WHERE)

## 2. 알림 필터 & enqueue
- EXPIRY_D2: now >= expires_at - 48h AND status != CLAIMED
- EXPIRY_D0: now >= expires_at (당일) AND status != CLAIMED
- ATTENDANCE_D2: platinum_attendance_days=2 AND platinum_status!=CLAIMED AND now<expires_at
- TICKET_ZERO: ticket_balance=0 AND platinum_status!=CLAIMED AND now<expires_at
- SOCIAL_PROOF: 최근 24h claimed 임계치, 1회/24h 쿨다운
- REFERRAL_REVIVE: now ∈ [expires_at-48h, expires_at-24h] AND expiry_extend_count=0 AND status!=CLAIMED
- enqueue 시 dedup_key=type+user+date(+variant), variant_id 검증

## 3. CompensationWorker
- 소스: compensation_queue where status IN (PENDING, RETRYING) AND next_retry_at <= now
- 정책: 지수백오프 예) 1s,5s,30s,5m,15m; max retries N(예:5)
- 성공: status=DONE, 로그 기록
- 실패 초과: status=FAILED, DLQ(or alert) 적재
- 관측: pending/failed 수, retry 성공률 메트릭

## 4. 스케줄링
- 만료 배치: 00:10 UTC
- 알림 배치 큐잉: 09:00/18:00 KST (타임존 설정 가능)
- Compensation 워커: 1분 주기 폴링 혹은 큐 기반 트리거

## 5. 모니터링/알람
- batch_fail_count, dlq_size, notify_enqueue_latency
- compensation_pending_count, compensation_retry_success_rate

## 6. 롤백/플래그
- 문제가 있으면 enable_shadow_expiry=true로 전환, 알림/배치 플래그 OFF
- compensation_queue 수동 재처리/폐기 루틴 준비
