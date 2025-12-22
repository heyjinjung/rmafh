# ⚠️ 긴급 해결: ADMIN 권한 없음 (401) 문제

## 🔍 원인 분석 완료

**문제**: 프론트엔드에서 `x-admin-password` 헤더를 백엔드로 전달하지 못함

**확인된 상황**:
- ✅ docker-compose.yml에 `ADMIN_PASSWORD: admin123` 설정됨
- ✅ 백엔드 컨테이너에서 환경변수 확인됨
- ❌ **하지만 계속 401 Unauthorized 발생**

**로그 증거**:
```
INFO: 172.19.0.5:xxxxx - "POST /api/vault/user-daily-import HTTP/1.1" 401 Unauthorized
```

---

## 🎯 즉시 해결 방법

### 방법 1: 올바른 로그인 절차 (가장 중요!)

1. 브라우저에서 http://localhost:3002/admin 접속
2. **비밀번호 입력란에 정확히 `admin123` 입력** (공백 없이!)
3. **"로그인" 버튼 클릭**
4. 로그인 후 화면 확인

**⚠️ 주의사항**:
- 비밀번호 입력 시 **대소문자 구분** (`admin123` 정확히)
- 앞뒤 **공백 없이** 입력
- 비밀번호를 입력하지 않고 로그인 버튼을 누르면 작동하지 않음

### 방법 2: 브라우저 개발자도구로 확인

1. `F12` 키를 눌러 개발자도구 열기
2. **Network** 탭 선택
3. CSV 업로드 시도
4. `user-daily-import` 요청 클릭
5. **Headers** 탭에서 **Request Headers** 확인
6. `x-admin-password: admin123` 있는지 확인

**없다면**:
- 로그인을 안 한 것입니다
- 페이지를 새로고침한 경우 (상태 초기화됨)
- 다시 로그인하세요

---

## 🔧 확실한 테스트 방법

### PowerShell에서 직접 API 호출 테스트

```powershell
# 올바른 비밀번호로 테스트
$headers = @{
    "Content-Type" = "application/json"
    "x-admin-password" = "admin123"
}
$body = @{
    rows = @(
        @{
            external_user_id = "test001"
            nickname = "테스트"
            deposit_total = 10000
        }
    )
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:18000/api/vault/user-daily-import" -Method POST -Headers $headers -Body $body
```

**성공 시 응답**:
```json
{
  "created": 1,
  "updated": 0,
  "total": 1
}
```

**실패 시 (401)**:
```json
{
  "detail": {
    "code": "UNAUTHORIZED",
    "message": "..."
  }
}
```

---

## 🐛 디버깅 체크리스트

### ✅ 1단계: 백엔드 직접 테스트
```powershell
# 백엔드 API에 직접 요청 (프록시 우회)
Invoke-RestMethod -Uri "http://localhost:18000/health"
```
**예상 응답**: `{"status":"ok"}`

### ✅ 2단계: 인증 없는 엔드포인트 테스트
```powershell
Invoke-RestMethod -Uri "http://localhost:18000/api/vault/status?user_id=1"
```
**예상 응답**: 200 OK (인증 불필요)

### ✅ 3단계: 인증 필요 엔드포인트 (잘못된 비밀번호)
```powershell
$wrongHeaders = @{
    "Content-Type" = "application/json"
    "x-admin-password" = "wrongpass"
}
$testBody = '{"type":"EXPIRY_D2","user_ids":[1]}'

Invoke-RestMethod -Uri "http://localhost:18000/api/vault/notify" -Method POST -Headers $wrongHeaders -Body $testBody
```
**예상 응답**: 401 Unauthorized

### ✅ 4단계: 올바른 비밀번호
```powershell
$correctHeaders = @{
    "Content-Type" = "application/json"
    "x-admin-password" = "admin123"
}

Invoke-RestMethod -Uri "http://localhost:18000/api/vault/notify" -Method POST -Headers $correctHeaders -Body $testBody
```
**예상 응답**: 200 OK

---

## 🚨 여전히 401 오류가 나온다면?

### 시나리오 A: 브라우저에서만 401 (PowerShell은 200 OK)
**원인**: 프론트엔드 코드 문제
**해결**: admin.jsx 로그인 로직 확인

