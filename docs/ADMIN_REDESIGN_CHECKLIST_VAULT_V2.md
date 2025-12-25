# ADMIN_REDESIGN_CHECKLIST_VAULT_V2

## 1. 메타
- 문서명: Vault v2 어드민 리디자인 개발 체크리스트
- 문서 버전: v1.0.0
- 작성일: 2025-12-26
- 작성자: Codex
- 적용 범위: `/admin/v2`, 백엔드 Admin API, 멱등성/Job/감사 로그

## Changelog
- 2025-12-26 v1.0.0: 최초 작성 (상세 구현/QA/배포 체크리스트).

## 2. 사용 가이드
- 체크박스는 “완료 기준”을 통과했을 때만 체크한다.
- API/DB 변경은 반드시 스키마 버전과 문서 업데이트를 동반한다.
- 멱등성 키/Job ID는 FE/BE 양쪽 로그에서 추적 가능해야 한다.

## 3. 사전 준비
- [ ] 요구사항 확정: `docs/ADMIN_REDESIGN_SPEC_VAULT_V2.md` FINAL 확인
- [ ] 범위 고정: 이번 릴리즈의 “Must/Should/Could” 구분 확정
- [ ] 기능 플래그 정의: `ADMIN_V2_ENABLED`, `ADMIN_IDEMPOTENCY_ENABLED`
- [ ] 테스트 데이터 준비: 대량 CSV 샘플(1k/10k/50k), 실패 케이스 샘플
- [ ] 모니터링 지표 목록 확정 (Job 실패율, 중복 요청, 응답 시간)

## 4. 백엔드/DB 체크리스트
### 4.1 멱등성 레이어
- [ ] `idempotency_keys` 테이블 생성 및 인덱스 적용
- [ ] 공통 유틸/미들웨어 설계 (key, scope, endpoint, request_hash)
- [ ] `Idempotency-Status` 응답 헤더 추가
- [ ] 동일 키/다른 payload 재사용 시 409 `IDEMPOTENCY_KEY_REUSE`
- [ ] 만료 정책 적용 (24h 기본, 환경 변수로 조정 가능)
- [ ] 서버 로그에 key/endpoint/status 기록

### 4.2 Job 시스템
- [ ] `admin_jobs` 테이블 생성
- [ ] Job 상태 전이 정의: PENDING → RUNNING → DONE/FAILED/CANCELED
- [ ] Job item 테이블 설계 (대상별 성공/실패/에러 메시지)
- [ ] Job 생성 API 구현: `POST /api/vault/admin/jobs`
- [ ] Job 조회 API 구현: 목록/상세/아이템/재시도
- [ ] 대량 작업 실패 시 부분 성공 처리 정책 정의

### 4.3 CSV 업로드 (Imports)
- [ ] 업로드용 API: `POST /api/vault/admin/imports` 구현
- [ ] Shadow vs Apply 모드 분리
- [ ] CSV 파싱 오류 리포트 생성 (CSV 다운로드)
- [ ] 10,000행 초과 시 분할 Job 처리
- [ ] 중복 external_user_id 제거 및 제거 목록 제공

### 4.4 기존 API 멱등성 적용
- [ ] `/api/vault/user-daily-import` → idempotency 적용 + Job 전환
- [ ] `/api/vault/extend-expiry` → request_id → idempotency key 매핑
- [ ] `/api/vault/notify` → idempotency 추가 + 중복 요청 방지
- [ ] `/api/vault/admin/users/*` 변경성 요청에 idempotency 적용

### 4.5 감사 로그/보안
- [ ] `admin_audit_log`에 `job_id`, `idempotency_key` 필드 추가
- [ ] 모든 변경성 작업에 `_log_admin_action` 호출 확인
- [ ] `ADMIN_PASSWORD` 기본값 제거 및 환경 변수 필수화 검토
- [ ] 요청 헤더 `x-admin-password` 누락 시 401 일관 처리

### 4.6 성능/쿼리
- [ ] 사용자 리스트 API 페이지네이션/정렬/필터 인덱스
- [ ] 대량 업데이트 SQL 배치 처리 (execute_values)
- [ ] Job 처리 타임아웃/락 타임아웃 설정

## 5. 프론트엔드 체크리스트
### 5.1 라우팅/구조
- [ ] `/admin/v2` 신규 라우트 추가
- [ ] 기존 `/admin` 유지 + 전환 플래그 구현
- [ ] API 클라이언트 공통화 (`withIdempotency`)

### 5.2 전역 레이아웃
- [ ] 좌측 네비게이션 + 상단 검색 + 컨텍스트 패널 구현
- [ ] 글로벌 검색: external_user_id, nickname, user_id 지원
- [ ] 빠른 실행 (Extend/Notify/Import) 진입 지원

