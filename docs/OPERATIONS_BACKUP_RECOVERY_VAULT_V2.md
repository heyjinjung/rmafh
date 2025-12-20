# Vault v2.0 운영 데이터 백업/복구 전략

## 1) 목적/범위
- 목적: 운영 장애/실수(삭제/잘못된 배치/데이터 손상) 발생 시 **Postgres 데이터**를 신속히 복구
- 범위: 본 문서는 **Postgres(vault DB)** 중심. 애플리케이션 이미지는 재빌드 가능하므로 별도 백업 대상에서 제외

## 2) 백업 대상
- 필수
  - Postgres 논리 백업: `pg_dump` 결과 파일
- 선택(상황별)
  - Docker 볼륨 스냅샷(로컬/단일 호스트 환경): `db_data` 볼륨 아카이브
  - 마이그레이션 스크립트: [docs/DB_MIGRATION_VAULT_V2.sql](DB_MIGRATION_VAULT_V2.sql)

## 3) 권장 전략(최소)
- 일 1회(또는 배치/운영 작업 직전) `pg_dump` 수행
- 보관: 최근 7~14일 로테이션(환경에 맞게 조정)
- 저장 위치: 호스트 파일시스템의 백업 디렉터리(예: `./backups/`), 운영에서는 별도 스토리지 권장

## 4) 실행: 논리 백업(pg_dump)
전제: 이 레포는 `docker compose`로 `db`를 구동하며 기본 계정은 아래와 같습니다.
- DB: `vault`
- USER: `vault`

### 4.1) 백업 파일 생성(컨테이너 내부에서 실행)
- 권장 포맷(커스텀, 압축 가능):
  - `pg_dump -Fc` (복구 시 `pg_restore` 사용)

PowerShell 예시(프로젝트 루트에서):
- `docker compose exec -T db pg_dump -U vault -d vault -Fc > backups/vault_$(Get-Date -Format "yyyyMMdd_HHmmss").dump`

### 4.2) 스키마만 / 데이터만(옵션)
- 스키마만:
  - `docker compose exec -T db pg_dump -U vault -d vault --schema-only > backups/vault_schema_$(Get-Date -Format "yyyyMMdd_HHmmss").sql`
- 데이터만:
  - `docker compose exec -T db pg_dump -U vault -d vault --data-only > backups/vault_data_$(Get-Date -Format "yyyyMMdd_HHmmss").sql`

## 5) 실행: 복구(restore)
복구는 “새 DB로 완전 복구”를 기본으로 권장합니다.

### 5.1) 커스텀 덤프(.dump) 복구
1) DB 컨테이너 기동
- `docker compose up -d db`

2) (필요 시) 대상 DB 초기화
- 주의: 운영에서는 반드시 사전 확인 후 수행
- `docker compose exec -T db psql -U vault -d postgres -c "DROP DATABASE IF EXISTS vault;"`
- `docker compose exec -T db psql -U vault -d postgres -c "CREATE DATABASE vault;"`

3) 복구 수행
- `Get-Content backups\vault_YYYYMMDD_HHMMSS.dump -Encoding Byte | docker compose exec -T db pg_restore -U vault -d vault --clean --if-exists`

4) 스모크 체크
- `docker compose exec -T db psql -U vault -d vault -c "SELECT COUNT(*) FROM vault_status;"`

### 5.2) SQL 덤프(.sql) 복구
- `Get-Content backups\vault_YYYYMMDD_HHMMSS.sql | docker compose exec -T db psql -U vault -d vault`

## 6) 볼륨 백업(선택)
로컬/단일 호스트에서 빠른 스냅샷이 필요할 때만 사용(이식성/호환성은 `pg_dump`가 더 좋음).

### 6.1) 볼륨 아카이브 생성
- `docker run --rm -v rmarh_db_data:/var/lib/postgresql/data -v ${PWD}/backups:/backup alpine sh -c "cd /var/lib/postgresql/data; tar -czf /backup/db_data_$(date +%Y%m%d_%H%M%S).tar.gz ."`

### 6.2) 볼륨 복구(주의)
- 기존 볼륨/컨테이너 정지 후, 새 볼륨에 아카이브를 풀어 넣는 방식으로 복구
- 운영에서는 데이터 손상/버전 불일치 위험이 있으므로 우선 `pg_dump/pg_restore`를 권장

## 7) 운영 안전장치(권장)
- 백업 파일 접근 권한 제한(운영 계정만 접근)
- 백업 파일에 개인정보/민감정보가 포함될 수 있으므로 암호화/보관 정책 수립
- 배치/운영 대량 작업(extend-expiry 등) 전후로 백업 수행

## 8) 체크리스트 연동
- 체크리스트 항목: “운영 데이터 백업/복구 전략 문서화” 완료 시 본 문서를 기준으로 운영 절차를 수행합니다.
