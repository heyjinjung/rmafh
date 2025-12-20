# ADMIN_GUIDE_VAULT_V2

## 목적
- 운영/개발 환경에서 **유저 단위 상태 조회** 및 **ops 엔드포인트 실행**을 최소 UX로 제공
- FE/BE/Worker/DB가 분리된 구조에서, “전역 동기화(특히 타이머/만료)”를 안전하게 확인/운영

## 접근 경로
- 어드민 페이지: `/admin` (Next.js 페이지)
- 프록시 API: `/api/vault/*` (Next API Routes → FastAPI로 upstream 전달)

## 실행 순서(권장)
1) 도커 스택 실행
- `docker compose up --build`
- FE: `http://localhost:3002`
- API: `http://localhost:18000`

2) 상태 확인
- `GET /api/vault/status/` (어드민 페이지에서 Status 조회)

3) 운영 작업은 “shadow → real” 순서
- 만료 연장: `POST /api/vault/extend-expiry/`에 `{"dry_run": true}`로 먼저 확인
- 문제가 없으면 `{"dry_run": false}`로 실제 반영

4) 알림/추천 ops 실행
- 알림 enqueue: `POST /api/vault/notify/`
- 추천 revive: `POST /api/vault/referral-revive/`

## 어드민 UI 동작
- [frontend/pages/admin.jsx](frontend/pages/admin.jsx)
  - `user_id` 입력값을 쿼리스트링으로 전달: `?user_id=...`
  - 버튼들은 Next API Routes를 호출

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
- 운영 작업은 항상 `dry_run`으로 결과 확인 후 실제 실행
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
- ops 엔드포인트별 입력 파라미터 UI(현재는 최소 body만 전송)
- 운영자 감사 로그 / 변경 이력 화면
