# CSV 업로드 및 ADMIN 권한 문제 해결 가이드

## 🚨 문제 1: CSV 한글 깨짐 현상

### 원인
Excel이나 다른 프로그램에서 CSV를 저장할 때 UTF-8 인코딩이 아닌 다른 인코딩(CP949, EUC-KR 등)으로 저장되어 발생합니다.

### 해결방법

#### Option 1: Excel에서 UTF-8 CSV로 저장 (권장)
1. Excel에서 파일 열기
2. **파일 > 다른 이름으로 저장**
3. 파일 형식: **CSV UTF-8 (쉼표로 분리)(*.csv)** 선택
4. 저장

#### Option 2: 메모장으로 인코딩 변환
1. CSV 파일을 메모장으로 열기
2. **파일 > 다른 이름으로 저장**
3. 인코딩: **UTF-8** 선택
4. 저장

#### Option 3: VSCode로 인코딩 변환
1. VSCode에서 CSV 파일 열기
2. 우측 하단의 인코딩 표시 클릭 (예: `EUC-KR`)
3. **인코딩하여 다시 열기** 선택
4. **UTF-8** 선택
5. **파일 > 저장**

### CSV 파일 형식 예시
```csv
아이디,닉네임,입금액,텔레그램,가입일,입금일,리뷰
user001,홍길동,50000,TRUE,2025-12-01,2025-12-20,TRUE
user002,김철수,30000,FALSE,2025-12-01,2025-12-20,FALSE
user003,이영희,10000,TRUE,2025-12-02,2025-12-20,TRUE
```

**중요**: 
- 첫 번째 줄은 반드시 헤더(컬럼명)여야 합니다
- 텔레그램, 리뷰는 TRUE/FALSE 또는 1/0 또는 확인/미확인
- 입금액은 숫자만 (쉼표 있어도 자동 처리됨)

---

## 🚨 문제 2: ADMIN 권한 없음 (401 Unauthorized)

### 체크리스트

#### 1. 백엔드 환경변수 확인
```powershell
# 현재 설정된 비밀번호 확인
docker compose exec api env | Select-String "ADMIN_PASSWORD"
```

**예상 출력**: `ADMIN_PASSWORD=admin123`

만약 출력이 없거나 다른 값이면:
```powershell
# docker-compose.yml 확인
cat docker-compose.yml | Select-String "ADMIN_PASSWORD"

# 재빌드 (환경변수 변경 시 필수)
docker compose down
docker compose up -d --build
```

#### 2. 프론트엔드 로그인 절차 확인

**올바른 로그인 순서**:
1. 브라우저에서 http://localhost:3002/admin 접속
2. **먼저 "관리자 인증" 섹션에서 비밀번호 입력**
3. 비밀번호: `admin123` 입력
4. **"로그인" 버튼 클릭**
5. 화면 상단에 ✅ 인증됨 표시 확인
6. 그 이후에 다른 기능 사용

#### 3. 브라우저 개발자도구로 확인

**Chrome/Edge**: `F12` 누르기
1. **Network** 탭 열기
2. CSV 업로드 또는 다른 관리 기능 실행
3. 요청 클릭 → **Headers** 탭 확인
4. **Request Headers**에서 `x-admin-password: admin123` 있는지 확인

**없다면**: 
- 로그인을 하지 않은 것입니다
- 관리자 인증 섹션에서 다시 로그인하세요

#### 4. 백엔드 로그 확인
```powershell
# 실시간 로그 보기
docker compose logs -f api

# 최근 50줄만 보기
docker compose logs api --tail 50
```

**401 오류 발생 시 로그 예시**:
```
INFO:     127.0.0.1:xxxxx - "POST /api/vault/user-daily-import HTTP/1.1" 401 Unauthorized
```

#### 5. 전체 재시작 (최종 수단)
```powershell
# 모든 컨테이너 중지 및 재시작
docker compose restart

# 또는 완전히 재빌드
docker compose down
docker compose up -d --build
```

---

## 🔧 문제 해결 플로우차트

```
CSV 업로드 또는 관리 기능 사용 시 401 오류?
│
├─ YES → 로그인 했나요?
│   ├─ NO → admin.jsx 페이지에서 "관리자 인증" 섹션 찾아서 비밀번호 입력 후 로그인
│   └─ YES → 아래 계속
│
├─ 브라우저 개발자도구(F12) → Network → Request Headers에 x-admin-password 있나요?
│   ├─ NO → 페이지 새로고침 후 다시 로그인
│   └─ YES → 아래 계속
│
├─ docker compose exec api env | grep ADMIN_PASSWORD 실행 결과는?
│   ├─ 결과 없음 → docker-compose.yml에 ADMIN_PASSWORD 추가 후 docker compose up -d
│   └─ admin123 → 아래 계속
│
└─ docker compose logs api 에서 401 오류 로그에 "UNAUTHORIZED" 메시지 있나요?
    ├─ YES → 비밀번호가 틀림 (admin123이 아닌 다른 값 사용 중)
    └─ NO → 프록시 파일에서 헤더 전달 안 됨 → docs/API_PROXY_ERROR_CHECKLIST.md 참고
```

---

## 🎯 빠른 해결 스크립트

### 1. 전체 상태 확인
```powershell
# 컨테이너 상태
Write-Host "`n=== 컨테이너 상태 ===" -ForegroundColor Yellow
docker compose ps

# 환경변수 확인
Write-Host "`n=== ADMIN_PASSWORD 확인 ===" -ForegroundColor Yellow
docker compose exec api env | Select-String "ADMIN_PASSWORD"

# 백엔드 최근 로그
Write-Host "`n=== 백엔드 최근 로그 ===" -ForegroundColor Yellow
docker compose logs api --tail 20
```

### 2. 완전 재시작
```powershell
Write-Host "모든 컨테이너 재시작 중..." -ForegroundColor Yellow
docker compose down
docker compose up -d --build
Write-Host "완료! http://localhost:3002/admin 에서 다시 로그인하세요" -ForegroundColor Green
```

---

## 📝 CSV 업로드 테스트 파일

다음 내용을 `test-upload.csv`로 UTF-8 인코딩으로 저장하여 테스트하세요:

```csv
아이디,닉네임,입금액,텔레그램,가입일,입금일,리뷰
test001,테스트유저1,50000,TRUE,2025-12-01,2025-12-20,TRUE
test002,테스트유저2,30000,FALSE,2025-12-01,2025-12-20,FALSE
```

---

## 🚀 정상 작동 확인

1. ✅ CSV 파일이 UTF-8로 저장되었나요?
2. ✅ admin.jsx에서 비밀번호 `admin123` 입력 후 로그인했나요?
3. ✅ 화면 상단에 "✅ 인증됨" 표시가 나타났나요?
4. ✅ 브라우저 개발자도구에서 `x-admin-password` 헤더가 전달되나요?
5. ✅ CSV 업로드 시 200 OK 응답이 오나요?

**모두 YES라면**: 정상 작동 중입니다! 🎉
**하나라도 NO라면**: 위의 해당 섹션을 다시 확인하세요.
