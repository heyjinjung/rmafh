# 하부 총판(Agency) 전용 도메인 연결 가이드

이 문서는 본사(`2026`)와 별개로 하부 총판(`1004` 등)에 독립적인 도메인을 연결하는 방법을 설명합니다. 한 대의 서버에서 여러 도메인을 운영하더라도 각 인스턴스는 데이터와 설정이 완벽히 분리됩니다.

## 1. 사전 준비
- **도메인 구매**: 가비아, 후이즈, 네임칩 등에서 도메인을 구매합니다 (예: `agency1004.com`).
- **DNS 설정**: 구매한 도메인의 관리 페이지에서 **A 레코드**를 서버 IP(`64.176.227.85`)로 연결합니다.
    - 호스트: `@` (또는 비워둠), 값: `64.176.227.85`
    - 호스트: `www`, 값: `64.176.227.85`

## 2. Nginx 설정 파일 생성
각 대행사는 독립적인 Nginx 설정 파일을 가집니다.

1. 서버에 SSH로 접속합니다.
2. 아래 명령어를 사용하여 새로운 설정 파일을 생성합니다 (도메인 이름에 맞춰 파일명을 정하세요).

```bash
cat > /etc/nginx/sites-available/agency1004 << 'EOF'
server {
    # [수정] 아래 도메인을 실제 도메인으로 변경하세요
    server_name agency1004.com www.agency1004.com;

    # 웹 프론트엔드 연결 (Agency 1004는 3001번 포트 사용 중)
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API 백엔드 연결 (Agency 1004는 8001번 포트 사용 중)
    location /api {
        proxy_pass http://localhost:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
```

## 3. 설정 활성화 및 적용
Nginx가 새로운 설정을 인식하도록 연결(Link)을 생성하고 재시작합니다.

```bash
# 설정을 활성 상태(enabled)로 연결
ln -s /etc/nginx/sites-available/agency1004 /etc/nginx/sites-enabled/

# 설정 문법 검사 (Successful이 떠야 함)
nginx -t

# Nginx 재시작
systemctl restart nginx
```

## 4. HTTPS (SSL 자물쇠) 적용
`certbot`을 사용하여 무료 보안 인증서를 발급받습니다.

```bash
# 도메인을 지정하여 인증서 발급
certbot --nginx -d agency1004.com -d www.agency1004.com
```
- 이메일 입력 및 약관 동의 절차를 진행하면, Nginx 설정에 자물쇠가 자동으로 구성됩니다.

## 5. 포트 확인 (중요)
각 에이전시 인스턴스가 사용하는 포트 번호를 정확히 입력해야 라우팅이 꼬이지 않습니다.

| 에이전시 | 프로젝트 경로 | 웹 포트 | API 포트 | Nginx Listen Port |
| :--- | :--- | :--- | :--- | :--- |
| **본사 (2026)** | `/opt/2026` | 3002 | 18000 | 80 (HTTP) |
| **에이전시 1004** | `/opt/1004` | 3001 | 8001 | 8080 (현재/임시) |

---
**주의 사항**: 도메인 DNS(A 레코드) 설정 후 전파되기까지 최소 5분에서 최대 24시간이 소요될 수 있습니다. 전파가 완료되지 않으면 `certbot` 인증서 발급이 실패할 수 있으니 잠시 후 다시 시도하세요.
