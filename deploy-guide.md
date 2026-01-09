# 싱가포르 서버 배포 가이드

## 서버 정보
- IP: 149.28.135.147
- Username: root
- 배포 경로: /opt/rmarh

> 보안: 서버 비밀번호/키는 **레포 및 문서에 남기지 말고** 별도 보안 채널에서 관리하세요.

## 1단계: 서버 접속 및 확인

PowerShell에서 실행:
```powershell
ssh root@149.28.135.147
```

서버 접속 후:
```bash
# 현재 사용 중인 포트 확인
netstat -tuln | grep LISTEN

# Docker 확인
docker --version
docker compose version

# Docker 없으면 설치
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

## 2단계: 프로젝트 디렉토리 생성

```bash
mkdir -p /opt/rmarh
cd /opt/rmarh
```

## 3단계: 프로젝트 파일 업로드

로컬 PowerShell에서 실행:
```powershell
# SCP로 전체 프로젝트 업로드
scp -r C:\Users\JAVIS\rmarh\* root@149.28.135.147:/opt/rmarh/
```

또는 Git 사용 (서버에서):
```bash
cd /opt/rmarh
git clone [YOUR_GIT_REPO_URL] .
```

## 4단계: 환경 변수 설정

서버에서 .env 파일 생성:
```bash
cd /opt/rmarh
cat > .env << 'EOF'
# Database
POSTGRES_USER=vault
POSTGRES_PASSWORD=CHANGE_ME_STRONG_PASSWORD
POSTGRES_DB=vault

# Application
ADMIN_PASSWORD=CHANGE_ME_STRONG_ADMIN_PASSWORD
IDEMPOTENCY_TTL_HOURS=24

# Ports (기존 프로젝트와 충돌 방지)
WEB_PORT=3002
API_PORT=18000
DB_PORT=5432

# (Optional) If you prefer overriding everything with a single URL
# DATABASE_URL=postgresql://vault:CHANGE_ME_STRONG_PASSWORD@db:5432/vault
EOF
```

## 5단계: Docker Compose 포트 수정

docker-compose.yml 에서 포트 확인:
```yaml
services:
  db:
    ports:
      - "5432:5432"  # 다른 프로젝트가 5432 사용하면 변경
  
  api:
    ports:
      - "18000:8000"  # 다른 프로젝트가 18000 사용하면 변경
  
  web:
    ports:
      - "3002:3000"  # 다른 프로젝트가 3002 사용하면 변경
```

## 6단계: 배포 실행

```bash
cd /opt/rmarh

# 빌드 및 실행
docker compose build --no-cache
docker compose up -d

# 상태 확인
docker compose ps
docker compose logs -f
```

## 7단계: 방화벽 설정

```bash
# UFW 방화벽 설정 (Ubuntu)
ufw allow 3002/tcp
ufw allow 18000/tcp

# 또는 iptables
iptables -A INPUT -p tcp --dport 3002 -j ACCEPT
iptables -A INPUT -p tcp --dport 18000 -j ACCEPT
```

## 8단계: 접속 테스트

브라우저에서:
- 프론트엔드: http://149.28.135.147:3002
- API: http://149.28.135.147:18000/docs

## 9단계: 도메인 연결 (나중에)

Nginx 설정 예시:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:18000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 트러블슈팅

### 포트 충돌 시
```bash
# 사용 중인 포트 확인
netstat -tuln | grep LISTEN

# 다른 포트로 변경 후 재시작
docker compose down
# docker-compose.yml 수정
docker compose up -d
```

### 로그 확인
```bash
docker compose logs -f web
docker compose logs -f api
docker compose logs -f db
```

### 완전 재시작
```bash
docker compose down
docker compose up -d --build
```
