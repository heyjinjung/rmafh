# Vault v2.0 데이터 품질/마이그레이션 가이드

## 1. 메타
- 문서 타입: 데이터 품질/마이그레이션
- 버전: v0.2
- 작성일: 2025-12-20
- 대상: DBA/백엔드/데이터

## 2. 마이그레이션 검증 쿼리
- 테이블 존재: SELECT 1 FROM information_schema.tables WHERE table_name='vault_status';
- ENUM 확인: vaultstatusenum 값(LOCKED,UNLOCKED,CLAIMED,EXPIRED)
- 기본값 확인: server_default LOCKED/0/CURRENT_TIMESTAMP

## 3. 데이터 정합성 검사
- 유니크: user_id 당 1행 (COUNT(*) GROUP BY user_id HAVING COUNT>1 = 0)
- 만료 필수: expires_at NOT NULL, 미래 시각
- 상태 도메인: 세 상태 컬럼 모두 ENUM 집합 내 값
- 출석: platinum_attendance_days BETWEEN 0 AND 3
- 금액: diamond_deposit_current >= 0
- 만료 연장: expiry_extend_count >= 0, last_extension_reason NULL 또는 ENUM 집합 내 값
- 연장 로그: vault_expiry_extension_log.request_id 유니크, reason ENUM 검증, shadow=true 레코드는 상태 변경 미발생 여부 샘플링
- 보상 큐: compensation_queue.status ∈ (PENDING, RETRYING, DONE, FAILED), retry_count >= 0

## 4. 백필 전략
- 기존 유저에 대해 vault_status 생성: expires_at = 가입 + 7일 (또는 커스텀)
- 기존 잔액/충전 기록이 있다면 diamond_deposit_current 누적 반영 가능 (옵션)
- 플래티넘/다이아 상태는 조건 불충족 시 LOCKED로 초기화

## 5. 아카이브/청소
- 90일 지난 레코드: archive 테이블로 이동 후 본 테이블 삭제
- 파티션 사용 시 오래된 파티션 detach/삭제

## 6. 모니터링 쿼리 샘플
- 만료 앞둔 사용자: SELECT user_id FROM vault_status WHERE expires_at < now() + interval '48 hours' AND gold_status!='CLAIMED';
- 출석 진행률: SELECT platinum_attendance_days, COUNT(*) FROM vault_status GROUP BY 1;
- 누적 충전 분포: SELECT width_bucket(diamond_deposit_current,0,500000,5), COUNT(*) FROM vault_status GROUP BY 1;
- 부활권 사용률: SELECT COUNT(*) FROM vault_expiry_extension_log WHERE reason='REFERRAL' AND shadow=false;
- 보상 큐 적체: SELECT status, COUNT(*) FROM compensation_queue GROUP BY status;

## 7. 릴리스 전 체크리스트
- 마이그레이션 실행 로그 확인
- 검증 쿼리 통과 확인
- 배치/알림 플래그 상태 확인
- 롤백 계획 마련(필요 시 다운그레이드 스크립트 별도)
