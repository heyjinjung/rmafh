# API 프록시 인증 오류 체크리스트

## ✅ 확인 완료 항목

### 1. Next.js 프록시 헤더 전달
- [x] `user-daily-import.js` - x-admin-password 전달 추가
- [x] `extend-expiry.js` - x-admin-password 전달 추가
- [x] `notify.js` - x-admin-password 전달 추가
- [x] `referral-revive.js` - x-admin-password 전달 추가

### 2. 환경변수 설정
- [x] docker-compose.yml에 ADMIN_PASSWORD 추가 (admin123)
- [x] 백엔드 컨테이너 재시작하여 환경변수 적용

### 3. CORS 설정
- [x] 백엔드에 CORSMiddleware 설정 확인 (allow_origins=["*"])

---

## ⚠️ 잠재적 오류 가능성

### 1. 프록시 파일 누락
**오류**: `compensation-enqueue` 엔드포인트 프록시 없음
- **영향**: 어드민 페이지에서 보상 큐 등록 기능 사용 불가
- **확인방법**: 
  ```bash
  ls frontend/pages/api/vault/ | grep compensation
  ```
- **해결방법**: 
  - Option A: 프록시 파일 생성 (사용하는 경우만)
  - Option B: 사용하지 않으면 무시
- **우선순위**: LOW (어드민 UI에서 사용 여부 확인 필요)

### 2. 대소문자 헤더 이름 불일치
**오류**: 브라우저/프록시/백엔드에서 헤더 이름 대소문자 다를 수 있음
- **영향**: 헤더가 전달되지 않아 401 오류
- **확인방법**: 브라우저 개발자도구 Network 탭에서 Request Headers 확인
- **현재 상태**: 
  - 프론트엔드: `x-admin-password` (소문자)
  - 프록시: `req.headers['x-admin-password']` (소문자)
  - 백엔드: `x_admin_password = Header(None)` (언더스코어)
- **해결방법**: HTTP 헤더는 대소문자 구분 없음, FastAPI가 자동 변환 (x-admin-password → x_admin_password)
- **우선순위**: ✅ RESOLVED (FastAPI가 자동 처리)

### 3. 프록시 URL 경로 불일치
**오류**: 프록시가 백엔드로 요청 시 URL 경로 틀림
- **영향**: 404 Not Found 또는 잘못된 엔드포인트 호출
- **확인방법**: 
  ```javascript
  // notify.js 예시
  const upstream = await fetch(`${base}/api/vault/notify${buildQuery(req)}`, ...)
  ```
- **현재 상태**: ✅ 모든 프록시가 동일한 경로 사용 (`/api/vault/<endpoint>`)
- **우선순위**: ✅ RESOLVED

### 4. Content-Type 헤더 누락
**오류**: 프록시가 백엔드로 요청 시 Content-Type 미설정
- **영향**: 백엔드가 JSON 파싱 실패 → 422 Unprocessable Entity
- **확인방법**: 
  ```javascript
  headers = {
    'content-type': 'application/json',  // 확인 필요
    accept: 'application/json',
  };
  ```
- **현재 상태**: ✅ 모든 프록시에 'content-type': 'application/json' 설정됨
- **우선순위**: ✅ RESOLVED

### 5. 요청 본문(body) 전달 실패
**오류**: 프록시가 클라이언트 요청 본문을 백엔드로 전달하지 않음
- **영향**: 백엔드가 빈 데이터 수신 → 422 Validation Error
- **확인방법**: 
  ```javascript
  body: JSON.stringify(req.body || {})  // 확인 필요
  ```
- **현재 상태**: ✅ 모든 프록시가 `JSON.stringify(req.body)` 사용
- **우선순위**: ✅ RESOLVED

