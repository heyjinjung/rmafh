# 서버 배포 가이드 (Ubuntu 24.04 LTS)

## 1. 서버 접속 정보
- **IP Address**: `64.176.227.85`
- **OS**: Ubuntu 24.04 LTS x64 (Vultr)
- **Spec**: 4 vCPUs / 16GB RAM / 80GB NVMe

## 2. 초기 서버 설정 (SSH 접속)
터미널(PowerShell 또는 CMD)에서 SSH 접속:
```bash
ssh root@64.176.227.85
# 비밀번호 입력: m[9CBRNdJ.DxySXJ
```

### 필수 패키지 업데이트 및 Docker 설치
```bash
# 패키지 목록 갱신 및 업그레이드
apt update && apt upgrade -y

# 필수 패키지 설치
apt install -y ca-certificates curl gnupg lsb-release git

# Docker 공식 GPG 키 추가
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Docker 리포지토리 설정
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Docker 엔진 설치
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Docker 실행 확인
systemctl status docker
```

## 3. 프로젝트 배포

### 코드 가져오기
`/opt` 디렉토리에 프로젝트를 클론합니다.
```bash
cd /opt
# Git 저장소 주소는 실제 사용하는 저장소 URL로 변경 필요
git clone <YOUR_GIT_REPO_URL> 2026
cd 2026
```

### 환경 변수 설정
`backend/.env` 및 `frontend/.env.local` 파일을 생성합니다.

**Backend (.env)**
```ini
POSTGRES_USER=rmarh_user
POSTGRES_PASSWORD=rmarh_password
POSTGRES_DB=rmarh_db
DATABASE_URL=postgresql://rmarh_user:rmarh_password@db:5432/rmarh_db
SECRET_KEY=your_secret_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
# Figma Integration (Optional - for development)
FIGMA_PERSONAL_ACCESS_TOKEN=your_figma_personal_access_token_here
FIGMA_FILE_KEY=your_figma_file_key_here
ADMIN_PASSWORD=your_admin_password
# ... 기타 필요한 환경변수
```

### 데이터베이스 마이그레이션 (선택 사항)
기존 데이터가 있다면 `pg_dump` 백업 파일을 복원해야 합니다.
```bash
# 백업 파일이 backup.sql 이라고 가정
cat backup.sql | docker exec -i rmarh-db-1 psql -U rmarh_user -d rmarh_db
```

### 서비스 실행
```bash
# 빌드 및 실행 (백그라운드)
docker compose up -d --build

# 로그 확인
docker compose logs -f
```

## 4. Nginx 및 SSL 설정 (HTTPS)

서버에 직접 Nginx를 설치하여 리버스 프록시로 사용하거나, Docker 컨테이너 내의 Nginx를 사용할 수 있습니다. 여기서는 호스트 Nginx 사용을 권장합니다 (Certbot 사용 용이).

```bash
apt install -y nginx certbot python3-certbot-nginx
```

**Nginx 설정 파일 생성 (/etc/nginx/sites-available/rmarh)**
```nginx
server {
    server_name your-domain.com; # 도메인 설정 필요

    location / {
        proxy_pass http://localhost:3000; # Frontend
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api {
        proxy_pass http://localhost:8000; # Backend
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# 심볼릭 링크 생성 및 재시작
ln -s /etc/nginx/sites-available/rmarh /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# SSL 인증서 발급
certbot --nginx -d your-domain.com
```

---

## 5. 하부 총판 시스템 확장성 분석 (Feasibility Analysis)

### 질문: 이 시스템이 하부 총판화(White Labeling) 될 수 있는가?

**답변: 가능합니다. 하지만 배포 방식에 따라 난이도가 다릅니다.**

#### 옵션 A: 독립 배포 방식 (추천 - 즉시 가능)
**방식**: 각 하부 총판마다 **별도의 서버** 또는 **별도의 Docker 컨테이너 세트**를 띄워주는 방식입니다.
- **장점**:
  - **데이터 완벽 격리**: DB가 물리적으로 분리되므로 데이터 섞일 위험 0%.
  - **코드 수정 불필요**: 현재 코드를 그대로 사용하고, 로고나 설정값(환경변수)만 바꿔서 배포하면 됩니다.
  - **장애 격리**: A 총판 서버가 죽어도 B 총판은 영향 없음.
- **단점**:
  - **관리 포인트 증가**: 총판이 100개면 서버/컨테이너도 100세트 관리 필요. (Docker Portainer 등으로 완화 가능)
  - **비용**: 리소스 사용량이 정비례하여 증가.

#### 옵션 B: 멀티 테넌트 방식 (단일 서버, 단일 DB)
**방식**: 하나의 서버와 DB를 공유하되, 유저 데이터에 `site_code`나 `agency_id`를 붙여 구분하는 방식입니다.
- **장점**:
  - **비용 효율**: 하나의 서버로 수백 개의 총판 운영 가능.
  - **관리 용이**: 배포 한 번으로 모든 총판 기능 업데이트.
- **단점**:
  - **대규모 코드 수정 필요**: 모든 DB 테이블에 `site_code` 컬럼 추가 필요. API 모든 로직에 `WHERE site_code = ?` 조건 추가 필요. (실수 시 데이터 유출 치명적)
  - **개발 기간**: 현재 구조에서 최소 2~4주 이상의 리팩토링 및 검증 필요.

### 결론 및 제안
현재 시스템 코드는 **단일 사이트 전용(Single Tenant)** 구조입니다.
빠르게 하부 총판을 내리려면 **옵션 A (독립 배포)** 방식을 권장합니다.
Vultr 서버 하나에 Docker Compose 프로젝트를 폴더별로 나누어(`agency1`, `agency2`...) 포트만 다르게 뛰어(`3001`, `3002`...) 운영하면 하나의 고사양 서버에서 여러 총판을 안전하게 돌릴 수 있습니다.
