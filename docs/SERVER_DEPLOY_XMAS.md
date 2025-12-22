# Changelog
- v1.1.0 | 2025-12-22 | GitHub Copilot | 실 배포 경로(/opt/rmarh)와 docker compose 절차 반영
- v1.0.0 | 2025-12-22 | GitHub Copilot | 신규 작성 (xmas 서버 배포/운영 노트)

## 헤더
- 제목: xmas 서버 배포·관리 가이드
- 문서 타입: Runbook
- 버전: v1.0.0
- 작성일: 2025-12-22
- 작성자: GitHub Copilot
- 대상 독자: 운영/개발 (배포 담당)

## 요약
- 싱가포르 리전 Ubuntu 22.04 x64 단일 VM(xmas 라벨), 실제 배포 루트는 `/opt/rmarh`, docker compose로 구동합니다.
- 서비스 포트: FE 3000→80 컨테이너, BE 8000, Nginx 80/443, Redis 6379, MySQL 3307(host)->3306.
- 배포 절차: `.env` 작성 → `docker compose build --no-cache` → `docker compose up -d` → 헬스/포트 확인.
- 접속은 root 비밀번호 기반(SSH 키로 전환 권장), 로그/재기동/보안 체크리스트 포함.

## 본문
### 배경
- 싱가포르 VM(xmas)에서 애플리케이션을 `/opt/rmarh`로 배포했으나, 경로/절차 문서화가 없었음.

### 문제/목표
- 배포 경로 및 실행 방법을 명확히 기록해 재배포·장애 대응 시간을 단축.
- 접속/보안/백업 최소 가이드를 제공해 운용 리스크 감소.

### 대안
- 구두 공유/기억 의존 vs. 문서화 → 문서화로 결정.

### 결정 사항
- 본 문서를 단일 소스로 사용하며, 접속 정보는 별도 보안 채널에서 관리.
- 배포 경로는 `/opt/rmarh`, docker compose 기반 운영으로 고정.

### 영향도/리스크
- 비밀번호 노출 시 계정 탈취 위험 → SSH 키 전환 및 방화벽 제한 필요.
- 배포 경로 미기록 시 추후 재배포/복구 지연.

### 후속 작업
- [ ] SSH 키 등록 후 비밀번호 로그인 비활성화.
- [ ] MySQL 볼륨/백업 위치 확인 후 백업 절차 문서화.
- [ ] 방화벽(ufw/cloud)에서 22/80/443/6379/3307 포트 소스 제한 검토.
- [ ] 정기 백업/스냅샷 일정 합의 및 실행.

## 서버 정보
- 위치/OS: 싱가포르, Ubuntu 22.04 x64
- 라벨: xmas
- 스펙: 1 vCPU / 2 GB RAM / 25 GB NVMe / 초당 0.13 GB 사용 중
- 네트워크: 공인 IP 149.28.135.147 (추가 NIC 없음 가정)
- 계정: root (비밀번호는 보안 채널에서 관리, 레포에 미기록)
- 백업: Auto Backups 비활성 (수동 스냅샷 필요)

## 접속 방법
1) SSH (임시)
   - `ssh root@149.28.135.147`
   - 첫 접속 후 `passwd`로 비밀번호 변경, `~/.ssh/authorized_keys`에 키 등록, `/etc/ssh/sshd_config`에서 `PasswordAuthentication no` 설정 권장.
2) 방화벽
   - ufw 사용 시: `ufw status`, 필요 포트만 허용(예: 22, 80/443). 클라우드 보안그룹이 있다면 소스 IP 제한 적용.

## 배포/경로 체크리스트
> 현재 배포 루트는 `/opt/rmarh`, docker compose로 구동 중입니다. 변경이 있는 경우만 아래 절차로 재확인하세요.
- 최근 수정 경로 확인: `ls -lt /opt /srv /home /root | head`
- 대용량/앱 디렉터리 추정: `du -sh /opt/* /srv/* /home/* /root/* 2>/dev/null | sort -h`
- Git/배포 루트: `/opt/rmarh` (원격 repo: https://github.com/heyjinjung/rmafh.git)
- 환경 변수 파일: `/opt/rmarh/.env`
- Docker 상태: `docker ps -a`, `docker compose ls`, `docker compose -f /opt/rmarh/docker-compose.yml ps`
- Systemd 사용 안 함(직접 docker compose 실행). 필요 시 서비스화는 별도 추가.

## 배포 경로 (확인 완료)
- 애플리케이션 루트: `/opt/rmarh` (git clone https://github.com/heyjinjung/rmafh.git)
- 실행 방식: docker compose (직접 명령 실행)
- 주요 스크립트/명령:
   - `cd /opt/rmarh`
   - `docker compose build --no-cache`
   - `docker compose up -d`
- 환경 변수 파일: `/opt/rmarh/.env`
- 로그 디렉터리: docker 로그 사용 (`docker compose logs <svc> -f`), Nginx 컨테이너 내 `/var/log/nginx` (필요 시 `docker exec xmas-nginx ls /var/log/nginx`)

## 표준 배포 절차 (Docker compose)
1) 코드 동기화: `cd /opt/rmarh && git pull`
2) 환경변수 확인: `/opt/rmarh/.env` 최신화
3) 빌드/재기동: `docker compose build --no-cache && docker compose up -d`
4) 상태 확인: `docker compose ps`, `docker compose logs backend -f` (서비스명: `xmas-backend` 등 컨테이너 이름 참고)
5) 헬스 체크: BE `curl -f http://localhost:8000/health`, FE `curl -I http://localhost:3000` (또는 80/443 via Nginx)

## 로그/모니터링
- 어플리케이션: `docker compose logs backend -f`, `docker compose logs frontend -f`, `docker compose logs nginx -f`, `docker compose logs redis -f`, `docker compose logs db -f`
- 시스템: `journalctl -u <service> -f`, `dmesg -T`
- 리소스: `htop`, `df -h`, `free -h`

## 백업/스냅샷 가이드
- 볼륨/데이터 디렉터리 파악 후 rsync 또는 tar 백업.
- 클라우드 스냅샷 주기 설정(주 1회 이상 권장). Auto Backups 미사용 상태이므로 수동 스냅샷 필요.

## 보안 체크리스트
- SSH: 키 인증, 비밀번호 로그인 차단, root 원격 접속 최소화.
- 방화벽: 필요한 포트만 허용, 운영자 IP 화이트리스트 적용.
- 비밀정보: 비밀번호는 레포/문서에 남기지 말고 보안 채널로만 공유.

## 부록
- IP: 149.28.135.147 (싱가포르)
- OS: Ubuntu 22.04 x64
- 스펙: 1 vCPU / 2GB RAM / 25GB NVMe
- 백업: 자동 백업 미사용 → 수동 스냅샷 필요
