# Vault v2.0 배치/알림 시나리오

## 1. 메타
- 문서 타입: 배치/알림 시나리오
- 버전: v0.2 (초안)
- 작성일: 2025-12-20
- 대상: 백엔드/데브옵스/CRM

## Changelog
- 2025-12-20 v0.2: 플래티넘 20,000 기준으로 템플릿 금액 정합화

## 2. 스케줄러
- 만료 배치: 매일 00:10 UTC, expires_at 지난 LOCKED 금고 → EXPIRED
- 알림 배치: 매일 09:00/18:00 KST 두 차례 큐잉 (지역 타임존 맞춤 가능)
- 출석 리셋: 매일 00:00 로컬 기준(또는 UTC), 일 1회 출석 허용
- 만료 배치 shadow 모드: 스케줄러 플래그 shadow=true 시 상태 변경 없이 대상/카운트만 리포트 (Slack)
- 부활권 큐잉: 만료 D-1(24~48h) 사용자 대상으로 referral_revive CTA 알림 큐잉

### 2.1 현재 상태
- `/api/vault/notify` 엔드포인트와 `notifications_queue` 적재는 구현됨
- 만료 배치/알림 배치(스케줄러로 주기 실행)는 아직 미구현(문서 설계 단계)

## 3. 알림 타입
- EXPIRY_D2: 만료 D-2 사용자 대상, "보관된 금액이 소멸 예정"
- EXPIRY_D0: 만료 당일 경고, 강한 긴급 카피
- ATTENDANCE_D2: 출석 2일차(1일 남음) 사용자 대상, 포기 시 소멸 강조
- TICKET_ZERO: 티켓 0 상태 + 플래티넘 미완 사용자 대상, 금고 해금 유도
- SOCIAL_PROOF: 상단 토스트/푸시, "N명이 플래티넘 금고 회수" 카피, variant_id 기반 어조 분기
- REFERRAL_REVIVE: 만료 D-1 사용자 대상 부활권 CTA, 성공 시 expires_at +24h

## 4. 큐/채널
- 내부 큐: notifications_queue (idempotency key = type+user_id+date)
- 발송 채널: 푸시, 이메일(옵션), 인앱 토스트/배너
- A/B: variant_id 열을 포함, idempotency 키에 variant_id 포함하여 중복 억제

## 5. 필터 로직 (예시)
- EXPIRY_D2: now >= expires_at - 48h AND status != CLAIMED for any vault
- ATTENDANCE_D2: platinum_attendance_days = 2 AND platinum_status != CLAIMED AND now < expires_at
- TICKET_ZERO: ticket_balance = 0 AND platinum_status != CLAIMED AND now < expires_at
- SOCIAL_PROOF: 최근 24h claimed >= 임계치, 무작위 샘플 유저 또는 전체 대상 토스트 (쿨다운 24h)
- REFERRAL_REVIVE: now ∈ [expires_at - 48h, expires_at - 24h] AND expiry_extend_count = 0 AND status != CLAIMED

## 6. 템플릿 예시
- EXPIRY_D2: "플래티넘 금고에 보관된 20,000원이 48시간 뒤 소멸됩니다. 지금 회수하세요."
- ATTENDANCE_D2: "진행 1일 남았습니다. 지금 포기하면 보관된 20,000원이 사라집니다."
- TICKET_ZERO: "티켓은 없지만 금고에 20,000원이 보관되어 있습니다. 해금하고 게임을 이어가세요."
- SOCIAL_PROOF (예시 A): "현재 4,231명의 유저가 플래티넘 금고를 회수했습니다."
- SOCIAL_PROOF (예시 B): "다른 유저들이 방금 금고를 회수했어요. 당신의 금고도 곧 소멸됩니다."
- REFERRAL_REVIVE: "친구를 초대하면 만료가 24시간 연장됩니다. 지금 부활권을 사용하세요."

## 7. 실패/재시도/데드레터
- 재시도 정책: 큐 컨슈머에서 지수백오프(예: 1s, 5s, 30s) 최대 5회.
- 데드레터 큐(DLQ): notifications_dlq, 메시지 본문 + 에러 스택 + 재시도 횟수 기록.
- DLQ 처리 배치: 15분 간격, 오류 유형별 라우팅 (일시적 네트워크 → 재큐잉, 잘못된 payload → 폐기 및 알림).
- 관측: DLQ 적재율, 재처리 성공률, TTL 초과 메시지 비율 모니터링.

## 8. 모니터링
- 메트릭: 알림 전환율(열람/클릭/해금), EXPIRED 대비 CLAIMED 비율, 배치 실패율
- 로그: ALERT_SENT(type, user_id, vault_type, sent_at), 배치 실행/오류 로그

## 9. 대시보드/쿼리 예시 (SQL 가이드)
- 알림 전환율 (푸시 클릭 대비 해금)
```sql
-- 기간별 전환
SELECT date_trunc('day', sent_at) AS d,
	   type,
	   COUNT(*) AS sent,
	   SUM(CASE WHEN clicked THEN 1 END) AS clicked,
	   SUM(CASE WHEN claimed_within_24h THEN 1 END) AS claimed,
	   SUM(CASE WHEN claimed_within_24h THEN 1 END)::float / NULLIF(COUNT(*),0) AS claim_cr
FROM alert_events
WHERE sent_at >= now() - interval '14 days'
GROUP BY 1,2
ORDER BY 1 DESC;
```

- 금고별 만료율/수령율 퍼널
```sql
SELECT vault_type,
	   COUNT(*) FILTER (WHERE status = 'UNLOCKED') AS unlocked,
	   COUNT(*) FILTER (WHERE status = 'CLAIMED') AS claimed,
	   COUNT(*) FILTER (WHERE status = 'EXPIRED') AS expired,
	   COUNT(*) FILTER (WHERE status = 'CLAIMED')::float / NULLIF(COUNT(*),0) AS claim_rate,
	   COUNT(*) FILTER (WHERE status = 'EXPIRED')::float / NULLIF(COUNT(*),0) AS expire_rate
FROM vault_status_snapshot
WHERE snapshot_at >= now() - interval '1 day'
GROUP BY vault_type;
```

- 출석 진행률 분포 (플래티넘)
```sql
SELECT platinum_attendance_days,
	   COUNT(*) AS users
FROM vault_status
WHERE expires_at >= now()
GROUP BY 1
ORDER BY 1;
```

- 누적 충전 분포 (다이아)
```sql
SELECT width_bucket(diamond_deposit_current, 0, 500000, 5) AS bucket,
	   MIN(diamond_deposit_current) AS from_amt,
	   MAX(diamond_deposit_current) AS to_amt,
	   COUNT(*) AS users
FROM vault_status
GROUP BY 1
ORDER BY 1;
```