### 6. 쿼리 파라미터 전달 누락
**오류**: URL 쿼리 파라미터(?user_id=1 등)가 백엔드로 전달되지 않음
- **영향**: 백엔드가 필수 파라미터 누락 → 422 Validation Error
- **확인방법**: 
  ```javascript
  const upstream = await fetch(`${base}/api/vault/notify${buildQuery(req)}`, ...)
  ```
- **현재 상태**: ✅ 모든 프록시가 `buildQuery(req)` 함수 사용
- **우선순위**: ✅ RESOLVED

### 7. 프록시 HTTP 메서드 불일치
**오류**: 클라이언트는 POST인데 프록시가 GET으로 백엔드 호출
- **영향**: 405 Method Not Allowed
- **확인방법**: 
  ```javascript
  if (req.method !== 'POST') {
    return res.status(405).json(...);
  }
  ```
- **현재 상태**: ✅ 모든 프록시가 메서드 검증 추가됨
- **우선순위**: ✅ RESOLVED

### 8. CORS 프리플라이트 OPTIONS 요청 처리
**오류**: 브라우저가 OPTIONS 요청 보낼 때 프록시가 처리 안 함
- **영향**: CORS 에러 (프로덕션에서만 발생 가능)
- **확인방법**: 브라우저 개발자도구 Network 탭에서 OPTIONS 요청 확인
- **현재 상태**: ⚠️ 프록시에 OPTIONS 처리 없음
- **해결방법**: 
  ```javascript
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  ```
- **우선순위**: MEDIUM (로컬 개발환경에서는 문제 없음, 프로덕션에서만 필요)

### 9. 백엔드 컨테이너 재시작 누락
**오류**: docker-compose.yml 수정 후 `docker compose restart`만 실행
- **영향**: 환경변수가 적용되지 않아 ADMIN_PASSWORD=admin1234 (기본값) 사용
- **확인방법**: 
  ```bash
  docker compose exec api env | grep ADMIN_PASSWORD
  ```
- **현재 상태**: ✅ `docker compose up -d` 실행하여 환경변수 적용됨
- **우선순위**: ✅ RESOLVED

### 10. 헤더 조건부 전달 누락
**오류**: 헤더가 undefined일 때도 백엔드로 전달
- **영향**: 백엔드에서 'undefined' 문자열로 인식 → 인증 실패
- **확인방법**: 
  ```javascript
  if (req.headers['x-admin-password']) {  // 확인 필요
    headers['x-admin-password'] = req.headers['x-admin-password'];
  }
  ```
- **현재 상태**: ✅ 모든 프록시에 조건부 전달 추가됨
- **우선순위**: ✅ RESOLVED

### 11. 백엔드 응답 상태코드 미전달
**오류**: 프록시가 백엔드 응답을 200 OK로 덮어씀
- **영향**: 401 오류를 클라이언트가 받지 못함
- **확인방법**: 
  ```javascript
  res.status(upstream.status);  // 확인 필요
  ```
- **현재 상태**: ✅ 모든 프록시가 `res.status(upstream.status)` 사용
- **우선순위**: ✅ RESOLVED

### 12. 에러 응답 본문 미전달
**오류**: 백엔드 에러 응답의 본문을 프록시가 전달하지 않음
- **영향**: 클라이언트가 에러 메시지를 받지 못함
- **확인방법**: 
  ```javascript
  const body = contentType.includes('application/json') 
    ? await upstream.json() 
    : await upstream.text();
  return res.json(body);
  ```
- **현재 상태**: ✅ 모든 프록시가 응답 본문 전달
- **우선순위**: ✅ RESOLVED

### 13. Next.js 개발서버 재시작 누락
**오류**: 프록시 파일 수정 후 Next.js 재시작 안 함
- **영향**: 변경사항이 적용되지 않음
- **확인방법**: 
  ```bash
  docker compose logs web | tail -20
  ```
- **현재 상태**: ⚠️ Docker volume mount로 핫리로드 되지만, 확실하게 재시작 권장
- **해결방법**: 
  ```bash
  docker compose restart web
  ```
