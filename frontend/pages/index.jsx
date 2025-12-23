import Head from 'next/head';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';

/* ─── Figma Assets ─── */
const ICON_STAR = 'https://www.figma.com/api/mcp/asset/a121fe05-b028-4a40-a525-9af8852b220d';
const ICON_GAME = 'https://www.figma.com/api/mcp/asset/8625e6d9-bea3-4dd6-9416-86f0f54cb37c';
const ICON_TELEGRAM = 'https://www.figma.com/api/mcp/asset/01bcbc61-1f54-4542-8ffb-a7d7bdd11c9c';

/* ─── Design Tokens (from Figma) ─── */
const TOKENS = {
  bg: '#000000',
  accent1: '#D2FD9C',
  accent2: '#282D1A',
  accent3: '#394508',
  textWhite: '#FFFFFF',
  textSub: '#CBCBCB',
  textBlack: '#000000',
};

export default function Home() {
  const [externalUserId, setExternalUserId] = useState('');
  const [userNickname, setUserNickname] = useState('');

  // 로그아웃 처리
  const handleLogout = () => {
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  useEffect(() => {
    // URL 쿼리 파라미터 확인
    const params = new URLSearchParams(window.location.search);
    const extUserId = params.get('external_user_id');
    
    // 또는 localStorage에서 로그인 정보 확인
    const storedUser = localStorage.getItem('user');
    
    if (extUserId) {
      setExternalUserId(extUserId);
    } else if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setExternalUserId(user.external_user_id || '');
        setUserNickname(user.nickname || '');
      } catch (e) {
        console.error('Failed to parse user data', e);
      }
    } else {
      // 로그인 안 되어 있으면 로그인 페이지로
      window.location.href = '/login';
    }
  }, []);

  return (
    <>
      <Head>
        <title>CC Casino - 신규회원 전용금고</title>
      </Head>

      <div style={styles.page} className="page">
        {/* ─── Sidebar Container ─── */}
        <aside style={styles.sidebar} className="sidebar">
          {/* Nav */}
          <nav style={styles.nav}>
            <div style={styles.logo}>
              <img src={ICON_STAR} alt="CC Casino" style={styles.logoIcon} />
              <span style={styles.logoText} className="cc-logoText">CC CASINO</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {userNickname && (
                <span style={{ fontSize: '12px', color: TOKENS.textSub }}>
                  {userNickname}님
                </span>
              )}
              <button
                onClick={handleLogout}
                style={{
                  ...styles.navButton,
                  background: 'linear-gradient(120deg, rgba(210,253,156,0.2), rgba(210,253,156,0.05))',
                  border: '1px solid rgba(210,253,156,0.6)',
                  color: TOKENS.accent1,
                  boxShadow: '0 10px 24px rgba(0,0,0,0.35)',
                  cursor: 'pointer'
                }}
                className="cc-navButton"
              >
                로그아웃
              </button>
              <Link href="/guide" style={styles.navButton} className="cc-navButton">금고 가이드</Link>
            </div>
          </nav>

          {/* Header */}
          <div style={styles.header}>
            <h1 style={styles.title} className="title cc-title">
              <span style={{ color: TOKENS.textWhite }}>씨씨카지노</span>
              <br />
              <span style={{ color: TOKENS.accent1 }}>신규회원 전용금고</span>
            </h1>
            <p style={styles.address} className="cc-address">평생주소 : 씨씨주소.COM</p>
          </div>

          {/* Game Links */}
          <div style={styles.offerings}>
            <h3 style={styles.offeringsTitle} className="cc-offeringsTitle">게임 바로가기</h3>
            <div style={styles.modules} className="modules">
              <a href="https://ccc-001.com" target="_blank" rel="noreferrer" style={styles.navCard} className="nav-card">
                <img src={ICON_GAME} alt="" style={styles.navCardIcon} />
                <div style={styles.navCardText} className="cc-navCardText">
                  <span>CC카지노</span>
                  <span>바로가기</span>
                </div>
              </a>
              <a href="https://t.me/+IE0NYpuze_k1YWZk" target="_blank" rel="noreferrer" style={styles.navCard} className="nav-card">
                <img src={ICON_TELEGRAM} alt="" style={styles.navCardIcon} />
                <div style={styles.navCardText} className="cc-navCardText">
                  <span>CC카지노</span>
                  <span>텔레공식채널</span>
                </div>
              </a>
            </div>
          </div>
        </aside>

        {/* ─── Main Content ─── */}
        <main style={styles.main} className="main">
          <VaultChallenge />
        </main>

        {/* ─── Footer ─── */}
        <footer style={styles.footer} className="footer">
          <div style={styles.footerContent}>
            <p style={styles.contactTitle}>Contact</p>
            <div style={styles.contactLinks}>
              <a href="https://t.me/CCCS1009" target="_blank" rel="noreferrer">CC고객센터 텔레그램</a>
              <a href="https://ccc-001.com" target="_blank" rel="noreferrer">CC카지노 바로가기</a>
              <a href="https://t.me/+IE0NYpuze_k1YWZk" target="_blank" rel="noreferrer">CC카지노 공식 텔레채널</a>
            </div>
          </div>
        </footer>
      </div>

      <style jsx global>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #__next { height: 100%; }
        body {
          background: ${TOKENS.bg};
          color: ${TOKENS.textWhite};
          font-family: 'Noto Sans KR', sans-serif;
        }
        a { text-decoration: none; color: inherit; }
        @media (max-width: 1024px) {
          .page { display: flex !important; flex-direction: column !important; }
          .sidebar { position: relative !important; width: 100% !important; max-width: 760px !important; margin: 0 auto; padding: 20px !important; gap: 20px !important; left: 0 !important; }
          .main { position: relative !important; width: 100% !important; max-width: 760px !important; margin: 0 auto; left: 0 !important; right: 0 !important; top: 0 !important; bottom: 0 !important; }
          .footer { position: relative !important; width: 100% !important; max-width: 760px !important; margin: 0 auto; left: 0 !important; bottom: 0 !important; }
          .modules { flex-wrap: wrap; }
          .nav-card { width: 121px !important; height: 85px !important; padding: 14px 10px !important; }

          /* Sidebar becomes App Header */
          .sidebar { order: 0; }
          .main { order: 1; }
          .footer { order: 2; }

          /* Responsive typography */
          .cc-title { font-size: 34px !important; font-weight: 600 !important; }
          .cc-address { font-size: 14px !important; }
          .cc-logoText { font-size: 18px !important; }
          .cc-offeringsTitle { font-size: 18px !important; }
          .cc-navCardText { font-size: 16px !important; font-weight: 600 !important; }
        }
        @media (max-width: 640px) {
          .sidebar { max-width: 100% !important; padding: 10px 16px !important; }
          .cc-title { font-size: 28px !important; font-weight: 700 !important; }
          .cc-address { font-size: 12px !important; }
          .cc-logoText { font-size: 16px !important; }
          .cc-navButton { padding: 10px 12px !important; font-size: 10px !important; }
          .cc-offeringsTitle { font-size: 16px !important; }
          .cc-navCardText { font-size: 18px !important; font-weight: 700 !important; }
          .nav-card { width: 157px !important; height: 99px !important; }
          .footer { height: 144px !important; padding: 20px !important; }
        }
      `}</style>
    </>
  );
}

function VaultChallenge({ animationIntensity = 1, showTimer = true, showCompletionBonus = true }) {
  const [selectedVault, setSelectedVault] = useState('gold-vault');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const COUNTUP_SLOW_MS = 4500;

  const useCountUp = (targetValue, { durationMs = COUNTUP_SLOW_MS } = {}) => {
    const [displayValue, setDisplayValue] = useState(0);
    const rafRef = useRef(0);
    const lastTargetRef = useRef(null);

    useEffect(() => {
      const nextTarget = Number.isFinite(Number(targetValue)) ? Number(targetValue) : 0;
      if (lastTargetRef.current === nextTarget) return;
      lastTargetRef.current = nextTarget;

      const from = displayValue;
      const to = Math.max(0, nextTarget);
      const start = performance.now();

      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      const tick = (now) => {
        const t = Math.min(1, (now - start) / Math.max(1, durationMs));
        // Ease-out for finance-style count-up.
        const eased = 1 - Math.pow(1 - t, 3);
        const current = Math.round(from + (to - from) * eased);
        setDisplayValue(current);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        }
      };

      rafRef.current = requestAnimationFrame(tick);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetValue, durationMs]);

    return displayValue;
  };

  const [serverClock, setServerClock] = useState({
    fetchedAtMs: 0,
    serverNowMs: 0,
    expiresAtMs: 0,
  });

  const apiFetch = useCallback(async (path, options = {}) => {
    const res = await fetch(path, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });

    const contentType = res.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await res.json() : null;

    if (!res.ok) {
      const code = payload?.error?.code || payload?.detail || String(res.status);
      const rawMessage = payload?.error?.message || payload?.detail || '요청에 실패했습니다.';

      const messageMap = {
        ALREADY_ATTENDED: '오늘은 이미 출석 체크가 완료되어 있어요.',
        ALREADY_CLAIMED: '이미 수령한 금고예요.',
        NOT_CLAIMABLE: '아직 수령할 수 없는 상태예요.',
        VARIANT_NOT_FOUND: '알림 변형 ID가 허용 목록에 없어요.',
        EMPTY_USER_IDS: '대상 아이디가 비어 있어요.',
      };
      const message = messageMap[code] || rawMessage;
      const err = new Error(message);
      err.code = code;
      throw err;
    }

    return payload;
  }, []);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // URL 쿼리 파라미터 또는 localStorage에서 external_user_id 가져오기
      const params = new URLSearchParams(window.location.search);
      const extUserId = params.get('external_user_id') || 
        (localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).external_user_id : null);
      
      const endpoint = extUserId 
        ? `/api/vault/status/?external_user_id=${encodeURIComponent(extUserId)}`
        : '/api/vault/status/';
      
      const data = await apiFetch(endpoint);
      setStatus(data);

      const serverNowMs = data?.now ? Date.parse(data.now) : Date.now();
      const expiresAtMs = data?.expires_at ? Date.parse(data.expires_at) : 0;
      setServerClock({
        fetchedAtMs: Date.now(),
        serverNowMs,
        expiresAtMs,
      });
    } catch (e) {
      setError(e?.message || '상태 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const timeRemaining = useMemo(() => {
    if (!serverClock.expiresAtMs || !serverClock.serverNowMs || !serverClock.fetchedAtMs) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, remainingMs: 0 };
    }

    const clientElapsed = Date.now() - serverClock.fetchedAtMs;
    const currentServerNow = serverClock.serverNowMs + Math.max(0, clientElapsed);
    const remainingMs = Math.max(0, serverClock.expiresAtMs - currentServerNow);

    const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remainingMs / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((remainingMs / (1000 * 60)) % 60);
    const seconds = Math.floor((remainingMs / 1000) % 60);

    return { days, hours, minutes, seconds, remainingMs };
  }, [serverClock]);

  // 1초마다 리렌더(카운트다운 갱신)
  useEffect(() => {
    if (!serverClock.expiresAtMs) return;
    const t = setInterval(() => {
      setServerClock((v) => ({ ...v }));
    }, 1000);
    return () => clearInterval(t);
  }, [serverClock.expiresAtMs]);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0,
    }).format(amount);

  function RewardBadge({ amount, colorScheme, shouldAnimate = false }) {
    const animated = useCountUp(shouldAnimate ? amount : 0, { durationMs: COUNTUP_SLOW_MS });
    const displayAmount = shouldAnimate ? animated : amount;
    return (
      <div className="relative flex justify-center w-full -mt-4 z-10">
        <div
          className={`px-6 py-1.5 rounded-full border ${colorScheme.border} ${colorScheme.bgActive} flex items-center
            shadow-[0_4px_12px_rgba(0,0,0,0.6)] backdrop-blur-sm relative overflow-hidden
            before:absolute before:inset-0 before:w-[200%] before:h-full before:animate-shimmer ${colorScheme.shimmer}`}
          aria-label={`보상 금액 ${formatCurrency(amount)}`}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="mr-2 flex-shrink-0"
            style={{ filter: `drop-shadow(0 0 2px ${colorScheme.iconColor})` }}
          >
            <path d="M12 6v12M6 12h12" stroke={colorScheme.iconColor} strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className={`text-base font-bold ${colorScheme.textPrimary} drop-shadow-[0_0_4px_rgba(255,255,255,0.6)]`}>
            {formatCurrency(displayAmount)}
          </span>
        </div>
      </div>
    );
  }

  const mapApiStatusToUi = (apiStatus) => {
    switch (apiStatus) {
      case 'UNLOCKED':
        return 'available';
      case 'CLAIMED':
        return 'opened';
      case 'EXPIRED':
      case 'LOCKED':
      default:
        return 'locked';
    }
  };

  const vaults = useMemo(() => {
    const api = status || {};
    const attendanceDays = Number(api.platinum_attendance_days || 0);
    const reviewDone = Boolean(api.platinum_review_done);
    const diamondDeposit = Number(api.diamond_deposit_current || 0);
    const diamondTarget = 500000;
    const diamondProgress = Math.max(0, Math.min(100, Math.floor((diamondDeposit / diamondTarget) * 100)));

    return [
      {
        id: 'gold-vault',
        tier: 'gold',
        rewardAmount: 10000,
        status: mapApiStatusToUi(api.gold_status),
        missions: [
          {
            id: 'g1',
            label: 'CC카지노 텔레공식채널 입장 확인',
            isDone: api.gold_status !== 'LOCKED',
            hint: '입장 기록은 텔레그램 CSV 업로드 후 다음날 반영됩니다.',
          },
          {
            id: 'g2',
            label: '담당실장 텔레공식채널 입장 확인',
            isDone: api.gold_status !== 'LOCKED',
            hint: '담당실장 채널 입장도 CSV 확인 후 다음날 반영됩니다.',
          },
          { id: 'g3', label: '수령 가능 시 금고 열기', isDone: api.gold_status === 'UNLOCKED' || api.gold_status === 'CLAIMED' },
          { id: 'g4', label: '수령 완료', isDone: api.gold_status === 'CLAIMED' },
        ],
      },
      {
        id: 'platinum-vault',
        tier: 'platinum',
        rewardAmount: 20000,
        status: mapApiStatusToUi(api.platinum_status),
        expiresAt: api.expires_at ? Date.parse(api.expires_at) : undefined,
        missions: [
          { id: 'p1', label: '연속 3일 달성 (일별 5만원 이상)', isDone: attendanceDays >= 3, hint: `현재 ${Math.min(3, attendanceDays)}/3 · 하루라도 건너뛰면 1일부터 다시` },
          { id: 'p2', label: `리뷰 작성 ${reviewDone ? '1' : '0'}/1`, isDone: reviewDone, hint: '리뷰 1회 작성 확인이 필요해요' },
          { id: 'p3', label: '플래티넘 금고 해금', isDone: api.platinum_status === 'UNLOCKED' || api.platinum_status === 'CLAIMED' },
          { id: 'p4', label: '수령 완료', isDone: api.platinum_status === 'CLAIMED' },
        ],
        meta: { attendanceDays, reviewDone },
      },
      {
        id: 'diamond-vault',
        tier: 'diamond',
        rewardAmount: 100000,
        status: mapApiStatusToUi(api.diamond_status),
        progress: Number.isFinite(diamondProgress) ? diamondProgress : 0,
        missions: [
          { id: 'd1', label: '누적 충전 500,000원 달성', isDone: diamondDeposit >= diamondTarget, hint: `현재 ${formatCurrency(diamondDeposit)}` },
          { id: 'd2', label: '다이아 금고 해금', isDone: api.diamond_status === 'UNLOCKED' || api.diamond_status === 'CLAIMED' },
          { id: 'd3', label: '수령 완료', isDone: api.diamond_status === 'CLAIMED' },
        ],
      },
    ];
  }, [status]);

  const getCompletedVaults = useCallback(() => vaults.filter((v) => v.status === 'opened').length, [vaults]);

  const handleVaultSelect = (vaultId) => {
    setSelectedVault(vaultId);
    setNotice('');
  };

  const claimVault = useCallback(
    async (tier) => {
      setNotice('');
      setError('');
      try {
        // URL 쿼리 파라미터 또는 localStorage에서 external_user_id 가져오기
        const params = new URLSearchParams(window.location.search);
        const extUserId = params.get('external_user_id') || 
          (localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).external_user_id : null);
        
        const vaultType = tier.toUpperCase();
        const endpoint = extUserId
          ? `/api/vault/claim/?external_user_id=${encodeURIComponent(extUserId)}`
          : '/api/vault/claim/';
        
        const res = await apiFetch(endpoint, {
          method: 'POST',
          body: JSON.stringify({ vault_type: vaultType }),
        });
        if (res?.claimed) {
          setNotice(`${vaultType} 금고 수령 완료`);
        } else {
          setNotice('요청이 처리되었습니다.');
        }
        await refreshStatus();
      } catch (e) {
        setError(e?.message || '수령 처리에 실패했습니다.');
      }
    },
    [apiFetch, refreshStatus]
  );

  // NOTE: 플래티넘 연속일수는 어드민 업로드(입금 데이터)로 자동 반영됩니다.
  // 유저가 버튼을 눌러 “출석 체크”를 찍는 플로우는 사용하지 않습니다.

  const getVaultColorScheme = (tier) => {
    switch (tier) {
      case 'gold':
        return {
          bgActive: 'bg-gradient-to-b from-[#394508] to-[#212b01]',
          bgHeader: 'bg-gradient-to-b from-[#212b01] to-[#161c01]',
          bgInactive: 'bg-[#161c01]',
          border: 'border-[#D2FD9C]',
          textPrimary: 'text-[#D2FD9C]',
          textSecondary: 'text-[#D2FD9C]/80',
          iconColor: '#D2FD9C',
          iconGlow: '0 0 20px rgba(210, 253, 156, 0.6)',
          buttonBg: 'bg-gradient-to-r from-[#394508] to-[#4A5A0A]',
          buttonHover: 'hover:from-[#4A5A0A] hover:to-[#5A6A1A]',
          buttonDisabled: 'bg-[#282D1A]/50',
          gradientFrom: 'from-[#394508]',
          gradientTo: 'to-[#D2FD9C]/30',
          shimmer: 'before:bg-gradient-to-r before:from-transparent before:via-[#D2FD9C]/10 before:to-transparent',
          progressBg: 'bg-gradient-to-r from-[#D2FD9C]/80 to-[#394508]',
        };
      case 'platinum':
        return {
          bgActive: 'bg-gradient-to-b from-[#075a28] to-[#053d1b]',
          bgHeader: 'bg-gradient-to-b from-[#053d1b] to-[#032210]',
          bgInactive: 'bg-[#032210]',
          border: 'border-[#07AF4D]',
          textPrimary: 'text-[#07AF4D]',
          textSecondary: 'text-[#07AF4D]/80',
          iconColor: '#07AF4D',
          iconGlow: '0 0 20px rgba(7, 175, 77, 0.6)',
          buttonBg: 'bg-gradient-to-r from-[#075a28] to-[#07AF4D]',
          buttonHover: 'hover:from-[#07AF4D] hover:to-[#06C355]',
          buttonDisabled: 'bg-[#032210]/50',
          gradientFrom: 'from-[#075a28]',
          gradientTo: 'to-[#07AF4D]/30',
          shimmer: 'before:bg-gradient-to-r before:from-transparent before:via-[#07AF4D]/10 before:to-transparent',
          progressBg: 'bg-gradient-to-r from-[#07AF4D]/80 to-[#075a28]',
        };
      case 'diamond':
        return {
          bgActive: 'bg-gradient-to-b from-[#0A7C65] to-[#065446]',
          bgHeader: 'bg-gradient-to-b from-[#065446] to-[#032C26]',
          bgInactive: 'bg-[#032C26]',
          border: 'border-[#0AA787]',
          textPrimary: 'text-[#0AA787]',
          textSecondary: 'text-[#0AA787]/80',
          iconColor: '#0AA787',
          iconGlow: '0 0 20px rgba(10, 167, 135, 0.6)',
          buttonBg: 'bg-gradient-to-r from-[#0A7C65] to-[#0AA787]',
          buttonHover: 'hover:from-[#0AA787] hover:to-[#0CC39F]',
          buttonDisabled: 'bg-[#032C26]/50',
          gradientFrom: 'from-[#0A7C65]',
          gradientTo: 'to-[#0AA787]/30',
          shimmer: 'before:bg-gradient-to-r before:from-transparent before:via-[#0AA787]/10 before:to-transparent',
          progressBg: 'bg-gradient-to-r from-[#0AA787]/80 to-[#0A7C65]',
        };
      default:
        return {
          bgActive: 'bg-gradient-to-b from-[#394508] to-[#212b01]',
          bgHeader: 'bg-gradient-to-b from-[#212b01] to-[#161c01]',
          bgInactive: 'bg-[#161c01]',
          border: 'border-[#D2FD9C]',
          textPrimary: 'text-[#D2FD9C]',
          textSecondary: 'text-[#D2FD9C]/80',
          iconColor: '#D2FD9C',
          iconGlow: '0 0 20px rgba(210, 253, 156, 0.6)',
          buttonBg: 'bg-gradient-to-r from-[#394508] to-[#4A5A0A]',
          buttonHover: 'hover:from-[#4A5A0A] hover:to-[#5A6A1A]',
          buttonDisabled: 'bg-[#282D1A]/50',
          gradientFrom: 'from-[#394508]',
          gradientTo: 'to-[#D2FD9C]/30',
          shimmer: 'before:bg-gradient-to-r before:from-transparent before:via-[#D2FD9C]/10 before:to-transparent',
          progressBg: 'bg-gradient-to-r from-[#D2FD9C]/80 to-[#394508]',
        };
    }
  };

  const getVaultIcon = (tier) => {
    const iconStyle = {
      filter: `drop-shadow(${tier === 'gold'
        ? '0 0 8px rgba(210, 253, 156, 0.5)'
        : tier === 'platinum'
          ? '0 0 8px rgba(7, 175, 77, 0.5)'
          : '0 0 8px rgba(10, 167, 135, 0.5)'
      })`,
    };

    switch (tier) {
      case 'gold':
        return (
          <div style={iconStyle}>
            <svg width="72" height="72" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFE259" />
                  <stop offset="100%" stopColor="#D2FD9C" />
                </linearGradient>
                <filter id="goldGlow">
                  <feGaussianBlur stdDeviation="1.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <rect x="8" y="16" width="48" height="36" rx="4" stroke="url(#goldGradient)" strokeWidth="2" filter="url(#goldGlow)" />
              <circle cx="32" cy="34" r="8" stroke="url(#goldGradient)" strokeWidth="2" filter="url(#goldGlow)" />
              <path d="M28 12H36V20H28V12Z" stroke="url(#goldGradient)" strokeWidth="2" filter="url(#goldGlow)" />
              <path d="M32 34V38" stroke="url(#goldGradient)" strokeWidth="2" strokeLinecap="round" filter="url(#goldGlow)" />
              <path d="M26 28L32 34L38 28" stroke="url(#goldGradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" filter="url(#goldGlow)" />
              <path d="M16 20L16 48" stroke="url(#goldGradient)" strokeWidth="2" filter="url(#goldGlow)" />
              <path d="M48 20L48 48" stroke="url(#goldGradient)" strokeWidth="2" filter="url(#goldGlow)" />
            </svg>
          </div>
        );
      case 'platinum':
        return (
          <div style={iconStyle}>
            <svg width="72" height="72" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="platinumGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#07AF4D" />
                  <stop offset="100%" stopColor="#09DF63" />
                </linearGradient>
                <filter id="platinumGlow">
                  <feGaussianBlur stdDeviation="1.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <rect x="8" y="16" width="48" height="36" rx="4" stroke="url(#platinumGradient)" strokeWidth="2" filter="url(#platinumGlow)" />
              <circle cx="32" cy="34" r="8" stroke="url(#platinumGradient)" strokeWidth="2" filter="url(#platinumGlow)" />
              <path d="M28 12H36V20H28V12Z" stroke="url(#platinumGradient)" strokeWidth="2" filter="url(#platinumGlow)" />
              <path d="M32 34V38" stroke="url(#platinumGradient)" strokeWidth="2" strokeLinecap="round" filter="url(#platinumGlow)" />
              <path d="M26 28L32 34L38 28" stroke="url(#platinumGradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" filter="url(#platinumGlow)" />
              <rect x="20" y="22" width="24" height="2" rx="1" fill="url(#platinumGradient)" filter="url(#platinumGlow)" />
              <rect x="20" y="26" width="24" height="2" rx="1" fill="url(#platinumGradient)" filter="url(#platinumGlow)" />
            </svg>
          </div>
        );
      case 'diamond':
        return (
          <div style={iconStyle}>
            <svg width="72" height="72" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="diamondGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0AA787" />
                  <stop offset="100%" stopColor="#0DD8AC" />
                </linearGradient>
                <filter id="diamondGlow">
                  <feGaussianBlur stdDeviation="1.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <rect x="8" y="16" width="48" height="36" rx="4" stroke="url(#diamondGradient)" strokeWidth="2" filter="url(#diamondGlow)" />
              <circle cx="32" cy="34" r="8" stroke="url(#diamondGradient)" strokeWidth="2" filter="url(#diamondGlow)" />
              <path d="M28 12H36V20H28V12Z" stroke="url(#diamondGradient)" strokeWidth="2" filter="url(#diamondGlow)" />
              <path d="M32 34V38" stroke="url(#diamondGradient)" strokeWidth="2" strokeLinecap="round" filter="url(#diamondGlow)" />
              <path d="M26 28L32 34L38 28" stroke="url(#diamondGradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" filter="url(#diamondGlow)" />
              <path d="M24 34L32 42L40 34L32 26L24 34Z" stroke="url(#diamondGradient)" strokeWidth="2" filter="url(#diamondGlow)" />
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  const selected = vaults.find((v) => v.id === selectedVault) || vaults[0];

  const animatedLossTotal = useCountUp(Number(status?.loss_total || 0), { durationMs: COUNTUP_SLOW_MS });

  const socialProofText = '';

  return (
    <div
      className="min-h-full text-white p-4 md:p-6 lg:p-8"
      style={{
        backgroundImage: 'radial-gradient(circle at center, #0A0A0A 0%, #050505 70%, #030303 100%)',
        backgroundAttachment: 'fixed',
      }}
    >
      {(error || notice) && (
        <div className="max-w-5xl mx-auto mb-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-200 px-4 py-3 rounded-lg mb-2">
              {error}
            </div>
          )}
          {notice && (
            <div className="bg-white/5 border border-white/10 text-white/90 px-4 py-3 rounded-lg">
              {notice}
            </div>
          )}
        </div>
      )}

      <div className="mb-10 md:mb-12 text-center relative">
        <motion.h1
          className="text-3xl md:text-5xl font-bold mb-3 relative inline-block"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <span className="absolute -right-4 -bottom-4 w-10 h-10 opacity-40">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="#D2FD9C" strokeWidth="0.5" strokeDasharray="2 2" />
            </svg>
          </span>

          <span className="bg-gradient-to-r from-[#FFE259] via-[#D2FD9C] to-white bg-clip-text text-transparent relative z-10">
            미션 금고 챌린지
            <motion.span
              className="absolute -right-8 -top-8 text-[#F97935] text-sm font-normal"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, duration: 0.3 }}
            >
              NEW
            </motion.span>
          </span>

          <motion.div
            className="absolute left-1/4 right-1/4 h-0.5 bottom-0 bg-gradient-to-r from-transparent via-[#D2FD9C] to-transparent"
            initial={{ width: 0, left: '50%' }}
            animate={{ width: '70%', left: '15%' }}
            transition={{ delay: 0.5, duration: 0.5 }}
          />
        </motion.h1>

        <motion.div
          className="flex items-center justify-center mt-4 gap-2 flex-wrap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          {showTimer && (
            <div className="bg-black/50 backdrop-blur-md px-4 py-1.5 rounded-full flex items-center border border-[#F97935]/30">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-[#F97935]" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-[#F97935] font-medium">
                이벤트 종료까지 {timeRemaining.days}일 {timeRemaining.hours}시간 {timeRemaining.minutes}분
              </span>
            </div>
          )}
          <div className="bg-black/50 backdrop-blur-md px-4 py-1.5 rounded-full border border-[#07AF4D]/30">
            <span className="text-[#07AF4D] font-medium">LIMITED EVENT</span>
          </div>

          {status?.loss_total ? (
            <div className="bg-black/50 backdrop-blur-md px-4 py-1.5 rounded-full border border-[#F97935]/30">
              <span className="text-[#F97935] font-medium">지금 포기하면 {formatCurrency(animatedLossTotal)} 소멸</span>
            </div>
          ) : null}

          {socialProofText ? (
            <div className="bg-black/50 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10">
              <span className="text-white/80 font-medium">{socialProofText}</span>
            </div>
          ) : null}

          <button
            className="bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-1.5 rounded-full text-sm"
            onClick={refreshStatus}
            disabled={loading}
          >
            {loading ? '로딩...' : '새로고침'}
          </button>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-10">
        {vaults.map((vault, index) => {
          const colorScheme = getVaultColorScheme(vault.tier);
          const isSelected = selectedVault === vault.id;
          const completedMissions = vault.missions.filter((m) => m.isDone).length;

          const isAvailable = vault.status === 'available';
          const isLocked = vault.status === 'locked';
          const isOpened = vault.status === 'opened';

          const buttonEnabled = isAvailable;
          const buttonLabel = isAvailable
            ? `${vault.tier === 'gold' ? '황금' : vault.tier === 'platinum' ? '플래티넘' : '다이아'} 금고 열기`
            : isOpened
              ? '완료됨'
              : '조건 자동 반영 중';

          return (
            <motion.div
              key={vault.id}
              className={`relative overflow-hidden rounded-2xl ${
                isSelected ? `border-2 ${colorScheme.border}` : 'border border-gray-800'
              } bg-black/80 transition-all duration-300 h-full flex flex-col backdrop-blur-sm shadow-[0_10px_30px_rgba(0,0,0,0.5)]`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 * index, duration: 0.5 }}
              whileHover={{
                boxShadow: `0 14px 40px rgba(0,0,0,0.7), 0 0 20px rgba(255,255,255,0.06)`,
                y: -5 * animationIntensity,
                borderColor: colorScheme.iconColor,
                transition: { duration: 0.3 },
              }}
              onClick={() => handleVaultSelect(vault.id)}
            >
              {isAvailable && (
                <motion.div
                  className="absolute top-0 right-0 z-10 overflow-hidden"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + 0.2 * index, duration: 0.3, type: 'spring' }}
                >
                  <div className={`${colorScheme.buttonBg} w-20 h-20 rotate-45 -translate-y-10 translate-x-10 flex items-center justify-center`} />
                </motion.div>
              )}

              <div className={`${colorScheme.bgHeader} px-4 pt-6 pb-8 flex flex-col items-center relative`}>
                <div className="mb-2 w-full flex justify-center">
                  <div
                    className={`${colorScheme.bgActive} px-4 py-1 rounded-full border ${colorScheme.border} text-xs uppercase tracking-wider font-bold ${colorScheme.textPrimary} inline-block shadow-md`}
                  >
                    {vault.tier === 'gold' ? 'GOLD' : vault.tier === 'platinum' ? 'PLATINUM' : 'DIAMOND'}
                  </div>
                </div>

                <div className="flex items-center mb-5">
                  <h3 className={`text-xl font-bold text-center ${colorScheme.textPrimary}`}>
                    {vault.tier === 'gold' ? '골드' : vault.tier === 'platinum' ? '플래티넘' : '다이아'} 금고
                  </h3>
                </div>

                <motion.div
                  className="mb-6 relative"
                  initial={{ y: 0 }}
                  animate={{ y: [0, -5, 0] }}
                  transition={{ y: { duration: 2, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' } }}
                >
                  {getVaultIcon(vault.tier)}

                  <motion.div
                    className={`absolute -bottom-3 left-1/2 transform -translate-x-1/2 px-3 py-1 rounded-full flex items-center justify-center ${
                      isLocked
                        ? 'bg-gradient-to-r from-[#F97935] to-[#FF5500] border border-[#FF5500]/50'
                        : isAvailable
                          ? 'bg-gradient-to-r from-[#07AF4D] to-[#06C355] border border-[#06C355]/50'
                          : 'bg-gradient-to-r from-[#5D5D5D] to-[#7D7D7D] border border-[#7D7D7D]/50'
                    }`}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + 0.2 * index, duration: 0.2, type: 'spring' }}
                  >
                    <span className="text-xs font-bold text-white">{isLocked ? 'LOCKED' : isAvailable ? 'AVAILABLE' : 'COMPLETED'}</span>
                  </motion.div>
                </motion.div>

                <RewardBadge 
                  amount={vault.rewardAmount} 
                  colorScheme={colorScheme} 
                  shouldAnimate={vault.status === 'available'}
                />
              </div>

              {vault.progress !== undefined && (
                <div className="px-4 pt-6">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className={`${colorScheme.textSecondary} font-medium`}>진행률</span>
                    <span className="text-white font-bold">{vault.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-800/50 rounded-full h-2 backdrop-blur-sm p-0.5 mb-4">
                    <motion.div
                      initial={{ width: '0%' }}
                      animate={{ width: `${vault.progress}%` }}
                      transition={{ duration: 1.5, ease: 'easeOut' }}
                      className={`h-full rounded-full ${colorScheme.progressBg} relative`}
                    />
                  </div>
                </div>
              )}

              {vault.tier === 'platinum' && vault.expiresAt && showTimer && (
                <div className="px-4 pb-2">
                  <div className="bg-[#F97935]/10 border border-[#F97935]/30 rounded-lg px-3 py-2 flex items-center mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-[#F97935]" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-sm font-medium text-[#F97935]">
                      {timeRemaining.hours}시간 {timeRemaining.minutes}분 후 소멸
                    </span>
                  </div>
                </div>
              )}

              {vault.tier === 'platinum' && (
                null
              )}

              <div className="p-4 flex-grow">
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="text-sm font-medium text-white/90">미션 체크리스트</h4>
                  <div className="bg-black/30 px-2 py-0.5 rounded border border-gray-700/50 backdrop-blur-sm">
                    <span className="text-sm font-bold text-white">
                      {completedMissions}/{vault.missions.length}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {vault.missions.map((mission, missionIndex) => (
                    <motion.div
                      key={mission.id}
                      className="flex items-start bg-black/20 backdrop-blur-sm p-2.5 rounded-lg border border-gray-800/70"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + 0.1 * missionIndex, duration: 0.3 }}
                    >
                      <div
                        className={`flex-shrink-0 w-5 h-5 rounded-full ${
                          mission.isDone ? `${colorScheme.buttonBg} border border-white/20` : 'bg-gray-800 border border-gray-600'
                        } flex items-center justify-center mr-3 mt-0.5`}
                      >
                        {mission.isDone && (
                          <motion.svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3 w-3 text-white"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </motion.svg>
                        )}
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${mission.isDone ? 'text-white' : 'text-gray-400'}`}>{mission.label}</p>
                        {mission.hint && <p className="text-xs text-gray-500 mt-1 italic">{mission.hint}</p>}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="p-4 pt-2">
                <motion.button
                  whileHover={buttonEnabled ? { scale: 1.02 * animationIntensity } : {}}
                  whileTap={buttonEnabled ? { scale: 0.98 * animationIntensity } : {}}
                  className={`w-full py-3.5 rounded-xl font-bold text-white transition-all duration-200 ${
                    buttonEnabled ? `${colorScheme.buttonBg} ${colorScheme.buttonHover} shadow-lg` : `${colorScheme.buttonDisabled} border border-gray-800`
                  } relative overflow-hidden group`}
                  disabled={!buttonEnabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isAvailable) return claimVault(vault.tier);
                  }}
                >
                  {buttonEnabled && (
                    <motion.span
                      className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      animate={{ x: ['-100%', '100%'] }}
                      transition={{ duration: 2, repeat: Infinity, repeatDelay: 5 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center justify-center">{buttonLabel}</span>
                </motion.button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {showCompletionBonus && (
        <motion.div
          className="relative overflow-hidden rounded-2xl p-8 mt-8 max-w-3xl mx-auto"
          style={{
            background: 'linear-gradient(135deg, rgba(10,10,10,0.9) 0%, rgba(20,30,10,0.8) 100%)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 30px rgba(210, 253, 156, 0.1)',
            borderImage: 'linear-gradient(to right, rgba(7,175,77,0.4), rgba(210,253,156,0.5)) 1',
            borderWidth: '1px',
            borderStyle: 'solid',
          }}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <div className="flex justify-between text-sm mb-2 font-medium relative z-10">
            <span className="text-white/80">진행도</span>
            <span className="text-white">{getCompletedVaults()}/3</span>
          </div>
          <div className="w-full h-4 bg-black/40 rounded-full p-1 backdrop-blur-sm border border-gray-800/50 relative z-10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#F97935] to-[#07AF4D]"
              style={{ width: `${(getCompletedVaults() / 3) * 100}%` }}
              initial={{ width: 0 }}
              animate={{ width: `${(getCompletedVaults() / 3) * 100}%` }}
              transition={{ duration: 1 }}
            />
          </div>
          <motion.button
            whileHover={getCompletedVaults() === 3 ? { scale: 1.02 * animationIntensity } : {}}
            whileTap={getCompletedVaults() === 3 ? { scale: 0.98 * animationIntensity } : {}}
            className={`w-full py-4 rounded-xl font-bold text-white text-lg relative overflow-hidden mt-6 ${
              getCompletedVaults() === 3
                ? 'bg-gradient-to-r from-[#07AF4D] to-[#0AA787] shadow-lg shadow-[#07AF4D]/20 border border-[#07AF4D]/50'
                : 'bg-gray-800/80 border border-gray-700 backdrop-blur-sm'
            }`}
            disabled={getCompletedVaults() < 3}
          >
            <span className="relative z-10 flex items-center justify-center">
              {getCompletedVaults() === 3 ? '보너스 받기' : '챌린지 진행 중...'}
            </span>
          </motion.button>
        </motion.div>
      )}

      <div className="text-center text-gray-600 text-xs mt-8">
        <p>© 2025 CC Casino - 이용 약관 적용</p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    position: 'relative',
    width: '100%',
    minHeight: '100vh',
    background: TOKENS.bg,
  },

  /* ─── Sidebar ─── */
  sidebar: {
    position: 'absolute',
    left: 8,
    top: 0,
    width: 345,
    display: 'flex',
    flexDirection: 'column',
    gap: 49,
    padding: '20px 5px',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    height: 33,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    width: 184,
  },
  logoIcon: {
    width: 26,
    height: 27,
    borderRadius: 18,
    objectFit: 'cover',
  },
  logoText: {
    fontFamily: "'IBM Plex Sans', sans-serif",
    fontWeight: 600,
    fontSize: 20,
    letterSpacing: -0.4,
    color: TOKENS.textWhite,
    textTransform: 'capitalize',
  },
  navButton: {
    background: TOKENS.accent1,
    color: TOKENS.textBlack,
    padding: '11px 14px',
    borderRadius: 2,
    fontFamily: "'IBM Plex Sans KR', sans-serif",
    fontSize: 10,
    cursor: 'pointer',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  title: {
    fontFamily: "'Noto Sans KR', sans-serif",
    fontWeight: 500,
    fontSize: 42,
    lineHeight: 1.06,
    letterSpacing: -0.84,
    textTransform: 'capitalize',
  },
  address: {
    fontFamily: "'Noto Sans KR', sans-serif",
    fontWeight: 400,
    fontSize: 16,
    lineHeight: 1.09,
    color: TOKENS.textSub,
  },
  offerings: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    width: '100%',
  },
  offeringsTitle: {
    fontFamily: "'Noto Sans KR', sans-serif",
    fontWeight: 500,
    fontSize: 20,
    lineHeight: 1.15,
    color: TOKENS.accent1,
  },
  modules: {
    display: 'flex',
    gap: 10,
  },
  navCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    width: 163,
    height: 107,
    padding: '20px 10px',
    background: TOKENS.accent1,
    borderRadius: 4,
    cursor: 'pointer',
  },
  navCardIcon: {
    width: 30,
    height: 30,
  },
  navCardText: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    fontFamily: "'Noto Sans KR', sans-serif",
    fontWeight: 500,
    fontSize: 20,
    lineHeight: 1.15,
    color: TOKENS.textBlack,
    textAlign: 'center',
  },

  /* ─── Footer ─── */
  footer: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: 356,
    height: 222,
    background: TOKENS.accent2,
    display: 'flex',
    alignItems: 'flex-end',
    padding: '31px 20px',
  },
  footerContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  contactTitle: {
    fontFamily: "'Noto Sans KR', sans-serif",
    fontWeight: 500,
    fontSize: 20,
    lineHeight: 1.15,
    color: TOKENS.accent1,
  },
  contactLinks: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    fontFamily: "'Noto Sans KR', sans-serif",
    fontWeight: 500,
    fontSize: 20,
    lineHeight: 1.15,
    color: TOKENS.accent1,
  },

  /* ─── Main ─── */
  main: {
    position: 'absolute',
    top: -14,
    right: 10,
    bottom: 0,
    left: 362,
    overflowX: 'hidden',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
};

