import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { VAULT_REWARDS, VAULT_EXPIRY_HOURS, DIAMOND_UNLOCK, createVaultsFromApi } from '../lib/vaultConfig';

/* ─── Figma Assets ─── */
const ICON_STAR = '/logo.png';
const ICON_GAME = '/logo.png';
const ICON_TELEGRAM = '/telegram.png';

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
  const router = useRouter();
  const basePath = router.basePath || '';
  const [externalUserId, setExternalUserId] = useState('');
  const [userNickname, setUserNickname] = useState('');

  // 로그아웃 처리
  const handleLogout = () => {
    localStorage.removeItem('user');
    window.location.href = `${basePath}/login`;
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
      window.location.href = `${basePath}/login`;
    }
  }, [basePath]);

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
              <Image src={ICON_STAR} alt="CC Casino" width={26} height={27} style={styles.logoIcon} priority />
              <span style={styles.logoText} className="cc-logoText">CC CASINO</span>
            </div>
          </nav>

          {/* Header */}
          <div style={styles.header}>
            <h1 style={styles.title} className="title cc-title">
              <span style={{ color: '#D2FD9C' }}>씨씨카지노</span>
              <br />
              <span style={{ color: '#FFFFFF' }}>신규회원 전용금고</span>
            </h1>
            <p style={styles.address} className="cc-address">평생주소 : 씨씨주소.COM</p>
          </div>

          {/* User Info (New Position) */}
          <div className="flex items-center justify-between mb-2">
            {userNickname && (
              <span className="text-sm font-bold text-white tracking-wide">
                {userNickname} <span className="text-[#394508] font-normal text-xs ml-1 bg-[#D2FD9C] px-1.5 rounded-sm">Player</span>
              </span>
            )}
            <button
              onClick={handleLogout}
              className="text-[11px] text-[#ff5555] border border-[#ff5555]/30 hover:bg-[#ff5555]/10 px-2 py-1 rounded transition-colors"
            >
              로그아웃
            </button>
          </div>

          {/* CTA Buttons (Square & Stylish) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', width: '100%' }}>
            {/* CC Casino CTA */}
            <a
              href="https://ccc-001.com"
              target="_blank"
              rel="noreferrer"
              className="group relative flex flex-col items-center justify-center aspect-square bg-[#051a10] border border-[#0f3d24] transition-all duration-300 overflow-hidden hover:border-[#D2FD9C]/50"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#D2FD9C]/0 via-[#D2FD9C]/0 to-[#D2FD9C]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                className="mb-3 text-3xl"
              >
                🎰
              </motion.div>
              <span className="relative z-10 text-[#D2FD9C] font-bold text-sm tracking-wide group-hover:text-white transition-colors">
                CASINO
              </span>
              <span className="relative z-10 text-[#ffffff]/40 text-[10px] mt-1 group-hover:text-[#ffffff]/80 transition-colors uppercase tracking-[0.2em]">
                Go to Game
              </span>
            </a>

            {/* Telegram CTA */}
            <a
              href="https://t.me/+IE0NYpuze_k1YWZk"
              target="_blank"
              rel="noreferrer"
              className="group relative flex flex-col items-center justify-center aspect-square bg-[#051a10] border border-[#0f3d24] transition-all duration-300 overflow-hidden hover:border-[#D2FD9C]/50"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#D2FD9C]/0 via-[#D2FD9C]/0 to-[#D2FD9C]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <motion.div
                whileHover={{ scale: 1.1, y: -2 }}
                className="mb-3 text-3xl"
              >
                📢
              </motion.div>
              <span className="relative z-10 text-[#D2FD9C] font-bold text-sm tracking-wide group-hover:text-white transition-colors">
                NOTICE
              </span>
              <span className="relative z-10 text-[#ffffff]/40 text-[10px] mt-1 group-hover:text-[#ffffff]/80 transition-colors uppercase tracking-[0.2em]">
                Channel
              </span>
            </a>
          </div>
        </aside>

        {/* ─── Main Content ─── */}
        <main style={styles.main} className="main">
          <VaultChallenge basePath={basePath} />
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
          .modules { flex-wrap: wrap; justify-content: center; }
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

