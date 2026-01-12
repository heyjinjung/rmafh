# 개발 진행 로그 - 2026-01-10

## 🔧 완료된 작업

### 1. SOT 만료일 72시간 → 120시간(5일) 통일

**문제**: 새 유저 생성 시 만료일이 3일(72시간)로 설정되어 SOT(5일)와 불일치

**원인**: 백엔드 코드에 72시간 하드코딩 발견
- `vault.py` Line 266, 341: `timedelta(hours=72)`
- `admin_users.py` Line 246: `timedelta(hours=72)`

**해결**:
- `vault.py`: `timedelta(hours=DEFAULT_EXPIRY_HOURS)` 로 수정 (2곳)
- `admin_users.py`: `DEFAULT_EXPIRY_HOURS` import 추가 및 사용

**검증**: SOT 테스트 13개 통과 (`test_sot_consistency.py`)

---

### 2. 테스트 DB 분리 (데이터 보존)

**문제**: `pytest` 실행마다 실제 DB(`vault`)가 초기화되어 개발 데이터 손실

**원인**: `conftest.py`의 `_reset_db_state` fixture가 `APP_ENV=test`일 때 모든 테이블 DELETE

**해결**: 테스트용 별도 DB `vault_test` 사용
```python
# conftest.py db_url fixture
if env_url.endswith("/vault"):
    env_url = env_url[:-6] + "/vault_test"
```

**결과**:
- `vault` DB: 개발/프로덕션 데이터 (유지됨)
- `vault_test` DB: 테스트 데이터 (매 테스트 초기화)

---

### 3. 프론트엔드 상태 매핑 수정

**문제**: 유저 페이지에서 UNLOCKED 상태가 "수령완료"로 표시

**원인**: `vaultConfig.js`의 `mapApiStatusToUi`가 `'unlocked'` 반환, `index.jsx`는 `'available'` 기대

**해결**: `vaultConfig.js` 수정
```javascript
if (apiStatus === 'UNLOCKED') return 'available'; // 'unlocked' → 'available'
```

---

### 4. 유저 페이지 아이콘 렌더링 오류 수정

**문제**: `ReferenceError: getVaultIcon is not defined`

**원인**: 존재하지 않는 함수 `getVaultIcon()` 호출

**해결**: `index.jsx`에서 `VaultIcon` 컴포넌트 사용
```jsx
// Before: {getVaultIcon(vault.tier)}
// After:
<VaultIcon tier={vault.tier} colorScheme={colorScheme} />
```

---

### 5. 선행조건 및 진행률 로직 수정

**문제**: 
1. 플래티넘/다이아 선행조건이 `CLAIMED`만 체크 → `UNLOCKED`도 "해제됨"으로 인정 필요
2. 진행률이 deposit 기반 → 미션 기반으로 변경 필요

**해결**: `vaultConfig.js` 수정
```javascript
// 플래티넘 선행조건: CLAIMED 또는 UNLOCKED
const goldUnlockedOrClaimed = api.gold_status === 'CLAIMED' || api.gold_status === 'UNLOCKED';

// 다이아 선행조건: CLAIMED 또는 UNLOCKED  
const platinumUnlockedOrClaimed = api.platinum_status === 'CLAIMED' || api.platinum_status === 'UNLOCKED';

// 진행률: 미션 기반 계산
const platinumProgress = Math.floor((platinumMissions.filter(m => m.isDone).length / platinumMissions.length) * 100);
const diamondProgress = Math.floor((diamondMissions.filter(m => m.isDone).length / diamondMissions.length) * 100);
```

---

## 📁 수정된 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `backend/app/routers/vault.py` | 72시간 → DEFAULT_EXPIRY_HOURS (2곳) |
| `backend/app/routers/admin_users.py` | 72시간 → DEFAULT_EXPIRY_HOURS + import |
| `backend/tests/conftest.py` | vault → vault_test DB 분리 |
| `frontend/lib/vaultConfig.js` | 상태 매핑, 선행조건, 진행률 로직 수정 |
| `frontend/pages/index.jsx` | getVaultIcon → VaultIcon 컴포넌트 |

---

## ✅ 테스트 결과

- **전체 테스트**: 109개 통과, 6개 스킵
- **SOT 일관성 테스트**: 13개 통과
- **미션 토글 테스트**: 10개 통과

---

## 📋 현재 상태

### 백엔드 SOT (`vault_config.py`)
- `DEFAULT_EXPIRY_HOURS = 120` (5일)
- `VAULT_EXPIRY_HOURS = {GOLD: 120, PLATINUM: 120, DIAMOND: 120}`

### 프론트엔드 SOT (`vaultConfig.js`)
- `DEFAULT_EXPIRY_HOURS = 120`
- 상태 매핑: UNLOCKED → 'available', CLAIMED → 'opened'

### DB 구조
- `vault`: 실제 개발/프로덕션 데이터
- `vault_test`: 테스트 전용 (매 실행 초기화)

---

### 6. 미션 토글 되돌리기 기능 구현

**문제**: 
1. 어드민이 미션 토글을 OFF로 변경해도 UNLOCKED 상태가 LOCKED로 되돌아가지 않음
2. 오수령된 CLAIMED 상태 복구 방법 없음

**원인**: `vault_service.py`의 `compute_*_status` 함수들이 UNLOCKED/CLAIMED 상태면 `return current_status`로 상태 유지

**해결**: `vault_service.py` 수정 (3개 함수)

```python
# Before: CLAIMED, EXPIRED 둘 다 보호
if current_status in {"CLAIMED", "EXPIRED"}:
    return current_status

# After: EXPIRED만 보호 (CLAIMED 되돌리기 허용)
if current_status == "EXPIRED":
    return current_status

# 미션 조건에 따라 동적 계산
return "UNLOCKED" if (m1 and m2) else "LOCKED"
```

