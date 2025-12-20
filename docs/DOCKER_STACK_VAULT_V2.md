# Vault v2.0 Docker 스택

## 구성
- db: postgres:16 (포트 5432)
- api: FastAPI (uvicorn) — context ./backend, 포트 8000
- worker: 동일 이미지, `python -m app.worker`

## 실행
- 빌드/실행: `docker-compose up -d --build`
- 헬스체크: `curl http://localhost:8000/health`

## 환경 변수
- DATABASE_URL: postgresql://vault:vaultpass@db:5432/vault
- APP_ENV: local

## 마이그레이션
- psql 접속 후 `\i docs/DB_MIGRATION_VAULT_V2.sql`

## 노트
- worker.py는 보상 재시도 워커 자리, 로직 추가 필요
- FE는 별도 서비스(Next.js 등) 추가 시 docker-compose에 web 서비스로 확장
