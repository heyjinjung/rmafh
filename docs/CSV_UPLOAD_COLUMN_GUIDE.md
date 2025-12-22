# CSV 업로드 필수 컬럼 가이드

## 1. CSV 파일 구조

어드민 페이지(`/admin/`)에서 일일 유저 데이터 업로드시 사용하는 CSV 파일 형식입니다.

### 1.1 필수 컬럼

| 컬럼명 | 타입 | 필수 | 설명 | 예시 |
|--------|------|------|------|------|
| `external_user_id` | 문자열 | ✅ 필수 | 외부 유저 식별자 (고유값) | `user_hong123`, `external_12345` |
| `nickname` | 문자열 | ⚠️ 권장 | 유저 닉네임 | `홍길동`, `casino_pro` |
| `deposit_total` | 숫자 | ⚠️ 권장 | 누적 입금액 (원 단위) | `1000000`, `500000` |
| `telegram_ok` | 불리언 | ⚠️ 권장 | 텔레그램 인증 완료 여부 | `true`, `false`, `1`, `0` |
| `joined_at` | 날짜/문자열 | ❌ 선택 | 가입일 (YYYY-MM-DD 또는 ISO) | `2024-12-01`, `2024-12-01T10:30:00Z` |
| `last_deposit_at` | 날짜/문자열 | ❌ 선택 | 마지막 입금 시각 (ISO 8601) | `2024-12-22T14:30:00Z` |
| `review_ok` | 불리언 | ❌ 선택 | 리뷰 작성 완료 여부 | `true`, `false` |

---

## 2. CSV 예시

### 2.1 최소 구성 (필수만)

```csv
external_user_id,nickname,deposit_total,telegram_ok
user_hong,홍길동,1000000,true
user_kim,김철수,500000,false
user_lee,이영희,2000000,true
```

### 2.2 전체 구성 (선택 포함)

```csv
external_user_id,nickname,deposit_total,telegram_ok,joined_at,last_deposit_at,review_ok
user_hong,홍길동,1000000,true,2024-12-01,2024-12-20T10:30:00Z,true
user_kim,김철수,500000,false,2024-12-10,2024-12-22T14:00:00Z,false
user_lee,이영희,2000000,true,2024-11-25,2024-12-21T09:15:00Z,true
external_999,최영수,750000,true,2024-12-15,,false
```

---

## 3. 컬럼별 상세 설명

### 3.1 `external_user_id` (필수)

**설명**: 외부 시스템 유저 식별자, 내부 `user_id`와 매핑됩니다.

**규칙**:
- 중복 불가 (CSV 내에서도 중복 제거됨)
- 빈 값 불가
- 최대 10,000개 행 제한

**처리 로직**:
- 기존 유저: `user_identity` 테이블에서 `user_id` 조회
- 신규 유저: 자동 생성 후 `user_id` 매핑

---

### 3.2 `nickname` (권장)

**설명**: 유저 닉네임, UI 표시용

**규칙**:
- 빈 값 허용 (NULL로 저장)
- 최대 길이: 제한 없음 (DB TEXT 타입)

**저장 위치**: `user_admin_snapshot.nickname`

---

### 3.3 `deposit_total` (권장)

**설명**: 누적 입금액, 다이아몬드 해금 조건 (`>= 500,000`)

**규칙**:
- 숫자만 입력 (쉼표 제거: `1,000,000` → `1000000`)
- 음수 자동 보정 → 0
- 기본값: `0`

**영향**:
- `vault_status.diamond_deposit_current` 업데이트
- `deposit_total >= 500,000` → 다이아몬드 금고 `UNLOCKED`
- 출석 체크: 전일 대비 입금액 `>= 50,000` → 출석 카운트 증가

**저장 위치**:
- `user_admin_snapshot.deposit_total`
- `vault_status.diamond_deposit_current`

---

### 3.4 `telegram_ok` (권장)

**설명**: 텔레그램 인증 완료 여부, 골드 해금 조건

**규칙**:
- `true`, `false`, `1`, `0`, `yes`, `no` 허용
- 대소문자 무시
- 기본값: `false`

**영향**:
- `telegram_ok = true` → 골드 금고 `UNLOCKED`

**저장 위치**:
- `user_admin_snapshot.telegram_ok`
- `vault_status.gold_status`

---

### 3.5 `joined_at` (선택)

**설명**: 가입일

**형식**:
- `YYYY-MM-DD` (예: `2024-12-01`)
- ISO 8601 (예: `2024-12-01T10:30:00Z`)

**규칙**:
- 파싱 실패시 NULL
- 빈 값 허용

**저장 위치**: `user_admin_snapshot.joined_date`

---

### 3.6 `last_deposit_at` (선택)

**설명**: 마지막 입금 시각, 출석 날짜 계산에 사용

**형식**: ISO 8601 (`2024-12-22T14:30:00Z`)

**규칙**:
- 파싱 실패시 NULL
- 빈 값 허용
- NULL일 경우 오늘 날짜로 출석 계산

**영향**:
- 출석 날짜(`import_date`) 계산
- 연속 출석 체크

**저장 위치**: `user_admin_snapshot.last_deposit_at`

---

### 3.7 `review_ok` (선택)

**설명**: 리뷰 작성 완료 여부, 플래티넘 해금 조건 중 하나