function VaultChallenge({ animationIntensity = 1, showTimer = true, basePath = '' }) {
  const [selectedVault, setSelectedVault] = useState('gold-vault');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // 골드→플래티넘 해금 직후 토스트 노출 제어
  const [showPlatinumUnlockedToast, setShowPlatinumUnlockedToast] = useState(false);
  const prevStatusRef = useRef();

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
        ? `${basePath}/api/vault/status/?external_user_id=${encodeURIComponent(extUserId)}`
        : `${basePath}/api/vault/status/`;

      const data = await apiFetch(endpoint);
      // 골드→플래티넘 해금 직후 토스트 노출 로직
      const prev = prevStatusRef.current;
      if (
        prev &&
        (prev.gold_status === 'CLAIMED' || prev.gold_status === 'UNLOCKED') &&
        prev.platinum_status !== 'UNLOCKED' &&
        data.platinum_status === 'UNLOCKED'
      ) {
        setShowPlatinumUnlockedToast(true);
        // 3초 후 자동 숨김
        setTimeout(() => setShowPlatinumUnlockedToast(false), 3000);
      }
      prevStatusRef.current = data;
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
  }, [apiFetch, basePath]);

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

  function RewardBadge({ amount, colorScheme }) {
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
            {formatCurrency(amount)}
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
        return 'expired';
      case 'LOCKED':
      default:
        return 'locked';
    }
  };

  const vaults = useMemo(() => {
    return createVaultsFromApi(status);
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
          ? `${basePath}/api/vault/claim/?external_user_id=${encodeURIComponent(extUserId)}`
          : `${basePath}/api/vault/claim/`;

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
    [apiFetch, refreshStatus, basePath]
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
          bgActive: 'bg-gradient-to-b from-[#008F8F] to-[#006666]',
          bgHeader: 'bg-gradient-to-b from-[#006666] to-[#003333]',
          bgInactive: 'bg-[#003333]',
          border: 'border-transparent', // Clean: No border
          textPrimary: 'text-[#00E0FF]',
          textSecondary: 'text-[#00E0FF]/80',
          iconColor: '#00E0FF',
          iconGlow: 'none', // Clean: No glow
          buttonBg: 'bg-gradient-to-r from-[#008F8F] to-[#00E0FF]',
          buttonHover: 'hover:from-[#00E0FF] hover:to-[#33Eaff]',
          buttonDisabled: 'bg-[#003333]/50',
          gradientFrom: 'from-[#008F8F]',
          gradientTo: 'to-[#00E0FF]/30',
          shimmer: 'before:hidden', // Clean: No shimmer
          progressBg: 'bg-gradient-to-r from-[#00E0FF]/80 to-[#008F8F]',
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
                  <stop offset="0%" stopColor="#00E0FF" />
                  <stop offset="100%" stopColor="#33EAFF" />
                </linearGradient>
              </defs>
              <rect x="8" y="16" width="48" height="36" rx="4" stroke="url(#diamondGradient)" strokeWidth="2" />
              <circle cx="32" cy="34" r="8" stroke="url(#diamondGradient)" strokeWidth="2" />
              <path d="M28 12H36V20H28V12Z" stroke="url(#diamondGradient)" strokeWidth="2" />
              <path d="M32 34V38" stroke="url(#diamondGradient)" strokeWidth="2" strokeLinecap="round" />
              <path d="M26 28L32 34L38 28" stroke="url(#diamondGradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M24 34L32 42L40 34L32 26L24 34Z" stroke="url(#diamondGradient)" strokeWidth="2" />
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  const selected = vaults.find((v) => v.id === selectedVault) || vaults[0];

  const lossTotal = Number(status?.loss_total || 0);

  const socialProofText = '';

  return (
    <div
      className="min-h-full text-white p-4 md:p-6 lg:p-8"
      style={{
        backgroundColor: '#020b07', // Clean Flat Deep Green
        backgroundAttachment: 'fixed',
      }}
    >
      {/* 골드→플래티넘 해금 토스트 */}
      {showPlatinumUnlockedToast && (
        <div className="fixed top-8 left-1/2 z-50 -translate-x-1/2 bg-[#07AF4D] text-white px-6 py-3 rounded-xl shadow-lg border border-[#07AF4D]/40 animate-fade-in-out text-base font-semibold">
          플래티넘 금고가 열렸어요! 미션을 확인해보세요.
        </div>
      )}
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

          <div className="bg-black/50 backdrop-blur-md px-4 py-1.5 rounded-full border border-[#F97935]/30">
            <span className="text-[#F97935] font-medium">최소 34만원 이사지원 혜택</span>
          </div>

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
          const isExpired = vault.status === 'expired';

          const buttonEnabled = isAvailable;
          const buttonLabel = isAvailable
            ? `${vault.tier === 'gold' ? '황금' : vault.tier === 'platinum' ? '플래티넘' : '다이아'} 금고 열기`
            : isOpened
              ? '수령완료'
              : isExpired
                ? '만료됨'
                : '잠금 상태';

          return (
            <motion.div
              key={vault.id}
              className={`relative overflow-hidden rounded-2xl border-transparent bg-white/[0.03] transition-all duration-300 h-full flex flex-col backdrop-blur-sm`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 * index, duration: 0.5 }}
              whileHover={{
                y: -5 * animationIntensity,
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

                <div className="mb-6 flex items-center justify-center gap-3">
                  <motion.div
                    initial={{ y: 0 }}
                    animate={{ y: [0, -5, 0] }}
                    transition={{ y: { duration: 2, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' } }}
                  >
                    {getVaultIcon(vault.tier)}
                  </motion.div>

                  <motion.div
                    className={`px-3 py-1 rounded-full flex items-center justify-center ${isLocked
                      ? 'bg-gradient-to-r from-[#F97935] to-[#FF5500] border border-[#FF5500]/50'
                      : isAvailable
                        ? 'bg-gradient-to-r from-[#07AF4D] to-[#06C355] border border-[#06C355]/50'
                        : 'bg-gradient-to-r from-[#5D5D5D] to-[#7D7D7D] border border-[#7D7D7D]/50'
                      }`}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + 0.2 * index, duration: 0.2, type: 'spring' }}
                  >
                    <span className="text-xs font-bold text-white whitespace-nowrap">
                      {isLocked ? '잠금 상태' : isAvailable ? '해제됨' : isExpired ? '만료됨' : '수령완료'}
                    </span>
                  </motion.div>
                </div>

                <RewardBadge amount={vault.rewardAmount} colorScheme={colorScheme} />
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

              {(vault.tier === 'platinum' || vault.tier === 'diamond') && vault.expiresAt && showTimer && (
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
                      {timeRemaining.days > 0
                        ? `${timeRemaining.days}일 ${timeRemaining.hours}시간 ${timeRemaining.minutes}분 후 소멸`
                        : `${timeRemaining.hours}시간 ${timeRemaining.minutes}분 후 소멸`}
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
                        className={`flex-shrink-0 w-5 h-5 rounded-full ${mission.isDone ? `${colorScheme.buttonBg} border border-white/20` : 'bg-gray-800 border border-gray-600'
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
                  className={`w-full py-3.5 rounded-xl font-bold text-white transition-all duration-200 ${buttonEnabled ? `${colorScheme.buttonBg} ${colorScheme.buttonHover} shadow-lg` : `${colorScheme.buttonDisabled} border border-gray-800`
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
    gap: 24,
    padding: '24px 12px 24px 20px',
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

  /* ─── 사이드바 안내 문구 (v3) ─── */
  sidebarNotice: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: '16px',
    background: 'linear-gradient(135deg, rgba(40,45,26,0.9), rgba(57,69,8,0.7))',
    borderRadius: 8,
    border: '1px solid rgba(210,253,156,0.3)',
  },
  noticeItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  noticeLabel: {
    fontFamily: "'Noto Sans KR', sans-serif",
    fontWeight: 600,
    fontSize: 12,
    color: TOKENS.accent1,
    letterSpacing: 0.5,
  },
  noticeText: {
    fontFamily: "'Noto Sans KR', sans-serif",
    fontWeight: 400,
    fontSize: 13,
    color: TOKENS.textSub,
    lineHeight: 1.4,
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

