# Vault System SOT (Source of Truth) v3.0

> ⚠️ **이 문서가 금고 시스템의 유일한 진실 공급원(SOT)입니다.**
> 모든 금고 관련 상수는 이 문서를 기준으로 합니다.

## 1. 메타
- 버전: v3.0
- 최종 수정: 2026-01-09
- 적용 대상: Backend (`constants/vault_config.py`), Frontend (`lib/vaultConfig.js`)

---

## 2. 금고 정의

### 2.1 골드 금고 (Gold Vault)

| 항목 | 값 | 비고 |
|------|-----|------|
| **Tier ID** | `gold` | |
| **보상액** | 10,000원 | |
| **마감기한** | 가입 후 72시간 | |
| **색상 테마** | `#FFD700` (Gold) | |

#### 해금 조건
| 순서 | 조건 ID | 조건명 | 검증 필드 | 소스 | 힌트 |
|------|---------|--------|-----------|--------|------|
| 1 | `g1` | CC카지노 공식채널 입장 | `gold_mission_1_done` | CSV (`telegram_ok`) | 각종 이벤트 및 보너스 드랍 진행 |
| 2 | `g2` | 담당실장 공식채널 입장 | `gold_mission_2_done` | 어드민 토글 | 본사혜택 외 추가 이벤트 진행 |
| 3 | `g3` | 간편 본인확인 | `gold_mission_3_done` | 어드민 토글 | 담당실장에게 본인 확인 |

> ⚠️ **골드 해금 로직**: `telegram_ok`만 충족하면 `gold_status = UNLOCKED`
> - Mission 2/3는 **UI 표시용**으로만 사용 (외부 시스템 연동 불가)
> - CSV에서 `telegram_ok=true`일 경우 `gold_mission_1_done=true`로 자동 설정

#### 선행 조건
- 없음 (진입 금고)

---

### 2.2 플래티넘 금고 (Platinum Vault)

| 항목 | 값 | 비고 |
|------|-----|------|
| **Tier ID** | `platinum` | |
| **보상액** | 30,000원 | |
| **마감기한** | 가입 후 72시간 | 골드와 동일 |
| **색상 테마** | `#E5E4E2` (Platinum) | |

#### 해금 조건
| 순서 | 조건 ID | 조건명 | 검증 필드 | 목표값 | 힌트 |
|------|---------|--------|-----------|--------|------|
| 1 | `p1` | 누적 입금 20만원 달성 | `platinum_deposit_total` | 200,000원 | 신규 입플도 놓치지 마세요! |
| 2 | `p2` | 누적 입금 3회 달성 | `platinum_deposit_count` | 3회 | 최소 이용 금액 단돈 만원 이상! |
| 3 | `p3` | 골드 금고 해금 | `gold_status` | `CLAIMED` | 선행 조건 |

#### 선행 조건
- 골드 금고 해금 (`gold_status === 'CLAIMED'`)

---

### 2.3 다이아 금고 (Diamond Vault)

| 항목 | 값 | 비고 |
|------|-----|------|
| **Tier ID** | `diamond` | |
| **보상액** | 300,000원 | ⚠️ 변경됨 (기존 70,000원) |
| **마감기한** | 가입 후 5일 (120시간) | ⚠️ 변경됨 (기존 72시간) |
| **색상 테마** | `#B9F2FF` (Diamond Blue) | ⚠️ 색상 변경 예정 |

#### 해금 조건
| 순서 | 조건 ID | 조건명 | 검증 필드 | 목표값 | 힌트 |
|------|---------|--------|-----------|--------|------|
| 1 | `d1` | 누적 충전 200만원 달성 | `diamond_deposit_current` | 2,000,000원 | 현재 {금액} |
| 2 | `d2` | CC카지노 2회 출석 | `diamond_attendance_days` | 2회 | CC카지노 출석부 체크 기준 |
| 3 | `d3` | 플래티넘 금고 해금 | `platinum_status` | `CLAIMED` | 선행 조건 |

#### 선행 조건
- 플래티넘 금고 해금 (`platinum_status === 'CLAIMED'`)

---

## 3. 상수 정의

### 3.1 보상액 (Reward Amounts)
```python
VAULT_REWARDS = {
    "GOLD": 10_000,       # 1만원
    "PLATINUM": 30_000,   # 3만원
    "DIAMOND": 300_000,   # 30만원
    "BONUS": 0,           # 완성 보너스 (추후 정의)
}
```

