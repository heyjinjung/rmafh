# Changelog
- v1.1.0 | 2025-12-22 | GitHub Copilot | 로그인을 CSV external_user_id 기반으로만 허용(닉네임 자동 생성 제거), Contact 푸터 외부 링크 최종 연결, 어드민 사용자 CRUD/UI 정리, docker compose build/up(api, worker) 수행
- v1.0.0 | 2025-12-22 | GitHub Copilot | 초기 작성 (최근 진행 내용 정리)

## 헤더
- 제목: Vault v2 진행 로그 (2025-12-22)
- 문서 타입: Log
- 버전: v1.1.0
- 작성일: 2025-12-22
- 작성자: GitHub Copilot
- 대상 독자: Backend/Frontend/운영

## 요약
- 어드민이 CSV 없이 보관/소멸/회수 상태를 제어하도록 백엔드·프론트엔드 액션 패널과 검색/전체 조회 흐름을 구축함.
- 닉네임 및 금고 티어(골드/플래티넘/다이아) 정보 노출, 리퍼럴 부활 기능 제거, 플래티넘 스트릭 문구 삭제.
- 로그인은 CSV 데이터 external_user_id/닉네임 스냅샷 기반으로만 통과하도록 수정(자동 user_<nickname> 생성 제거).
- Contact 푸터 링크를 텔레그램/공식 사이트/텔레채널로 연결 완료. Docker 스택 재빌드·재기동(api, worker). api 컨테이너 `pytest -vv -ra --maxfail=1` 통과, worker coroutine 미대기 경고 관측됨.

## 본문
### 배경
- 운영팀이 CSV 업로드 없이 금고 상태(LOCKED/UNLOCKED/CLAIMED/EXPIRED)와 출석/입금 플래그를 제어해야 함.
- 기존 어드민 화면에서 리퍼럴 부활 기능 제거 및 전체 회원 조회/검색 UX 개선 요구가 있었음.

### 문제/목표
- 금고 상태/출석/입금 토글을 안전하게 수행하는 어드민 API와 UI 제공.
- 닉네임 및 금고 티어 전체를 한눈에 볼 수 있는 리스트/상세 표현.
- 리퍼럴 부활 기능 제거, 푸터 링크 정비, 스트릭 문구 제거.
- Docker 스택 기준으로 테스트 및 런타임 품질 확보.

### 대안
- CSV 기반 관리 유지 vs. 직접 액션 API 제공 → 직접 액션 API와 어드민 패널로 결정.
- 검색 기반 리스트만 제공 vs. 명시적 전체 조회 버튼 제공 → "전체 회원 조회" 버튼을 노출해 혼동을 줄임.

### 결정 사항
- 백엔드: 로그인 시 external_user_id를 그대로 사용하고 닉네임 스냅샷으로만 대체 조회, 어드민 인증 헤더 기반 상태/출석/입금 변경 엔드포인트 추가, 사용자 목록 API에 닉네임·티어 정보 포함.
- 프론트엔드: 어드민 페이지 검색/선택/액션 패널 구성, 상태/출석/입금 액션 연결, 리퍼럴 부활 제거, 플래티넘 스트릭 문구 삭제, Contact 푸터 링크/라벨 수정.
- UI: 닉네임 및 골드/플래티넘/다이아 상태 노출, "전체 회원 조회" 버튼 복구.
- 인프라/테스트: Docker 스택 재빌드·재기동(api, worker). `docker compose exec api pytest -vv -ra --maxfail=1` 통과, worker에서 `RuntimeWarning: coroutine 'process_once' was never awaited` 관측.

### 영향도/리스크
- worker 경고로 인해 배치 작업이 누락될 가능성 존재; 비동기 호출 경로 점검 필요.
- 어드민 액션이 실서비스 데이터에 영향을 주므로 운영 전 검증(권한, 입력 검증, 감사 로그) 재확인 필요.
- 로그인/인증 흐름 최종 확인 전까지 어드민 접근 제어 미비 가능성.

### 후속 작업
- worker `process_once` 경로 비동기 대기/실행 방식 수정 및 재테스트.
- 어드민 로그인/인증 플로우 실제 스택에서 재검증 (헤더 전달, 세션 만료 처리 포함).
- 어드민 UI에서 상태/출석/입금 액션 end-to-end 재확인 (검색/전체 조회 포함) 및 회귀 테스트 추가.
- 필요 시 상태 변경/토글 엔드포인트에 대한 단위/통합 테스트 보강.
- 서버 배포 환경에서 git pull 후 `docker compose build api worker web` 및 `docker compose up -d api worker web` 실행, 푸터 링크/로그인 동작 확인.

## 부록
- 최근 테스트: api 컨테이너 `pytest -vv -ra --maxfail=1` 성공.
- 러닝 스택: docker compose 기준 web/api/worker/db 모두 기동 완료(최근 빌드 기준).