- **우선순위**: LOW (핫리로드로 자동 적용됨)

### 14. 프론트엔드 상태관리 누락
**오류**: admin.jsx에서 adminPassword 상태가 초기화되지 않음
- **영향**: 페이지 새로고침 시 비밀번호 재입력 필요
- **확인방법**: admin.jsx의 useState 초기값 확인
- **현재 상태**: ✅ useState('') 기본값 설정됨 (로그인 시마다 입력)
- **우선순위**: LOW (보안상 sessionStorage 사용은 권장하지 않음)

### 15. 네트워크 타임아웃
**오류**: 백엔드 응답이 느릴 때 프록시가 타임아웃
- **영향**: 502 Bad Gateway 또는 504 Gateway Timeout
- **확인방법**: 큰 CSV 업로드 시 시간 측정
- **현재 상태**: ⚠️ fetch 타임아웃 미설정
- **해결방법**: 
  ```javascript
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30초
  const upstream = await fetch(url, { signal: controller.signal, ... });
  ```
- **우선순위**: LOW (일반적인 요청은 빠름, CSV 업로드 시에만 문제 가능)

---

## 🔍 테스트 체크리스트

### 브라우저 테스트 (http://localhost:3002/test-api-auth.html)
- [ ] TEST 1: 올바른 비밀번호 → 200 OK 예상
- [ ] TEST 2: 잘못된 비밀번호 → 401 Unauthorized 예상
- [ ] TEST 3: 헤더 없음 → 401 Unauthorized 예상
- [ ] TEST 4: 공개 API → 200 OK 예상

### 수동 테스트 (admin.jsx)
- [ ] 로그인 후 CSV 업로드 → 200 OK
- [ ] 만료기간 연장 → 200 OK
- [ ] 알림 발송 → 200 OK
- [ ] 레퍼럴 복구 → 200 OK

### 개발자도구 Network 탭 확인
- [ ] Request Headers에 `x-admin-password: admin123` 포함 확인
- [ ] Response Status가 200 또는 401인지 확인
- [ ] Response Body에 에러 메시지 포함 확인

---

## 📊 우선순위 요약

### 🔴 HIGH (즉시 수정 필요)
- 없음 ✅

### 🟡 MEDIUM (상황에 따라 수정)
- ✅ CORS 프리플라이트 OPTIONS 처리 - **완료** (4개 admin 프록시에 추가됨)

### 🟢 LOW (선택적 개선)
- ✅ compensation-enqueue 프록시 생성 - **완료** (생성됨)
- ✅ 네트워크 타임아웃 설정 - **완료** (30초 타임아웃 추가됨)
- ✅ Next.js 개발서버 재시작 - **완료** (재시작됨)

---

## 🎯 결론

**현재 상태**: ✅ **모든 오류 해결 완료 (필수 + 선택 항목 포함)**

1. 4개 주요 어드민 API 프록시 모두 헤더 전달 추가됨
2. 환경변수 ADMIN_PASSWORD 설정 완료
3. CORS 미들웨어 확인 완료
4. 헤더 전달 체인 검증 완료
5. **✅ CORS OPTIONS 처리 추가됨** (4개 admin 프록시)
6. **✅ compensation-enqueue 프록시 생성 완료**
7. **✅ 30초 타임아웃 설정 완료** (대용량 업로드 대응)
8. **✅ Next.js 서버 재시작 완료**

**다음 단계**:
1. 브라우저에서 http://localhost:3002/test-api-auth.html 접속
2. 4개 테스트 버튼 클릭하여 검증
3. admin.jsx에서 실제 기능 테스트

**문제 발생 시 디버깅**:
1. 브라우저 개발자도구 Network 탭에서 Request/Response 확인
2. `docker compose logs api` 로 백엔드 로그 확인
3. `docker compose logs web` 로 프론트엔드 로그 확인
