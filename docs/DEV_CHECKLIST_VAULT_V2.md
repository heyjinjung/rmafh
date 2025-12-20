# Vault v2.0 개발 체크리스트

## Changelog
- 2025-12-20: `/api/vault/user-daily-import` 반영, 유저 출석 CTA 제거에 맞춰 FE/테스트 항목 정합화
- 2025-12-20: 어드민(`/admin/`) 개발 상태 체크 항목 추가
- 2025-12-20: 어드민 결과/에러 응답을 운영자 친화 요약 UI로 개선(원문은 접기)
- 2025-12-20: 어드민 컬러 토큰(`admin.*`) 추가 및 레이아웃(세로/스크롤 체감) 개선 작업 반영

## 인프라 / 환경
- [x] docker-compose로 db/api/worker 기동 (api 호스트 포트 18000 매핑)
- [x] Postgres 16 컨테이너 헬스체크 설정
- [x] API/Worker 이미지 빌드 (Python 3.11-slim)
- [x] web(frontend) 서비스 추가 (Next.js) 후 compose 통합 (호스트 3002)
- [ ] `docker-compose.yml`의 `version` 필드 제거(Compose 경고 제거)

## 데이터베이스
- [x] DB 마이그레이션 스크립트 준비: docs/DB_MIGRATION_VAULT_V2.sql
- [x] vault_status baseline + 컬럼 확장 (expires_initial_at 등)
- [x] notifications_queue 생성 및 인덱스
- [x] compensation_queue 생성 및 인덱스
- [x] vault_expiry_extension_log 생성 및 인덱스
- [x] 마이그레이션 적용 완료 (rmarh-db-1 컨테이너)
- [ ] 운영 데이터 백업/복구 전략 문서화

## 백엔드 API (FastAPI)
- [x] /health 헬스체크
- [x] /api/vault/status (데모 user_id 기본 1)
- [x] /api/vault/claim
- [x] /api/vault/attendance (데모/QA용 수동 출석)
- [x] /api/vault/user-daily-import (운영 업로드 기반 진행률/상태 갱신)
- [x] /api/vault/referral-revive (만료 D-1 구간 24h 연장, 1회 제한)
- [x] /api/vault/extend-expiry (shadow/real, 범위 ALL_ACTIVE/USER_IDS)
- [x] /api/vault/notify (type/variant 검증, dedup enqueue)
- [x] /api/vault/compensation-enqueue (202 enqueue)
- [ ] status/claim/user-daily-import 통합 테스트/계약 테스트 추가 (attendance는 선택)
- [ ] 실제 비즈니스 로직/에러 처리 보완 (현재 단순화된 로직)

## 워커
- [x] compensation_queue 처리 루프 (RETRYING, DONE/FAILED, 백오프)
- [x] DB 커넥션 풀 연동
- [ ] 외부 보상 서비스 연동 구현 (현재 성공 가정)
- [ ] DLQ/모니터링/알람 추가

## 운영/품질
- [x] 도커 헬스체크 확인 (curl http://localhost:18000/health 200 OK)
- [ ] 로깅/메트릭스 설정 (구체적 수집기/대시보드)
- [ ] 보안 점검 (비밀값 관리, DB 권한 최소화)
- [ ] 성능 점검/부하 테스트 계획

## 배포/릴리즈
- [ ] git branch -M main 실패 재시도/브랜치 정리
- [ ] git add . && git commit -m "Add docker stack skeleton" && git push
- [ ] CI 구성 (lint/test/build) 추가

## 어드민 (운영자 도구)
- [x] 어드민 페이지: `/admin/` (Next.js)
- [x] 상태 조회: `/api/vault/status` 호출 (external_user_id 쿼리 지원)
- [x] 엑셀/CSV 업로드: `/api/vault/user-daily-import` 호출(파싱/중복제거/최대 10,000 rows 제한)
- [x] 만료 연장: `/api/vault/extend-expiry` 호출(요청번호 생성, scope/시간 검증, shadow 토글)
- [x] 알림 요청: `/api/vault/notify` 호출(type/variant_id, 대상 외부아이디 검증)
- [x] 추천 revive: `/api/vault/referral-revive` 호출(요청번호 생성)
- [x] 성공/실패 응답을 운영자 친화 요약 UI로 표시(원문 JSON은 접기 처리)
- [x] 어드민 전용 컬러 토큰(`admin.*`) 반영
- [ ] 어드민 레이아웃/스크롤 최종 검증 (모바일/태블릿/데스크탑에서 세로 확장 체감 확인)
- [ ] 어드민 접근 제어(인증/권한) 적용
- [ ] 어드민 작업 감사 로그(누가/언제/무엇을) 및 운영 가이드 정리

## 프런트엔드 (옵션)
- [x] ./frontend 및 web 서비스 compose 추가
- [x] 금고 메인 페이지 UI + `/api/vault/status|claim` 연동 (유저 출석 CTA 없음)
- [ ] 손실 배너/토스트/부활권/티켓0 모달 등 확장 UX 적용