### 5.3 Users (데이터 그리드)
- [ ] 서버 사이드 페이징/정렬/필터 연동
- [ ] 가상 스크롤(react-virtual) 적용
- [ ] 컬럼 세트 저장/불러오기
- [ ] 대량 선택: 현재 페이지/필터 전체/ID 업로드
- [ ] 행 클릭 → 우측 Drawer 상세 패널 연동

### 5.4 세그먼트/필터
- [ ] 세그먼트 생성/저장/삭제
- [ ] 세그먼트 → Operations 작업 생성 흐름
- [ ] 필터 조건: 상태, 만료, 입금 범위, 출석 범위, 텔레그램/리뷰

### 5.5 Imports UI
- [ ] 4단계 업로드 흐름 구현 (파일 → 매핑 → 검증 → 실행)
- [ ] 미리보기(최대 200행) 테이블
- [ ] 오류 리스트/다운로드 링크 표시
- [ ] Shadow/Apply 모드 토글 + 위험 확인

### 5.6 Operations UI
- [ ] Extend-expiry: 대상/시간/사유/Shadow 입력
- [ ] Impact 프리뷰: 대상 수, 샘플, 예상 만료일
- [ ] 상태/출석/입금 일괄 변경 UI
- [ ] 위험 작업 확인(텍스트 입력 + 2단계)

### 5.7 Notifications UI
- [ ] 알림 생성 폼 (type/variant/대상/예약)
- [ ] 중복 방지 정책 안내 문구 표시
- [ ] 알림 리스트 필터/페이지네이션
- [ ] 재시도/상태 변경 액션

### 5.8 Audit & Jobs UI
- [ ] 감사 로그 테이블 + 필터
- [ ] Job 리스트/상세 + 실패 아이템 다운로드
- [ ] Job 재시도 버튼 + 상태 업데이트

### 5.9 공통 UX
- [ ] 멱등성 키 위젯 (자동 생성/복사/재생성)
- [ ] 결과 토스트 + 상세 패널 링크
- [ ] 오류 메시지 표준화 (코드/요약/세부)

## 6. API 스펙/문서 업데이트
- [ ] `docs/API_SPEC_VAULT_V2.md`에 신규 Admin API 추가
- [ ] `docs/ADMIN_GUIDE_VAULT_V2.md`에 `/admin/v2` 가이드 추가
- [ ] `docs/ADMIN_AUDIT_OPERATIONS_GUIDE.md`에 job/idempotency 필드 추가
- [ ] `docs/CSV_UPLOAD_COLUMN_GUIDE.md`에 업로드 검증 규칙 업데이트

## 7. 테스트/QA 체크리스트
### 7.1 단위 테스트
- [ ] 멱등성 키 재사용 시 동일 응답 반환
- [ ] 다른 payload 재사용 시 409 반환
- [ ] Job 상태 전이 정상 처리

### 7.2 통합 테스트
- [ ] 대량 CSV 업로드 Shadow/Apply 경로
- [ ] Extend-expiry Shadow/Apply 경로
- [ ] Notify 중복 방지 동작
- [ ] User admin update 일괄 적용 검증

### 7.3 E2E 시나리오
- [ ] 세그먼트 생성 → 대량 연장 → 결과 확인
- [ ] CSV 업로드 → Job 완료 → 오류 다운로드
- [ ] 알림 발송 → 리스트 조회 → 재시도
- [ ] 감사 로그에서 request_id 추적

### 7.4 성능/부하
- [ ] 10k 행 CSV 처리 시간 측정
- [ ] Users 리스트 100k 데이터 응답 시간
- [ ] Job 처리 중 API 응답 타임아웃 발생 여부

## 8. 보안/운영 체크리스트
- [ ] ADMIN_PASSWORD 미설정 시 서비스 부팅 차단 여부 검토
- [ ] 민감 정보 로그 마스킹 (external_user_id 부분 마스킹 옵션)
- [ ] 감사 로그 데이터 보존 정책 적용
- [ ] 관리자 IP/세션 추적 정책 확정

## 9. 배포/전환 체크리스트
- [ ] 신규 DB 스키마 배포 계획 수립
- [ ] 기능 플래그 ON/OFF 롤백 시나리오 작성
- [ ] `/admin` → `/admin/v2` 전환 일정 공지
- [ ] 운영자 매뉴얼 배포 및 교육 진행

## 10. 최종 승인 체크리스트
- [ ] FE/BE/OPS 최종 승인
- [ ] QA 시나리오 전수 통과
- [ ] 문서/가이드 업데이트 완료
- [ ] 배포/롤백 플랜 승인