**변경된 로직**:
| 현재 상태 | 미션 조건 | 결과 |
|----------|----------|------|
| LOCKED | ✅ + ✅ | UNLOCKED |
| UNLOCKED | ❌ | LOCKED (되돌리기) |
| CLAIMED | ✅ + ✅ | UNLOCKED (오수령 복구) |
| CLAIMED | ❌ | LOCKED (오수령 복구) |
| EXPIRED | any | EXPIRED (변경 불가) |

**테스트 수정**: `test_service_layer.py`
- `test_gold_status_claimed_not_changed` → `test_gold_status_claimed_can_be_reverted`
- `test_platinum_claimed_not_changed` → `test_platinum_claimed_can_be_reverted`
- `test_diamond_claimed_not_changed` → `test_diamond_claimed_can_be_reverted`

**검증**: 미션 토글 테스트 13개 통과

---

## 📁 수정된 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `backend/app/routers/vault.py` | 72시간 → DEFAULT_EXPIRY_HOURS (2곳) |
| `backend/app/routers/admin_users.py` | 72시간 → DEFAULT_EXPIRY_HOURS + import |
| `backend/tests/conftest.py` | vault → vault_test DB 분리 |
| `frontend/lib/vaultConfig.js` | 상태 매핑, 선행조건, 진행률 로직 수정 |
| `frontend/pages/index.jsx` | getVaultIcon → VaultIcon 컴포넌트 |
| `backend/app/services/vault_service.py` | CLAIMED 되돌리기 허용 (3개 함수) |
| `backend/tests/test_service_layer.py` | CLAIMED 되돌리기 테스트 수정 (3개) |

---

## ✅ 테스트 결과

- **전체 테스트**: 109개 통과, 6개 스킵
- **SOT 일관성 테스트**: 13개 통과
- **미션 토글 테스트**: 13개 통과 ✅

---

## 📋 현재 상태

### 백엔드 SOT (`vault_config.py`)
- `DEFAULT_EXPIRY_HOURS = 120` (5일)
- `VAULT_EXPIRY_HOURS = {GOLD: 120, PLATINUM: 120, DIAMOND: 120}`

### 프론트엔드 SOT (`vaultConfig.js`)
- `DEFAULT_EXPIRY_HOURS = 120`
- 상태 매핑: UNLOCKED → 'available', CLAIMED → 'opened'

### 미션 토글 되돌리기 규칙
- **EXPIRED**: 변경 불가 (기간 만료)
- **CLAIMED**: 미션 토글로 되돌리기 가능 (오수령 복구)
- **UNLOCKED/LOCKED**: 미션 토글로 자유롭게 전환

### DB 구조
- `vault`: 실제 개발/프로덕션 데이터
- `vault_test`: 테스트 전용 (매 실행 초기화)

---

## 🔜 다음 단계

1. ~~선행조건 로직 수정~~ ✅ 완료
2. ~~진행률 미션 기반 계산~~ ✅ 완료
3. ~~미션 토글 되돌리기 기능~~ ✅ 완료
4. 어드민 페이지에서 CLAIMED 유저 복구 테스트
5. 전체 통합 테스트
6. 프로덕션 배포 준비

---

# 개발 진행 로그 - 2026-01-12

## 🔥 긴급: 유저페이지 Mixed Content 차단 대응

**증상**: HTTPS 페이지에서 `http://cc-premium.com/api/vault/status?...` 호출 시 Mixed Content로 브라우저가 요청을 차단

**해결(프론트)**: [frontend/pages/index.jsx](../frontend/pages/index.jsx)
- API 호출 경로가 동일 오리진인데도 절대 URL(특히 `http://`)로 넘어오면, 브라우저에서 **상대경로(`/api/...`)로 정규화**하여 Mixed Content를 근본 차단
- `?external_user_id=...` 쿼리 앞에 불필요한 슬래시(`/status/?x=y`)가 붙지 않도록 정리 (`/status?x=y`)

**효과**:
- 페이지가 HTTPS로 로드될 때 동일 오리진 API 요청이 `http://`로 내려가도 최종 fetch는 `/api/...`로 수행되어 차단되지 않음

---

## 🔧 어드민 v2 린트/파서 차단 해제

**증상**: `frontend: lint` 실행 시 [frontend/components/admin-v2/AdminV2ImportsFlow.jsx](../frontend/components/admin-v2/AdminV2ImportsFlow.jsx)에서
`Parsing error: Unexpected token, expected ":"`

**원인**: JSX에서 삼항 연산자 `condition ? (...)` 형태로만 작성되어 `: ...` 분기가 누락됨

**해결**:
- `condition ? (...) : null` 형태로 수정하여 파서 에러 제거

---

## 🚀 서버 배포(업데이트/빌드) 메모

서버에서 보통 아래 순서로 당겨오고 재빌드:

```bash
cd /opt/2026
git fetch --all --prune
git checkout main
git pull
docker compose up -d --build api web worker
docker compose ps
```

---

## ⚠️ 현재 이슈: 502 (Bad Gateway)

**증상**: `https://cc-premium.com/` 및 `/favicon.ico`가 502

**상태**:
- 컨테이너는 `api(18000->8000)`, `web(3002->3000)` 모두 Up

**다음 확인(운영 점검 체크리스트)**:
1. `docker compose logs --tail=200 web`
2. `docker compose logs --tail=200 api`
3. Nginx upstream 설정(도메인 → `web:3000`/호스트 포트 매핑) 재확인
4. 호스트에서 `curl -i http://127.0.0.1:3002/` / `curl -i http://127.0.0.1:18000/api/health` 등으로 로컬 헬스체크

