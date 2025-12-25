# Vault v2.0 Docker 스택

## 구성
- db: postgres:16 (포트 5432)
- api: FastAPI (uvicorn) — context ./backend, 포트 8000
- worker: 동일 이미지, `python -m app.worker`
- web: Next.js — context ./frontend, 포트 3000

## 실행
- 빌드/실행: `docker-compose up -d --build`
- 헬스체크(API): `curl http://localhost:18000/health`
- 접속(FE): `http://localhost:3002/`

## 환경 변수
- DATABASE_URL: postgresql://vault:vaultpass@db:5432/vault
- APP_ENV: local
- IDEMPOTENCY_TTL_HOURS: 24
- NEXT_PUBLIC_API_BASE: http://api:8000 (컨테이너 내부에서 FE가 백엔드를 프록시할 때 사용)

## 마이그레이션
- psql 접속 후 `\i docs/DB_MIGRATION_VAULT_V2.sql`

## 노트
- worker.py는 보상 재시도 워커 자리, 로직 추가 필요
- FE는 Next API Routes로 `/api/vault/*`를 백엔드로 프록시합니다.
- Next.js 설정이 `trailingSlash: true` 이므로 FE 내부 호출은 `/api/vault/status/` 처럼 슬래시 포함을 기본으로 합니다.
