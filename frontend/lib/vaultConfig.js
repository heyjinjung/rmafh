/**
 * Vault System Configuration - Source of Truth (SOT)
 * ==================================================
 * ⚠️ 이 파일이 금고 시스템의 유일한 진실 공급원(SOT)입니다.
 * 금고 관련 상수 변경 시 이 파일만 수정하세요.
 *
 * Version: 3.0
 * Last Updated: 2026-01-09
 * Documentation: docs/VAULT_SOT.md
 */

// =============================================================================
// 1. 보상액 (Reward Amounts)
// =============================================================================

export const VAULT_REWARDS = {
  GOLD: 10_000,        // 1만원
  PLATINUM: 30_000,    // 3만원
  DIAMOND: 300_000,    // 30만원 (변경: 기존 70,000원)
  BONUS: 0,            // 완성 보너스 (추후 정의)
};

// =============================================================================
// 2. 마감기한 (Expiry Hours)
// =============================================================================

export const VAULT_EXPIRY_HOURS = {
  GOLD: 72,            // 3일
  PLATINUM: 72,        // 3일
  DIAMOND: 120,        // 5일 (변경: 기존 72시간)
};

export const DEFAULT_EXPIRY_HOURS = 72;

// =============================================================================
// 3. 해금 조건 목표값 (Unlock Thresholds)
// =============================================================================

export const PLATINUM_UNLOCK = {
  depositTotal: 200_000,    // 누적 입금 20만원
  depositCount: 3,          // 입금 3회
};

export const DIAMOND_UNLOCK = {
  depositTotal: 2_000_000,  // 누적 충전 200만원
  attendanceDays: 2,        // 출석 2회
};

// =============================================================================
// 4. 색상 테마 (Color Schemes)
// =============================================================================

export const VAULT_COLORS = {
  gold: {
    primary: '#FFD700',
    secondary: '#FFA500',
    gradient: 'from-yellow-400 to-amber-500',
    bgGradient: 'bg-gradient-to-br from-yellow-400 to-amber-500',
    textColor: 'text-yellow-900',
    borderColor: 'border-yellow-500',
  },
  platinum: {
    primary: '#E5E4E2',
    secondary: '#C0C0C0',
    gradient: 'from-gray-300 to-slate-400',
    bgGradient: 'bg-gradient-to-br from-gray-300 to-slate-400',
    textColor: 'text-gray-900',
    borderColor: 'border-gray-400',
  },
  diamond: {
    primary: '#B9F2FF',
    secondary: '#00CED1',
    gradient: 'from-cyan-300 to-blue-500',
    bgGradient: 'bg-gradient-to-br from-cyan-300 to-blue-500',
    textColor: 'text-blue-900',
    borderColor: 'border-cyan-400',
  },
};

// =============================================================================
// 5. 미션 생성 함수
// =============================================================================

/**
 * 골드 금고 미션 생성
 * - g1: telegram_ok에서 자동 (CSV -> gold_mission_1_done)
 * - g2/g3: 어드민 토글 (UI 표시용)
 * - 골드 해금은 telegram_ok만 충족하면 UNLOCKED
 * @param {Object} api - API 응답 데이터
 */
export function createGoldMissions(api) {
  return [
    {
      id: 'g1',
      label: 'CC카지노 공식채널 입장',
      hint: '각종 이벤트 및 보너스 드랍 진행',
      isDone: Boolean(api.gold_mission_1_done ?? api.telegram_ok),  // CSV에서 자동
      source: 'csv',
    },
    {
      id: 'g2',
      label: '담당실장 공식채널 입장',
      hint: '본사혜택 외 추가 이벤트 진행',
      isDone: Boolean(api.gold_mission_2_done),  // 어드민 토글 (UI 표시용)
      source: 'admin',
    },
    {
      id: 'g3',
      label: '간편 본인확인',
      hint: '담당실장에게 본인 확인',
      isDone: Boolean(api.gold_mission_3_done),  // 어드민 토글 (UI 표시용)
      source: 'admin',
    },
    {
      id: 'g4',
      label: '수령 완료',
      isDone: api.gold_status === 'CLAIMED',
    },
  ];
}