**규칙**:
- `true`, `false`, `1`, `0` 허용
- 기본값: `false`

**영향**:
- `review_ok = true` + `출석 3일` → 플래티넘 금고 `UNLOCKED`

**저장 위치**:
- `user_admin_snapshot.review_ok`
- `vault_status.platinum_status` (조건 충족시)

---

## 4. 업로드 제한사항

| 항목 | 제한 |
|------|------|
| 최대 행 수 | 10,000 행 |
| 파일 크기 | 프론트엔드 제한 (권장: < 5MB) |
| 중복 제거 | CSV 내 동일 `external_user_id` 중복 제거 |
| 에러 처리 | 잘못된 행은 스킵, 처리 가능한 행만 진행 |

---

## 5. API 응답 예시

### 5.1 성공 케이스

**요청**: 150행 CSV 업로드

**응답**:
```json
{
  "total": 150,
  "processed": 148,
  "identity_created": 5,
  "vault_rows_updated": 148
}
```

**설명**:
- `total`: CSV 총 행 수
- `processed`: 실제 처리된 행 수 (중복/오류 제외)
- `identity_created`: 신규 유저 수
- `vault_rows_updated`: 금고 상태 업데이트된 유저 수

---

### 5.2 에러 케이스

**에러**: `EMPTY_ROWS`

```json
{
  "detail": "EMPTY_ROWS"
}
```

**원인**: CSV 파일에 유효한 행이 없음

---

**에러**: `TOO_MANY_ROWS`

```json
{
  "detail": "TOO_MANY_ROWS"
}
```

**원인**: 10,000행 초과

---

## 6. 금고 해금 조건 정리

| 금고 타입 | 해금 조건 | 관련 CSV 컬럼 |
|-----------|-----------|---------------|
| **골드** | `telegram_ok = true` | `telegram_ok` |
| **플래티넘** | `review_ok = true` **AND** `출석 3일` | `review_ok`, `deposit_total`, `last_deposit_at` |
| **다이아몬드** | `deposit_total >= 500,000` | `deposit_total` |

### 6.1 출석 조건

- **출석 인정**: 전일 대비 입금액 `>= 50,000원`
- **연속 출석**: 전날 출석했고 오늘도 조건 충족
- **최대 출석일**: 3일 (플래티넘 해금)

---

## 7. 운영 시나리오

### 7.1 신규 유저 등록

```csv
external_user_id,nickname,deposit_total,telegram_ok
new_user_001,신규유저1,0,false
```

**결과**:
- `user_identity` 생성 (user_id 자동 할당)
- `vault_status` 기본 행 생성 (골드/플래티넘/다이아 모두 `LOCKED`)
- 72시간 만료 타이머 시작

---

### 7.2 골드 해금

```csv
external_user_id,nickname,deposit_total,telegram_ok
existing_user,기존유저,100000,true
```

**결과**:
- `vault_status.gold_status` → `UNLOCKED`

---

### 7.3 다이아몬드 해금

```csv
external_user_id,nickname,deposit_total,telegram_ok
vip_user,VIP유저,1000000,true
```

**결과**:
- `vault_status.diamond_status` → `UNLOCKED`
- `vault_status.gold_status` → `UNLOCKED`

---

### 7.4 플래티넘 해금 (3일 연속 출석)

**Day 1**:
```csv
external_user_id,deposit_total,last_deposit_at,review_ok
user_abc,100000,2024-12-20T10:00:00Z,true
```

**Day 2** (전일 대비 +50,000):
```csv
external_user_id,deposit_total,last_deposit_at,review_ok
user_abc,150000,2024-12-21T10:00:00Z,true
```

**Day 3** (전일 대비 +50,000):
```csv
external_user_id,deposit_total,last_deposit_at,review_ok
user_abc,200000,2024-12-22T10:00:00Z,true
```

**결과**:
- `vault_status.platinum_attendance_days` → `3`
- `vault_status.platinum_status` → `UNLOCKED`

---

## 8. FAQ

### Q1. CSV에서 빈 값은 어떻게 처리되나요?

**A**: 
- `external_user_id`: 빈 값이면 해당 행 스킵
- `nickname`, `joined_at`, `last_deposit_at`: NULL로 저장
- `deposit_total`: `0`으로 처리
- `telegram_ok`, `review_ok`: `false`로 처리

---

### Q2. 중복된 `external_user_id`가 있으면?

**A**: CSV 내 중복은 제거되고, 첫 번째 행만 처리됩니다.

---

### Q3. 기존 유저 데이터를 덮어쓰나요?

**A**: 네, `ON CONFLICT DO UPDATE` 방식으로 최신 데이터로 갱신합니다.

---

### Q4. 날짜 형식이 잘못되면?

**A**: 파싱 실패시 NULL로 저장되며, 에러는 발생하지 않습니다.

---

## 9. 참고 문서

- [API 스펙](API_SPEC_VAULT_V2.md)
- [DB 설계](DB_DESIGN_VAULT_V2.md)
- [어드민 가이드](ADMIN_GUIDE_VAULT_V2.md)
- [감사 로그 운영 가이드](ADMIN_AUDIT_OPERATIONS_GUIDE.md)

---

**작성일**: 2024-12-22  
**버전**: 1.0  
**담당자**: Backend Team
