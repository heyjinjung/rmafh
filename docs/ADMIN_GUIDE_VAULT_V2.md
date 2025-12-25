# ADMIN_GUIDE_VAULT_V2

## Changelog
- 2025-12-25 v0.2: `/admin/v2` 진입 경로, 멱등성 위젯/토스트, Job/Audit 패널 사용 가이드 추가
- 2025-12-20 v0.1: 골드 기본 UNLOCKED(데모) 및 telegram_ok 문구 정합화, 업로드 기반 진행률을 기본 플로우로 명시

## 목적
- 운영/개발 환경에서 **유저 단위 상태 조회** 및 **ops 엔드포인트 실행**을 최소 UX로 제공
- FE/BE/Worker/DB가 분리된 구조에서, “전역 동기화(특히 타이머/만료)”를 안전하게 확인/운영

## 접근 경로
- 어드민 v1: `/admin/` (기존 최소 UI)
- 어드민 v2: `/admin/v2` (Jobs/감사 로그/Notifications/Operations 통합)
- 프록시 API: `/api/vault/*` (Next API Routes → FastAPI로 upstream 전달)

## 실행 순서(권장)
1) 도커 스택 실행
- `docker compose up --build`
- FE: `http://localhost:3002`
- API: `http://localhost:18000`

2) 상태 확인
- `GET /api/vault/status/` (어드민 페이지에서 Status 조회)

3) 운영 작업은 “shadow → real” 순서
- 만료 연장: `POST /api/vault/extend-expiry/`에 `{"shadow": true}`로 먼저 확인
- 문제가 없으면 `{"shadow": false}`로 실제 반영

4) 알림/추천 ops 실행
- 알림 enqueue: `POST /api/vault/notify/`
- 추천 revive: `POST /api/vault/referral-revive/`

## 어드민 UI 동작
- [frontend/pages/admin.jsx](frontend/pages/admin.jsx)
  - `external_user_id` 입력값을 쿼리스트링으로 전달: `?external_user_id=...`
  - 버튼들은 Next API Routes를 호출

### 화면 구성(v1 간단)
- 상단에서 `external_user_id`를 입력하고 “작업 선택”에서 필요한 작업만 골라서 실행해요.
- 선택한 작업만 화면에 보여서(나머지는 숨김) 복잡함을 줄였어요.

### 화면 구성(v2 핵심)
- 좌측 네비게이션: Dashboard / Users / Operations / Notifications / Jobs / Audit
- 우측 패널: 선택한 행/Job/Audit에 대한 상세, 실패 아이템 다운로드, 재시도 버튼
- 상단 바: 글로벌 검색(external_user_id, nickname, user_id) + 빠른 실행(Extend/Notify/Import)
- 공통 UX: 멱등성 키 위젯(자동 생성/복사/재생성), 결과 토스트, 에러 표준 블록(status/body/request_id 표시)

## 어드민 사용법(쉬운 입력 폼)
어드민은 “JSON을 직접 쓰는 방식”이 아니라, 체크박스/숫자/드롭다운/목록 입력으로 요청 내용을 만들어요.

### 0) 엑셀/CSV 업로드(일일 업데이트)
- 매일 엑셀을 업로드해서 아래 정보를 한 번에 반영해요.
  - `external_user_id`(필수)
  - `nickname`(선택)
  - `deposit_total`(필수, 누적입금액)
  - `joined_at`(선택, 가입일)
  - `last_deposit_at`(선택, 입금일)
  - `telegram_ok`(필수, 텔레그램 OK 여부)
- 업로드하면 서버가 내부적으로:
  - `user_identity` 매핑을 자동 생성/해결하고
  - `vault_status`에 누적입금/텔레그램 조건을 반영해요

#### 조건 반영(현재 구현)
- (데모) GOLD는 기본적으로 `UNLOCKED`입니다.
- `telegram_ok`는 운영 스냅샷에 저장되는 필드이며, 추후 “채널 인증 후 골드 해금” 같은 조건 강제 시에 사용할 수 있어요.
- `deposit_total >= 500000`이면 DIAMOND가 `LOCKED → UNLOCKED`로 전이될 수 있어요.

### 1) 상태 조회(Status)
- “외부 아이디(external_user_id)”를 입력한 뒤 “상태 조회”를 누르면 `/api/vault/status/`를 호출해요.

### 2) 만료 시간 늘리기(extend-expiry)
- **대상 범위(scope)**
  - `ALL_ACTIVE`: 지금 활성인 전체 대상
  - `USER_IDS`: 특정 회원만(아래에 회원 번호 목록 입력)
