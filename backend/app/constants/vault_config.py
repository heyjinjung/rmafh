"""
Vault System Configuration - Source of Truth (SOT)
==================================================
⚠️ 이 파일이 금고 시스템의 유일한 진실 공급원(SOT)입니다.
금고 관련 상수 변경 시 이 파일만 수정하세요.

Version: 3.0
Last Updated: 2026-01-09
Documentation: docs/VAULT_SOT.md
"""

from enum import Enum
from typing import TypedDict

# =============================================================================
# 1. ENUMS
# =============================================================================

class VaultTier(str, Enum):
    """금고 티어 정의"""
    GOLD = "GOLD"
    PLATINUM = "PLATINUM"
    DIAMOND = "DIAMOND"


class VaultStatus(str, Enum):
    """금고 상태 정의"""
    LOCKED = "LOCKED"
    UNLOCKED = "UNLOCKED"
    CLAIMED = "CLAIMED"
    EXPIRED = "EXPIRED"


# =============================================================================
# 2. 보상액 (Reward Amounts)
# =============================================================================

VAULT_REWARDS: dict[str, int] = {
    "GOLD": 10_000,        # 1만원
    "PLATINUM": 30_000,    # 3만원
    "DIAMOND": 300_000,    # 30만원 (변경: 기존 70,000원)
    "BONUS": 0,            # 완성 보너스 (추후 정의)
}

# =============================================================================
# 3. 마감기한 (Expiry Hours)
# =============================================================================

VAULT_EXPIRY_HOURS: dict[str, int] = {
    "GOLD": 72,            # 3일
    "PLATINUM": 72,        # 3일
    "DIAMOND": 120,        # 5일 (변경: 기존 72시간)
}

DEFAULT_EXPIRY_HOURS: int = 72  # 기본값


# =============================================================================
# 4. 해금 조건 목표값 (Unlock Thresholds)
# =============================================================================

class PlatinumThresholds(TypedDict):
    deposit_total: int      # 누적 입금액
    deposit_count: int      # 입금 횟수


class DiamondThresholds(TypedDict):
    deposit_total: int      # 누적 충전액
    attendance_days: int    # 출석 횟수


PLATINUM_UNLOCK: PlatinumThresholds = {
    "deposit_total": 200_000,    # 누적 입금 20만원
    "deposit_count": 3,           # 입금 3회
}

DIAMOND_UNLOCK: DiamondThresholds = {
    "deposit_total": 2_000_000,   # 누적 충전 200만원
    "attendance_days": 2,         # 출석 2회
}


# =============================================================================
# 5. 미션 정의 (Mission Definitions)
# =============================================================================

# Gold 미션 정의
# - Mission 1: CSV telegram_ok 필드로 자동 설정 (gold_mission_1_done = telegram_ok)
# - Mission 2/3: 어드민 토글로만 설정 (UI 표시용)
# - 골드 해금 조건: telegram_ok만 충족하면 UNLOCKED
GOLD_MISSIONS = [
    {
        "id": "g1",
        "label": "CC카지노 공식채널 입장",
        "hint": "각종 이벤트 및 보너스 드랍 진행",
        "field": "gold_mission_1_done",  # = telegram_ok (CSV에서 자동)
        "source": "csv",  # telegram_ok 필드와 연동
    },
    {
        "id": "g2",
        "label": "담당실장 공식채널 입장",
        "hint": "본사혜택 외 추가 이벤트 진행",
        "field": "gold_mission_2_done",
        "source": "admin",  # 어드민 토글만 (외부 연동 불가)
    },
    {
        "id": "g3",
        "label": "간편 본인확인",
        "hint": "담당실장에게 본인 확인",
        "field": "gold_mission_3_done",
        "source": "admin",  # 어드민 수동 확인
    },
]

# 골드 해금 조건: telegram_ok만 충족하면 해금 (Mission 2/3는 UI 표시용)
GOLD_UNLOCK_FIELD = "telegram_ok"

PLATINUM_MISSIONS = [
    {
        "id": "p1",
        "label": "누적 입금 20만원 달성",
        "hint": "신규 입플도 놓치지 마세요!",
        "field": "platinum_deposit_total",
        "target": PLATINUM_UNLOCK["deposit_total"],
    },
    {
        "id": "p2",
        "label": "누적 입금 3회 달성",
        "hint": "최소 이용 금액 단돈 만원 이상!",
        "field": "platinum_deposit_count",
        "target": PLATINUM_UNLOCK["deposit_count"],
    },
    {
        "id": "p3",
        "label": "골드 금고 해금",
        "hint": "선행 조건",
        "field": "gold_claimed",
    },
]

DIAMOND_MISSIONS = [
    {
        "id": "d1",
        "label": "누적 충전 200만원 달성",
        "hint": "현재 {amount}",
        "field": "diamond_deposit_total",
        "target": DIAMOND_UNLOCK["deposit_total"],
    },
    {
        "id": "d2",
        "label": "CC카지노 2회 출석",
        "hint": "CC카지노 출석부 체크 기준",
        "field": "diamond_attendance_days",
        "target": DIAMOND_UNLOCK["attendance_days"],
    },
    {
        "id": "d3",
        "label": "플래티넘 금고 해금",
        "hint": "선행 조건",
        "field": "platinum_claimed",
    },
]


# =============================================================================
# 6. 헬퍼 함수
# =============================================================================

def get_reward(tier: str) -> int:
    """금고 티어별 보상액 조회"""
    return VAULT_REWARDS.get(tier.upper(), 0)


def get_expiry_hours(tier: str) -> int:
    """금고 티어별 마감시간(시간) 조회"""
    return VAULT_EXPIRY_HOURS.get(tier.upper(), DEFAULT_EXPIRY_HOURS)


def check_gold_unlock(telegram_ok: bool) -> bool:
    """골드 금고 해금 조건 검증 - telegram_ok만 충족하면 해금"""
    return telegram_ok


def check_platinum_unlock(deposit_total: int, deposit_count: int, gold_claimed: bool) -> bool:
    """플래티넘 금고 해금 조건 검증"""
    return (
        deposit_total >= PLATINUM_UNLOCK["deposit_total"]
        and deposit_count >= PLATINUM_UNLOCK["deposit_count"]
        and gold_claimed
    )


def check_diamond_unlock(
    deposit_total: int, 
    attendance_days: int, 
    platinum_claimed: bool
) -> bool:
    """다이아 금고 해금 조건 검증"""
    return (
        deposit_total >= DIAMOND_UNLOCK["deposit_total"]
        and attendance_days >= DIAMOND_UNLOCK["attendance_days"]
        and platinum_claimed
    )


def calculate_loss_breakdown(
    gold_status: str,
    platinum_status: str,
    diamond_status: str,
) -> dict[str, int]:
    """손실 시뮬레이터용 금액 breakdown 계산"""
    status_map = {
        "GOLD": gold_status,
        "PLATINUM": platinum_status,
        "DIAMOND": diamond_status,
    }
    breakdown = {}
    for tier, status in status_map.items():
        if status in ("CLAIMED", "EXPIRED"):
            breakdown[tier] = 0
        else:
            breakdown[tier] = VAULT_REWARDS[tier]
    breakdown["BONUS"] = 0
    return breakdown


# =============================================================================
# 7. 버전 정보
# =============================================================================

__version__ = "3.0.0"
__updated__ = "2026-01-09"