// 골드 해금 조건: telegram_ok만 충족하면 해금
export function checkGoldUnlock(api) {
  return Boolean(api.telegram_ok);
}

/**
 * 플래티넘 금고 미션 생성 (어드민 토글)
 * @param {Object} api - API 응답 데이터
 */
export function createPlatinumMissions(api) {
  const goldClaimed = api.gold_status === 'CLAIMED';

  return [
    {
      id: 'p1',
      label: '누적 입금 20만원 달성',
      hint: '신규 입플도 놓치지 마세요!',
      isDone: Boolean(api.platinum_mission_1_done),
      source: 'admin',
    },
    {
      id: 'p2',
      label: '누적 입금 3회 달성',
      hint: '최소 이용 금액 단돈 만원 이상!',
      isDone: Boolean(api.platinum_mission_2_done),
      source: 'admin',
    },
    {
      id: 'p3',
      label: '출석 3일 달성',
      hint: '매일 출석 체크!',
      isDone: Boolean(api.platinum_mission_3_done),
      source: 'admin',
    },
    {
      id: 'p4',
      label: '리뷰 작성 완료',
      hint: '솔직한 리뷰 부탁드립니다!',
      isDone: Boolean(api.platinum_mission_4_done),
      source: 'admin',
    },
    {
      id: 'p5',
      label: '골드 금고 해금',
      hint: '선행 조건',
      isDone: goldClaimed,
      source: 'auto',
    },
    {
      id: 'p6',
      label: '수령 완료',
      isDone: api.platinum_status === 'CLAIMED',
    },
  ];
}

/**
 * 다이아 금고 미션 생성 (어드민 토글)
 * @param {Object} api - API 응답 데이터
 */
export function createDiamondMissions(api) {
  const platinumClaimed = api.platinum_status === 'CLAIMED';

  return [
    {
      id: 'd1',
      label: '누적 충전 200만원 달성',
      hint: `현재 ${formatCurrency(api.diamond_deposit_total || 0)}`,
      isDone: Boolean(api.diamond_mission_1_done),
      source: 'admin',
    },
    {
      id: 'd2',
      label: 'CC카지노 2회 출석',
      hint: 'CC카지노 출석부 체크 기준',
      isDone: Boolean(api.diamond_mission_2_done),
      source: 'admin',
    },
    {
      id: 'd3',
      label: '플래티넘 금고 해금',
      hint: '선행 조건',
      isDone: platinumClaimed,
      source: 'auto',
    },
    {
      id: 'd4',
      label: '수령 완료',
      isDone: api.diamond_status === 'CLAIMED',
    },
  ];
}

// =============================================================================
// 6. 헬퍼 함수
// =============================================================================

/**
 * 금액 포맷팅 (한국어)
 * @param {number} amount 
 */
export function formatCurrency(amount) {
  if (amount >= 10000) {
    const man = Math.floor(amount / 10000);
    const remainder = amount % 10000;
    if (remainder === 0) {
      return `${man}만원`;
    }
    return `${man}만 ${remainder.toLocaleString()}원`;
  }
  return `${amount.toLocaleString()}원`;
}

/**
 * 금고 티어별 보상액 조회
 * @param {string} tier 
 */
export function getReward(tier) {
  return VAULT_REWARDS[tier.toUpperCase()] || 0;
}

/**
 * 금고 티어별 마감시간(시간) 조회
 * @param {string} tier 
 */
export function getExpiryHours(tier) {
  return VAULT_EXPIRY_HOURS[tier.toUpperCase()] || DEFAULT_EXPIRY_HOURS;
}

/**
 * 플래티넘 금고 해금 조건 검증
 */
export function checkPlatinumUnlock(depositTotal, depositCount, goldClaimed) {
  return (
    depositTotal >= PLATINUM_UNLOCK.depositTotal &&
    depositCount >= PLATINUM_UNLOCK.depositCount &&
    goldClaimed
  );
}