- **대상 외부 아이디(목록)**
  - 쉼표(,) 또는 띄어쓰기로 여러 명 입력 가능
  - 비워두면 위의 “외부 아이디(external_user_id)”를 사용해요
- **늘릴 시간(extend_hours)**: 1~72 사이 숫자
- **사유(reason)**: 운영/프로모션/관리 중 선택
- **shadow(미리보기 모드)**
  - 체크(ON): 실제로 반영하지 않고 “이렇게 될 예정”만 확인
  - 해제(OFF): 실제 반영
- “고급: 서버로 보내는 JSON 보기”에서 최종 전송 내용을 확인할 수 있어요.

### 3) 알림 요청 넣기(notify)
- **알림 종류(type)**: 드롭다운에서 선택
- **대상 외부 아이디(목록)**: 쉼표/띄어쓰기로 입력, 비워두면 `external_user_id` 사용
- **추가 옵션(variant_id)**: 필요할 때만 숫자로 입력(비워도 됨)

### 3-1) 멱등성 키/토스트 사용법 (v2)
- 모든 변경성 요청은 멱등성 키가 자동 생성되어 요청 헤더로 전송돼요.
- “Idempotency” 위젯에서 키를 복사하거나 재생성할 수 있어요. 재생성 후에는 새 키로 다시 요청하세요.
- 응답 헤더의 `Idempotency-Status` 값(`recorded`/`replayed`)을 토스트에 노출해 동일 요청 여부를 빠르게 확인해요.
- 오류가 나면 에러 블록에 `status`/`body`/`request_id`를 함께 표시해 감사 로그 추적에 활용해요.

### 4) 추천 revive(referral-revive)
- 이 요청은 **쿼리스트링 `external_user_id`가 필수**예요(위의 외부 아이디 입력을 꼭 채워주세요).
- **채널(channel)**, **초대코드(invite_code)**를 입력해 실행해요.

## 프록시 라우트(Next → FastAPI)
- 기존
  - [frontend/pages/api/vault/status.js](frontend/pages/api/vault/status.js)
  - [frontend/pages/api/vault/claim.js](frontend/pages/api/vault/claim.js)
  - [frontend/pages/api/vault/attendance.js](frontend/pages/api/vault/attendance.js)
- ops 추가
  - [frontend/pages/api/vault/extend-expiry.js](frontend/pages/api/vault/extend-expiry.js)
  - [frontend/pages/api/vault/notify.js](frontend/pages/api/vault/notify.js)
  - [frontend/pages/api/vault/referral-revive.js](frontend/pages/api/vault/referral-revive.js)

### trailingSlash 주의
- Next 설정이 `trailingSlash: true`인 경우, FE에서 `/api/vault/status/`처럼 **슬래시 포함 경로**로 호출하는 것을 권장

## 전역 동기화(타이머/만료) 가이드
- 단일 클라이언트 기준 시간이 아니라, **서버가 내려주는 `now` / `expires_at`을 기준**으로 UI 타이머를 표시
- 프론트는 최초 응답의 `(expires_at - now)`를 기준값으로 잡고, 이후는 클라이언트 경과 시간을 더해 카운트다운을 진행
- 이 방식의 장점
  - 모바일/PC/여러 탭에서 동일한 “남은 시간”을 거의 동일하게 표시
  - 클라이언트 시계 오차에 덜 민감

## 안전 운영 체크
- 운영 작업은 항상 `shadow`(미리보기)로 결과 확인 후 실제 실행
- 외부 아이디로 작업할 때 `EXTERNAL_USER_NOT_FOUND` / `EXTERNAL_USER_IDS_NOT_FOUND`가 나오면:
  - 운영 DB에는 외부 아이디 매핑(user_identity)이 아직 없다는 뜻이에요.
  - 로컬/데모 환경에서는 해당 외부 아이디로 한 번 “상태 보기”를 하면(조회 경로) 매핑이 자동 생성될 수 있어요.
- 응답이 4xx/5xx인 경우:
  - 어드민 UI의 Error 블록에서 `status`/`body` 확인
  - API 컨테이너 로그 확인: `docker compose logs -f api`

## 환경 변수
- FE → upstream 베이스 URL
  - `NEXT_PUBLIC_API_BASE` 우선
  - 없으면 `API_BASE`
  - 없으면 로컬 `http://localhost:18000`

## TODO (명시적으로 남겨둔 것)
- 어드민 접근 제어(인증/인가)
- ops 엔드포인트별 입력 파라미터 UI(필드/검증 추가 확장 여지)
- 운영자 감사 로그 / 변경 이력 화면
