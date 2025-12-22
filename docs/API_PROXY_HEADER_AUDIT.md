# API 프록시 헤더 전달 점검 보고서

## 📋 백엔드 엔드포인트 인증 현황

### ✅ 어드민 인증 필요 (Depends(verify_admin_password))
1. `/api/vault/user-daily-import` - POST ✅ 수정됨
2. `/api/vault/referral-revive` - POST ✅ 수정됨
3. `/api/vault/extend-expiry` - POST ✅ 수정됨
4. `/api/vault/notify` - POST ✅ 수정됨
5. `/api/vault/compensation-enqueue` - POST ⚠️ **프록시 없음**

### ❌ 어드민 인증 불필요 (공개 엔드포인트)
1. `/health` - GET (헬스체크)
2. `/api/vault/login` - POST (유저 로그인)
3. `/api/vault/status` - GET (유저 상태 조회)
4. `/api/vault/claim` - POST (보상 수령)
5. `/api/vault/attendance` - POST (출석체크)
6. `/api/vault/user-identity/bulk` - POST (유저 ID 일괄 조회)

## 🔍 프론트엔드 API 프록시 점검 결과

### ✅ 헤더 전달 완료
- `user-daily-import.js` - x-admin-password 전달 ✅
- `extend-expiry.js` - x-admin-password 전달 ✅
- `notify.js` - x-admin-password 전달 ✅
- `referral-revive.js` - x-admin-password 전달 ✅

### ⚠️ 헤더 전달 불필요 (공개 API)
- `status.js` - 유저 API (인증 불필요)
- `claim.js` - 유저 API (인증 불필요)
- `attendance.js` - 유저 API (인증 불필요)
- `user-identity-bulk.js` - 유저 API (인증 불필요)

### ❌ 누락된 프록시
- `compensation-enqueue` - **프록시 파일 자체가 없음**

## 🚨 발견된 문제점

### 1. compensation-enqueue 프록시 누락
**문제**: `/api/vault/compensation-enqueue` 엔드포인트는 어드민 인증이 필요하지만 Next.js 프록시가 없습니다.

**영향**: 어드민 페이지에서 보상 큐 등록 기능 사용 불가

**해결방안**: 
- Option A: `frontend/pages/api/vault/compensation-enqueue.js` 생성 필요
- Option B: 어드민 페이지에서 사용하지 않는다면 무시 가능

### 2. 환경변수 누락 가능성
**문제**: API 컨테이너에서 `ADMIN_PASSWORD` 환경변수가 누락되면 기본값(`admin1234`) 사용

**영향**: 프론트엔드에서 `admin123` 입력 시 인증 실패

**현재 상태**: ✅ docker-compose.yml에 추가됨 (`admin123`)

### 3. CORS 설정
**문제**: 프로덕션 환경에서 프론트엔드 도메인이 다를 경우 CORS 에러 가능

**영향**: 브라우저에서 직접 백엔드 호출 시 차단

**현재 상태**: ⚠️ 백엔드에 CORS 미들웨어 미확인

## ✅ 정상 작동 확인 사항

1. **헤더 전달 체인**
   - 브라우저 → fetch with `x-admin-password` header
   - Next.js 프록시 → `req.headers['x-admin-password']` 읽기
   - 백엔드 → `Header(None)` 파라미터로 수신
   - FastAPI → `verify_admin_password` 함수에서 검증

2. **인증 흐름**
   ```
   admin.jsx (adminPassword 상태)
   → callApiRaw (headers['x-admin-password'] 설정)
   → Next.js 프록시 (headers 전달)
   → 백엔드 API (verify_admin_password)
   ```

3. **테스트 완료**
   - user-daily-import ✅
   - extend-expiry ✅
   - notify ✅
   - referral-revive ✅

## 📝 추가 권장사항

### 1. 에러 메시지 개선
현재 `UNAUTHORIZED` 메시지만 반환됨. 더 자세한 메시지로 개선 가능:
```python
if x_admin_password != config.ADMIN_PASSWORD:
    raise HTTPException(
        status_code=401, 
        detail={
            "code": "UNAUTHORIZED",
            "message": "Invalid admin password"
        }
    )
```

### 2. 로깅 추가
어드민 인증 실패 시 로그 기록:
```python
if x_admin_password != config.ADMIN_PASSWORD:
    logger.warning(f"Admin auth failed from {request.client.host}")
    raise HTTPException(status_code=401, detail="UNAUTHORIZED")
```

### 3. Rate Limiting
어드민 엔드포인트에 요청 제한 추가 권장 (브루트포스 공격 방지)

### 4. 프로덕션 보안
- `ADMIN_PASSWORD`를 환경변수로만 설정 (코드에서 기본값 제거)
- HTTPS 필수 (헤더가 평문으로 전송됨)
- IP 화이트리스트 추가 고려

## 🎯 즉시 조치 필요 항목

### 높음
- ❌ **없음** (모든 어드민 API 헤더 전달 완료)

### 중간
- ⚠️ `compensation-enqueue.js` 프록시 생성 (기능 사용 시)

### 낮음
- 📝 에러 메시지 개선
- 📝 로깅 추가
- 📝 Rate limiting

## ✅ 최종 점검 체크리스트

- [x] user-daily-import 헤더 전달
- [x] extend-expiry 헤더 전달
- [x] notify 헤더 전달
- [x] referral-revive 헤더 전달
- [x] ADMIN_PASSWORD 환경변수 설정
- [x] Docker 컨테이너 재시작
- [ ] compensation-enqueue 프록시 생성 (필요시)
- [ ] CORS 미들웨어 확인 (프로덕션)
- [ ] Rate limiting 추가 (프로덕션)

---

**작성일**: 2025-12-22  
**상태**: ✅ 핵심 기능 정상 작동  
**다음 단계**: 프로덕션 배포 전 보안 강화