/**
 * 다이아 금고 해금 조건 검증
 */
export function checkDiamondUnlock(depositTotal, attendanceDays, platinumClaimed) {
  return (
    depositTotal >= DIAMOND_UNLOCK.depositTotal &&
    attendanceDays >= DIAMOND_UNLOCK.attendanceDays &&
    platinumClaimed
  );
}

/**
 * 손실 시뮬레이터용 금액 breakdown 계산
 */
export function calculateLossBreakdown(goldStatus, platinumStatus, diamondStatus) {
  const breakdown = {
    GOLD: ['CLAIMED', 'EXPIRED'].includes(goldStatus) ? 0 : VAULT_REWARDS.GOLD,
    PLATINUM: ['CLAIMED', 'EXPIRED'].includes(platinumStatus) ? 0 : VAULT_REWARDS.PLATINUM,
    DIAMOND: ['CLAIMED', 'EXPIRED'].includes(diamondStatus) ? 0 : VAULT_REWARDS.DIAMOND,
    BONUS: 0,
  };
  return breakdown;
}

// =============================================================================
// 7. 금고 데이터 생성 함수 (통합)
// =============================================================================

/**
 * API 응답으로부터 전체 금고 데이터 생성
 * @param {Object} api - API 응답 데이터
 */
export function createVaultsFromApi(api) {
  if (!api) return [];

  const mapApiStatusToUi = (apiStatus) => {
    if (apiStatus === 'CLAIMED') return 'opened';
    if (apiStatus === 'UNLOCKED') return 'unlocked';
    if (apiStatus === 'EXPIRED') return 'expired';
    return 'locked';
  };

  const goldMissions = createGoldMissions(api);
  const goldProgress = Math.floor((goldMissions.filter(m => m.isDone).length / goldMissions.length) * 100);

  const platinumProgress = Math.max(
    0,
    Math.min(100, Math.floor(((api.platinum_deposit_total || 0) / PLATINUM_UNLOCK.depositTotal) * 100))
  );

  const diamondDepositTotal = api.diamond_deposit_total || api.diamond_deposit_current || 0;
  const diamondProgress = Math.max(
    0,
    Math.min(100, Math.floor((diamondDepositTotal / DIAMOND_UNLOCK.depositTotal) * 100))
  );

  return [
    {
      id: 'gold-vault',
      tier: 'gold',
      rewardAmount: VAULT_REWARDS.GOLD,
      status: mapApiStatusToUi(api.gold_status),
      progress: goldProgress,
      missions: goldMissions,
      colorScheme: VAULT_COLORS.gold,
    },
    {
      id: 'platinum-vault',
      tier: 'platinum',
      rewardAmount: VAULT_REWARDS.PLATINUM,
      status: mapApiStatusToUi(api.platinum_status),
      expiresAt: api.expires_at ? Date.parse(api.expires_at) : undefined,
      progress: platinumProgress,
      missions: createPlatinumMissions(api),
      meta: {
        depositTotal: api.platinum_deposit_total || 0,
        depositCount: api.platinum_deposit_count || 0,
      },
      colorScheme: VAULT_COLORS.platinum,
    },
    {
      id: 'diamond-vault',
      tier: 'diamond',
      rewardAmount: VAULT_REWARDS.DIAMOND,
      status: mapApiStatusToUi(api.diamond_status),
      expiresAt: api.diamond_expires_at
        ? Date.parse(api.diamond_expires_at)
        : api.expires_at
          ? Date.parse(api.expires_at)
          : undefined,
      progress: Number.isFinite(diamondProgress) ? diamondProgress : 0,
      missions: createDiamondMissions(api),
      meta: {
        depositTotal: diamondDepositTotal,
        attendanceDays: api.diamond_attendance_days || 0,
      },
      colorScheme: VAULT_COLORS.diamond,
    },
  ];
}

// =============================================================================
// 8. 버전 정보
// =============================================================================

export const VERSION = '3.0.0';
export const UPDATED = '2026-01-09';
