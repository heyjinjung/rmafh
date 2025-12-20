# Vault Retention v2.0 개요서

## 1. 메타
- 문서 타입: 개요서 (모듈: 신규 유저 금고 FE/BE/DB)
- 버전: v2.0.1
- 작성일: 2025-12-19
- 대상: 기획자, 백엔드/프론트엔드 개발자

## 1.1 Changelog
- 2025-12-20 v2.0.1: 현재 구현 상태/실행 방법/갭 업데이트
- 2025-12-20 v2.0.2: 플래티넘 20,000 기준 정합화, 유저 출석 CTA 제거(출석 API는 데모/QA 성격) 반영

## 2. 목표
- 신규 유저 전용 손실 회피형 금고 시스템을 7일 내 경험·과금·리텐션 트랙으로 구현
- 금고 3종(골드/플래티넘/다이아) + 7일 완성 보너스 제공
- 출석·충전·누적 진행률을 자산 소멸 프레이밍으로 전달

## 3. 핵심 철학
- Endowment Effect: 금고 재화는 이미 유저 자산으로 인지시키기
- Loss Aversion: "충전 안 하면 사라진다" 메시지로 행동 유도
- Investment: 출석·충전 누적 투자로 포기 비용 상승

## 4. 범위
- FE: 금고 대시보드(UI 카드, 타이머, 진행률, 알림 트리거)
- BE: 금고 상태 관리, 입금/출석 훅, 만료 스케줄러, 알림 API
- DB: vault_status 테이블 및 상태 전이 규칙

## 5. 금고 구조(고정)
- 골드: 10,000원, CC/공지 채널 추가 미션, 즉시 Aha 제공
- 플래티넘: 20,000원, 단일 50,000원 충전 + 3일 연속 조건(운영 업로드 기반 진행)
- 다이아: 쿠폰 100,000원, 누적 500,000원 충전
- 완성 보너스: 가입 7일 내 3개 모두 클리어 시 추가 보상

## 6. 현재 구현 상태(요약, 2025-12-20)
- Docker Compose: db(5432), api(호스트 18000→컨테이너 8000), web(호스트 3002→컨테이너 3000), worker
- FE: 단일 페이지(사이드바+푸터+메인 금고 카드 3종) 구현, 상태 조회/수령 버튼 연동 (유저 출석 CTA 없음)
- FE→BE 연동: Next API Routes가 `/api/vault/*`를 백엔드로 프록시
- BE: `/api/vault/status`, `/api/vault/claim`, (참고) `/api/vault/attendance` 및 ops용 `/referral-revive`, `/extend-expiry`, `/notify`, `/compensation-enqueue`, `/api/vault/user-daily-import` 구현
- DB: 로컬/테스트에서는 API 스타트업 시 `_ensure_schema()`가 최소 스키마를 자동 보강

## 7. 현재 갭(요약, 실제 TODO)
- FE: 손실 시뮬레이터/사회적 증거 토스트/부활권 CTA/티켓0 모달 등은 문서 초안 대비 미구현
- BE: `deposit-hook`, 만료 배치(batch_expire) 엔드포인트/스케줄러는 아직 없음(문서에는 설계로 존재)
- 공통: 인증(JWT)·실유저 식별(user_id) 연동은 데모 수준(기본 user_id=1)
- 관측성: 구조화 로그/메트릭/트레이싱은 아직 문서 수준(구현 TODO)

### 참고(운영 기본 플로우)
- 플래티넘의 “연속 3일” 진행은 기본적으로 운영 업로드(`/api/vault/user-daily-import`)로 계산/갱신됩니다.
- `/api/vault/attendance`는 데모/QA 성격이며, 유저 UI에서 직접 호출하는 플로우는 기본 제공하지 않습니다.

## 8. 실행 방법(로컬)
- 전체 기동: `docker-compose up -d --build`
- FE 접속: `http://localhost:3002/`
- API 헬스체크: `curl http://localhost:18000/health`

### 8.1 trailingSlash 주의(Next.js)
- Next 설정이 `trailingSlash: true` 이므로 FE에서 API 호출은 `/api/vault/status/` 처럼 슬래시를 포함해서 호출하는 것을 기본으로 합니다.

## 9. 차기 작업
- DB: 운영 기준 스키마/마이그레이션 적용 및 운영 백업/복구 전략 문서화
- BE: deposit-hook/만료 배치/알림 배치(스케줄러) 실제 구현
- FE: 문서에 있는 추가 UX(손실 배너/토스트/모달) 구현 및 API 연동 확장
- 관측성: 이벤트 로그/메트릭 수집기 연결 및 대시보드/알람 구성