1. 로그인 후 브라우저 콘솔(F12 → Console)에서 실행:
```javascript
console.log('isAuthenticated:', localStorage.getItem('isAuthenticated'));
console.log('adminPassword:', localStorage.getItem('adminPassword'));
```

2. 두 값이 모두 null이면 **로그인이 유지되지 않음**

### 시나리오 B: PowerShell에서도 401
**원인**: 백엔드 설정 문제
**해결**:
```powershell
# 환경변수 재확인
docker compose exec api printenv | Select-String "ADMIN"

# 백엔드 재시작
docker compose restart api

# 로그 확인
docker compose logs api --tail 50
```

### 시나리오 C: 모든 곳에서 401
**원인**: ADMIN_PASSWORD 불일치
**해결**:
```powershell
# docker-compose.yml 확인
cat docker-compose.yml | Select-String "ADMIN_PASSWORD"

# 만약 다른 값이면 수정 후
docker compose down
docker compose up -d
```

---

## 📋 최종 해결 스크립트

### 완전 초기화 후 재시작
```powershell
Write-Host "=== 시스템 완전 재시작 ===" -ForegroundColor Yellow

# 모든 컨테이너 중지
Write-Host "1. 컨테이너 중지 중..." -ForegroundColor Gray
docker compose down

# 재시작
Write-Host "2. 컨테이너 시작 중..." -ForegroundColor Gray
docker compose up -d

# 대기
Write-Host "3. 시스템 준비 대기 (10초)..." -ForegroundColor Gray
Start-Sleep -Seconds 10

# 상태 확인
Write-Host "4. 상태 확인" -ForegroundColor Gray
docker compose ps

Write-Host "`n=== 테스트 ===" -ForegroundColor Yellow
$headers = @{
    "Content-Type" = "application/json"
    "x-admin-password" = "admin123"
}
$body = '{"type":"EXPIRY_D2","user_ids":[1]}'

try {
    $result = Invoke-RestMethod -Uri "http://localhost:18000/api/vault/notify" -Method POST -Headers $headers -Body $body
    Write-Host "✅ SUCCESS: 백엔드 인증 정상 작동" -ForegroundColor Green
    Write-Host "   응답: $($result | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "❌ FAILED: 여전히 401 오류" -ForegroundColor Red
    Write-Host "   에러: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== 다음 단계 ===" -ForegroundColor Yellow
Write-Host "1. 브라우저에서 http://localhost:3002/admin 접속" -ForegroundColor Gray
Write-Host "2. 비밀번호: admin123 입력 (정확히!)" -ForegroundColor Gray
Write-Host "3. 로그인 버튼 클릭" -ForegroundColor Gray
Write-Host "4. CSV 업로드 시도" -ForegroundColor Gray
```

---

## 💡 CSV 인코딩 문제 해결

스크린샷에서 보이는 한글 깨짐은 **CSV 파일이 UTF-8이 아닌 다른 인코딩**으로 저장되어서 발생합니다.

### 빠른 해결:
1. CSV 파일을 **메모장**으로 열기
2. **파일 > 다른 이름으로 저장**
3. 인코딩: **UTF-8** 선택
4. 저장
5. 다시 업로드

### VSCode 사용:
1. CSV 파일을 VSCode로 열기
2. 우측 하단 인코딩 클릭
3. **UTF-8로 인코딩하여 다시 열기** 선택
4. 저장

### Excel 사용:
- **파일 > 다른 이름으로 저장**
- 파일 형식: **CSV UTF-8 (쉼표로 분리)** 선택

---

## 🎯 결론

**가장 흔한 실수**:
1. 비밀번호 입력 안 함
2. 로그인 안 함
3. 페이지 새로고침 (상태 초기화)
4. CSV 파일이 UTF-8이 아님

**해결 순서**:
1. 위 스크립트 실행 (시스템 재시작)
2. CSV를 UTF-8로 저장
3. 브라우저에서 admin123으로 로그인
4. 개발자도구(F12)로 헤더 확인
5. CSV 업로드

**여전히 안 되면**:
```powershell
# 백엔드 로그 실시간 보기
docker compose logs -f api
```
그 상태에서 CSV 업로드 시도 → 오류 메시지 캡처 후 공유