### 3.2 마감기한 (Expiry Hours)
```python
VAULT_EXPIRY_HOURS = {
    "GOLD": 72,           # 3일
    "PLATINUM": 72,       # 3일
    "DIAMOND": 120,       # 5일 ⚠️ 다이아만 다름
}

DEFAULT_EXPIRY_HOURS = 72  # 기본값 (골드/플래티넘)
```

### 3.3 해금 조건 목표값 (Unlock Thresholds)
```python
UNLOCK_THRESHOLDS = {
    "PLATINUM": {
        "deposit_total": 200_000,   # 누적 입금 20만원
        "deposit_count": 3,          # 입금 3회
    },
    "DIAMOND": {
        "deposit_total": 2_000_000,  # 누적 충전 200만원
        "attendance_days": 2,        # 출석 2회
    },
}
```

### 3.4 색상 테마 (Color Schemes)
```javascript
const VAULT_COLORS = {
  gold: {
    primary: '#FFD700',
    secondary: '#FFA500',
    gradient: 'from-yellow-400 to-amber-500',
  },
  platinum: {
    primary: '#E5E4E2',
    secondary: '#C0C0C0',
    gradient: 'from-gray-300 to-slate-400',
  },
  diamond: {
    primary: '#B9F2FF',
    secondary: '#00CED1',
    gradient: 'from-cyan-300 to-blue-500',
  },
};
```

---

## 4. DB 필드 매핑

### 4.1 vault_status 테이블 (변경 필요)

| 기존 필드 | 변경 후 필드 | 용도 |
|----------|-------------|------|
| `platinum_attendance_days` | `platinum_deposit_count` | 플래티넘 입금 횟수 |
| `platinum_deposit_done` (BOOLEAN) | `platinum_deposit_total` (INT) | 플래티넘 누적 입금액 |
| `diamond_deposit_current` | `diamond_deposit_total` | 다이아 누적 충전액 |
| (신규) | `diamond_attendance_days` | 다이아 출석 횟수 |
| (신규) | `diamond_expires_at` | 다이아 별도 마감기한 |

### 4.2 마이그레이션 필요 사항
```sql
-- 플래티넘 관련
ALTER TABLE vault_status ADD COLUMN platinum_deposit_total INT DEFAULT 0;
ALTER TABLE vault_status ADD COLUMN platinum_deposit_count INT DEFAULT 0;

-- 다이아 관련
ALTER TABLE vault_status RENAME COLUMN diamond_deposit_current TO diamond_deposit_total;
ALTER TABLE vault_status ADD COLUMN diamond_attendance_days INT DEFAULT 0;
ALTER TABLE vault_status ADD COLUMN diamond_expires_at TIMESTAMPTZ;
```

---

## 5. API 응답 필드 (변경)

### 5.1 GET /api/vault/status 응답
```json
{
  "gold_status": "LOCKED|UNLOCKED|CLAIMED|EXPIRED",
  "platinum_status": "LOCKED|UNLOCKED|CLAIMED|EXPIRED",
  "diamond_status": "LOCKED|UNLOCKED|CLAIMED|EXPIRED",
  
  "telegram_ok": true,
  
  "platinum_deposit_total": 150000,
  "platinum_deposit_count": 2,
  
  "diamond_deposit_total": 500000,
  "diamond_attendance_days": 1,
  
  "expires_at": "2026-01-12T00:00:00Z",
  "diamond_expires_at": "2026-01-14T00:00:00Z",
  
  "loss_total": 340000,
  "loss_breakdown": {
    "GOLD": 10000,
    "PLATINUM": 30000,
    "DIAMOND": 300000,
    "BONUS": 0
  }
}
```

---

## 6. 프론트엔드 와이어프레임 매핑

### 6.1 사진 참고 (첨부된 이미지)

| 금고 | 진행률 표시 | 소멸타임 표시 | 미션 표시 |
|------|------------|--------------|----------|
| 골드 | O | X | O |
| 플래티넘 | O (누적입금) | O | O |
| 다이아 | O (누적충전) | O | O |

---

## 7. Changelog

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| v3.0 | 2026-01-09 | 골드/플래티넘/다이아 조건 전면 개편 |
| v2.1 | 2026-01-09 | 플래티넘 보상 30,000원 적용 |
| v2.0 | 2025-12-20 | 초기 버전 |

---

## 8. 참조 파일

- Backend SOT: `backend/app/constants/vault_config.py`
- Frontend SOT: `frontend/lib/vaultConfig.js`
- DB 마이그레이션: `docs/DB_MIGRATION_V3.sql`
- API 스펙: `docs/API_SPEC_VAULT_V2.md` (업데이트 필요)
