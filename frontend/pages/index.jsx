import Head from 'next/head';
import { useEffect, useMemo, useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:18000';

const TOKENS = {
  bg: '#050505',
  gold: '#D2FD9C',
  plat: '#07AF4D',
  dia: '#0AA787',
  warn: '#F97935',
  cardRadius: '20px',
};

// Figma-exported sidebar assets; kept as fallbacks even if local public assets exist.
const ICON_STAR = 'https://www.figma.com/api/mcp/asset/88186290-496e-4e20-a601-68137fc278c3';
const ICON_GAME = 'https://www.figma.com/api/mcp/asset/a53ebd26-90e4-46a6-a31d-17a19e5d5fb0';
const ICON_TELEGRAM = 'https://www.figma.com/api/mcp/asset/e793fae6-8696-4a1e-9096-142f7788e10d';

const STATUS_LABEL = {
  LOCKED: '보관 중',
  UNLOCKED: '해금 가능',
  CLAIMED: '수령 완료',
  EXPIRED: '소멸됨',
};

export default function Home() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const fetchStatus = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${apiBase}/api/vault/status`);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const body = await res.json();
        if (active) {
          setData(body);
          setError('');
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'failed');
          setData(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchStatus();
    const id = setInterval(fetchStatus, 30000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const cards = useMemo(() => {
    if (!data) return [];
    return [
      {
        type: 'GOLD',
        reward: 10000,
        status: data.gold_status,
        progressLabel: 'CC/공지 채널 2개',
        progressValue: data.gold_status === 'CLAIMED' ? 1 : 0,
        progressMax: 1,
        expiresAt: data.expires_at,
      },
      {
        type: 'PLATINUM',
        reward: 30000,
        status: data.platinum_status,
        progressLabel: '출석 3회 + 단일 50,000',
        progressValue: data.platinum_attendance_days + (data.platinum_deposit_done ? 1 : 0),
        progressMax: 4,
        expiresAt: data.expires_at,
      },
      {
        type: 'DIAMOND',
        reward: 100000,
        status: data.diamond_status,
        progressLabel: '누적 500,000',
        progressValue: Math.min(data.diamond_deposit_current || 0, 500000),
        progressMax: 500000,
        expiresAt: data.expires_at,
      },
    ];
  }, [data]);

  const lossTotal = data?.loss_total || 0;
  const urgentMs = data?.ms_countdown?.enabled ? data.ms_countdown.remaining_ms : null;

  return (
    <>
      <Head>
        <title>Vault v2.0</title>
      </Head>
      <main style={styles.page}>
        <div style={styles.bgGlow} />
        <div style={styles.shell}>
          <div style={styles.layout} className="layout">
            <aside style={styles.sidebar} className="sidebar-area">
              <FigmaSidebar />
              <footer style={styles.footer} className="footer">
                <div style={styles.footerContact}>
                  <p style={styles.footerTitle}>Contact</p>
                  <div style={styles.footerLinksColumn}>
                    <a style={styles.footerLinkStrong} href="#">CC고객센터 텔레그램</a>
                    <a style={styles.footerLinkStrong} href="#">CC카지노 바로가기</a>
                    <a style={styles.footerLinkStrong} href="#">CC카지노 공식 탤래채널</a>
                  </div>
                </div>
              </footer>
            </aside>

            <section style={styles.mainPanel}>
              <div style={styles.grid} className="card-grid main-area">
                {loading && !data && <SkeletonRow />}

                {cards.map((card) => (
                  <VaultCard key={card.type} card={card} urgentMs={urgentMs} />
                ))}
              </div>
            </section>
          </div>
        </div>

        <FloatingLossBanner lossTotal={lossTotal} urgentMs={urgentMs} />
        <SocialProofToast proof={data?.social_proof} />
      </main>
      <style jsx global>{`
        :root {
          --bg: #050505;
          --accent1: #d2fd9c;
          --accent2: #282d1a;
          --accent3: #394508;
          --text-sub: #cbcbcb;
        }
        :global(body) {
          margin: 0;
          background: var(--bg);
          color: #e5e7eb;
          font-family: 'Noto Sans KR', sans-serif;
        }
        @keyframes pulse {
          0% { opacity: 0.7; }
          50% { opacity: 1; }
          100% { opacity: 0.7; }
        }
        .sidebar-frame { gap: 49px; max-width: 345px; width: 100%; }
        .sidebar-nav { height: 33px; }
        .offer-card { width: 163px; height: 107px; }
        .offer-row { flex-wrap: wrap; }
        .footer { height: 222px; }
        .main-area { order: 0; }
        .sidebar-area { order: 1; }
        @media (max-width: 1024px) {
          .layout { grid-template-columns: 1fr !important; }
          .card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .sidebar-frame { max-width: 760px; gap: 8px; }
          .offer-card { width: 121px; height: 85px; padding: 14px 10px !important; }
          .footer { height: 153px; }
          .sidebar-area { order: -1; }
          :global(body) { padding: 0; }
        }
        @media (max-width: 640px) {
          .floating-banner { left: 12px !important; right: 12px !important; bottom: 12px !important; }
          .card-grid { grid-template-columns: 1fr !important; }
          .sidebar-card { padding: 12px !important; }
          .card { padding: 14px !important; }
          main { padding: 20px !important; }
          .sidebar-frame { max-width: 355px; gap: 6px; }
          .offer-card { width: 157px; height: 99px; }
          .footer { height: 144px; padding: 31px 20px !important; }
        }
      `}</style>
    </>
  );
}

function CountdownBadge({ expiresAt, nowIso, urgentMs }) {
  if (!expiresAt) return null;
  const remainingMs = urgentMs ?? Math.max(new Date(expiresAt) - (nowIso ? new Date(nowIso) : Date.now()), 0);
  const underHour = remainingMs < 60 * 60 * 1000;
  return (
    <div style={{
      ...styles.badge,
      background: underHour ? TOKENS.warn : 'rgba(255,255,255,0.08)',
      color: underHour ? '#0b0b0b' : '#e5e7eb',
    }}>
      <span style={{ marginRight: 8 }}>이벤트 종료까지</span>
      <strong style={{ fontFamily: 'Roboto Mono, monospace' }}>{formatDuration(remainingMs, underHour)}</strong>
    </div>
  );
}

function VaultCard({ card, urgentMs }) {
  const tone = card.type === 'GOLD' ? TOKENS.gold : card.type === 'PLATINUM' ? TOKENS.plat : TOKENS.dia;
  const isGauge = card.type === 'DIAMOND';
  const progressPercent = Math.min(100, Math.round((card.progressValue / card.progressMax) * 100));
  const locked = card.status === 'LOCKED';
  const expired = card.status === 'EXPIRED';
  const ctaLabel = expired ? '소멸됨' : card.status === 'CLAIMED' ? '수령 완료' : '지금 해금';

  return (
    <article style={{ ...styles.card, borderColor: tone }} className="card">
      <div style={styles.cardHeader(tone)}>
        <div style={styles.cardHeaderLeft}>
          <span style={styles.badgeState(tone)}>{STATUS_LABEL[card.status] || card.status}</span>
          <h3 style={styles.cardTitle}>{card.type}</h3>
        </div>
        <div style={styles.reward}>₩ {card.reward.toLocaleString()}</div>
      </div>

      <p style={styles.progressLabel}>{card.progressLabel}</p>
      <div style={styles.progressTrack} aria-label="progress">
        <div style={{ ...styles.progressFill(tone), width: `${progressPercent}%` }} />
        {isGauge && <span style={styles.progressText}>{progressPercent}%</span>}
      </div>

      <div style={styles.footerRow}>
        <CountdownBadge expiresAt={card.expiresAt} urgentMs={urgentMs} />
        <button style={styles.ctaButton(tone, locked || expired)} disabled={locked || expired}>
          {ctaLabel}
        </button>
      </div>
    </article>
  );
}

function FloatingLossBanner({ lossTotal, urgentMs }) {
  if (!lossTotal) return null;
  return (
    <div style={styles.floatingBanner} className="floating-banner">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={styles.badgeWarn}>소멸 위험</span>
        <strong style={{ fontSize: 18 }}>미수령 합계 ₩ {lossTotal.toLocaleString()}</strong>
      </div>
      {urgentMs != null && (
        <span style={{ fontFamily: 'Roboto Mono, monospace', color: TOKENS.warn }}>
          {formatDuration(urgentMs, true)}
        </span>
      )}
    </div>
  );
}

function BonusProgress({ value, max }) {
  const percent = Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={styles.bonusCard}>
      <div style={styles.bonusHeader}>
        <span style={styles.labelNew}>BONUS</span>
        <strong>7일 내 3개 모두 회수하면 추가 보너스</strong>
      </div>
      <div style={styles.progressTrackTall}>
        <div style={{ ...styles.progressFill(TOKENS.warn), width: `${percent}%` }} />
      </div>
      <small style={{ color: '#cbd5e1' }}>{value}/{max} 완료</small>
    </div>
  );
}

function FigmaSidebar() {
  return (
    <div style={styles.sidebarFrame} className="sidebar-frame">
      <nav style={styles.sidebarNav} className="sidebar-nav">
        <div style={styles.logoWrap}>
          <div style={styles.logoBadge}>
            <img
              alt="CC Casino"
              style={styles.logoImg}
              src={ICON_STAR}
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/icon-star.png'; }}
            />
          </div>
          <span style={styles.logoText}>CC CASINO</span>
        </div>
        <a style={styles.navButton} href="https://figma.com/sites">금고 가이드</a>
      </nav>
      <div style={styles.sidebarHeading}>
        <div style={styles.sidebarTitleBlock}>
          <div>씨씨카지노</div>
          <div style={styles.sidebarHighlight}>신규회원 전용금고</div>
        </div>
        <p style={styles.sidebarAddress}>평생주소 : 씨씨주소.COM</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>
        <h3 style={styles.offeringTitle}>게임 바로가기</h3>
        <div style={styles.offerRow} className="offer-row">
          <OfferCard icon={ICON_GAME} fallback="/icon-game.png" lines={[
            'CC카지노',
            '바로가기',
          ]}
          />
          <OfferCard icon={ICON_TELEGRAM} fallback="/icon-telegram.png" lines={[
            'CC카지노',
            '텔레공식채널',
          ]}
          />
        </div>
      </div>
    </div>
  );
}

function OfferCard({ icon, fallback, lines }) {
  return (
    <div style={styles.offerCard} className="offer-card">
      <img
        alt="바로가기"
        src={icon}
        style={styles.offerIcon}
        onError={(e) => { if (fallback) { e.currentTarget.onerror = null; e.currentTarget.src = fallback; } }}
      />
      <p style={styles.offerText}>
        {lines.map((line, idx) => (
          <span key={line + idx} style={{ display: 'block' }}>{line}</span>
        ))}
      </p>
    </div>
  );
}

function PersonalCuration({ curationTier }) {
  const text = curationTier
    ? `당신은 ${curationTier} 관상! 가까운 금고를 먼저 회수하세요.`
    : '초기 패턴을 분석 중입니다. 금고별 진행률을 채워주세요.';
  return (
    <div style={{ ...styles.sidebarCard, width: '100%' }} className="sidebar-card card">
      <div style={styles.sidebarHeader}>
        <span style={styles.labelNew}>CURATION</span>
        <strong>개인화 큐레이션</strong>
      </div>
      <p style={styles.sidebarText}>{text}</p>
      <button style={styles.sidebarButton}>가장 가까운 금고로 이동</button>
    </div>
  );
}

function ReferralBlock({ available }) {
  if (!available) return null;
  return (
    <div style={{ ...styles.sidebarCardWarn, width: '100%' }} className="sidebar-card">
      <div style={styles.sidebarHeader}>
        <span style={styles.labelNew}>REVIVE</span>
        <strong>D-1 부활권</strong>
      </div>
      <p style={styles.sidebarText}>만료 24h 전 친구 초대 시 +24h 연장 가능</p>
      <button style={styles.sidebarButtonWarn}>부활권 사용하기</button>
    </div>
  );
}

function ChecklistBlock() {
  return (
    <div style={{ ...styles.sidebarCardSoft, width: '100%' }} className="sidebar-card">
      <div style={styles.sidebarHeader}>
        <span style={styles.labelNew}>CHECK</span>
        <strong>오늘 할 일</strong>
      </div>
      <ul style={styles.checklist}>
        <li>출석 체크 1회</li>
        <li>충전 50,000원 단일 달성</li>
        <li>누적 충전 진행률 확인</li>
      </ul>
    </div>
  );
}

function SocialProofToast({ proof }) {
  if (!proof) return null;
  return (
    <div style={styles.toast}>
      <span style={styles.badge}>{proof.vault_type || 'PLATINUM'}</span>
      <span style={{ fontSize: 13 }}>최근 24h {proof.claimed_last_24h?.toLocaleString()}명이 회수</span>
    </div>
  );
}

function SkeletonRow() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <div key={i} style={styles.skeleton} />
      ))}
    </>
  );
}

function formatDuration(ms, showMs) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (!showMs) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  const milli = Math.floor(ms % 1000);
  return `${pad(m)}:${pad(s)}:${pad3(milli)}`;
}

const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
const pad3 = (n) => n.toString().padStart(3, '0');

const styles = {
  page: {
    minHeight: '100vh',
    background: TOKENS.bg,
    color: '#e5e7eb',
    fontFamily: 'Noto Sans KR, sans-serif',
    padding: '32px',
    position: 'relative',
  },
  bgGlow: {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    background: 'radial-gradient(circle at 30% 30%, rgba(210,253,156,0.05), transparent 35%), radial-gradient(circle at 80% 10%, rgba(7,175,77,0.05), transparent 30%)',
    zIndex: 0,
  },
  shell: {
    width: '100%',
    maxWidth: '100%',
    margin: '0 auto',
    position: 'relative',
    zIndex: 1,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
    position: 'relative',
    zIndex: 1,
    flexWrap: 'wrap',
  },
  headerLeft: { display: 'flex', flexDirection: 'column', gap: 8 },
  titleLine: { display: 'flex', alignItems: 'center', gap: 8 },
  title: { margin: 0, fontSize: 28, letterSpacing: '-0.01em' },
  subtitle: { margin: 0, color: '#94a3b8', maxWidth: 720 },
  labelNew: {
    display: 'inline-flex',
    padding: '4px 8px',
    borderRadius: 999,
    background: 'linear-gradient(90deg, rgba(210,253,156,0.2), rgba(10,167,135,0.2))',
    border: '1px solid rgba(210,253,156,0.6)',
    color: TOKENS.gold,
    fontSize: 12,
    letterSpacing: '0.02em',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 16,
    position: 'relative',
    zIndex: 1,
    paddingTop: 8,
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '356px minmax(0, 1fr)',
    gap: 16,
    alignItems: 'start',
  },
  mainPanel: {
    position: 'relative',
    background: 'rgba(12,12,12,0.82)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: '8px 10px 18px 17px',
    minHeight: 375,
    boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    alignItems: 'flex-start',
    width: '100%',
    maxWidth: 356,
  },
  card: {
    background: 'rgba(18,18,18,0.72)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: TOKENS.cardRadius,
    padding: '18px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.35)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  cardHeader: (tone) => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: `linear-gradient(90deg, ${tone}33, transparent)`,
    padding: '8px 10px',
    borderRadius: TOKENS.cardRadius,
    border: `1px solid ${tone}44`,
  }),
  cardHeaderLeft: { display: 'flex', gap: 10, alignItems: 'center' },
  cardTitle: { margin: 0, letterSpacing: '0.04em' },
  badgeState: (tone) => ({
    padding: '4px 10px',
    borderRadius: 999,
    border: `1px solid ${tone}aa`,
    background: `${tone}22`,
    color: tone,
    fontSize: 12,
  }),
  reward: { fontSize: 20, fontWeight: 700 },
  progressLabel: { margin: 0, color: '#cbd5e1', fontSize: 14 },
  progressTrack: {
    position: 'relative',
    height: 12,
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressTrackTall: {
    position: 'relative',
    height: 14,
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 6,
  },
  progressFill: (tone) => ({
    position: 'absolute',
    inset: 0,
    width: '0%',
    background: `linear-gradient(90deg, ${tone}, ${tone}aa)`,
    boxShadow: `0 0 12px ${tone}55`,
    transition: 'width 0.4s ease',
  }),
  progressText: {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: 12,
    color: '#0b0b0b',
    padding: '2px 6px',
    borderRadius: 6,
    background: '#e5e7eb',
  },
  footerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  ctaButton: (tone, disabled) => ({
    padding: '10px 14px',
    borderRadius: 12,
    border: `1px solid ${disabled ? 'rgba(255,255,255,0.15)' : tone}`,
    background: disabled ? 'rgba(255,255,255,0.06)' : `linear-gradient(90deg, ${tone}, ${tone}aa)`,
    color: disabled ? '#9ca3af' : '#0b0b0b',
    cursor: disabled ? 'default' : 'pointer',
    fontWeight: 700,
    transition: 'transform 0.12s ease, box-shadow 0.2s ease',
  }),
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 12px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.12)',
    fontSize: 13,
  },
  badgeWarn: {
    padding: '4px 8px',
    borderRadius: 999,
    border: `1px solid ${TOKENS.warn}`,
    color: TOKENS.warn,
    background: `${TOKENS.warn}15`,
    fontSize: 12,
  },
  floatingBanner: {
    position: 'fixed',
    right: 10,
    bottom: 10,
    background: 'rgba(15,15,15,0.9)',
    border: `1px solid ${TOKENS.warn}55`,
    boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
    borderRadius: 14,
    padding: '12px 14px',
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    zIndex: 3,
  },
  bonusSection: {
    marginTop: 18,
    position: 'relative',
    zIndex: 1,
  },
  bonusCard: {
    border: `1px solid ${TOKENS.warn}44`,
    background: 'rgba(18,18,18,0.8)',
    padding: 16,
    borderRadius: 16,
    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
  },
  bonusHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  errorCard: {
    gridColumn: '1 / -1',
    padding: 14,
    borderRadius: 14,
    background: 'rgba(50,20,10,0.65)',
    border: `1px solid ${TOKENS.warn}55`,
    color: '#ffe5d0',
  },
  skeleton: {
    height: 180,
    borderRadius: TOKENS.cardRadius,
    background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)',
    animation: 'pulse 1.2s ease-in-out infinite',
  },
  sidebarCard: {
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(20,20,20,0.78)',
    borderRadius: 14,
    padding: 14,
    boxShadow: '0 10px 24px rgba(0,0,0,0.25)',
  },
  sidebarCardWarn: {
    border: `1px solid ${TOKENS.warn}55`,
    background: 'rgba(45,20,10,0.8)',
    borderRadius: 14,
    padding: 14,
  },
  sidebarCardSoft: {
    border: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(25,25,25,0.7)',
    borderRadius: 14,
    padding: 14,
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sidebarText: { margin: 0, color: '#cbd5e1', fontSize: 13 },
  sidebarButton: {
    marginTop: 10,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'linear-gradient(90deg, rgba(210,253,156,0.2), rgba(10,167,135,0.2))',
    color: '#e5e7eb',
    cursor: 'pointer',
    fontWeight: 600,
  },
  sidebarButtonWarn: {
    marginTop: 10,
    padding: '10px 12px',
    borderRadius: 10,
    border: `1px solid ${TOKENS.warn}aa`,
    background: `${TOKENS.warn}22`,
    color: TOKENS.warn,
    cursor: 'pointer',
    fontWeight: 700,
  },
  checklist: {
    margin: '6px 0 0',
    paddingLeft: 18,
    color: '#cbd5e1',
    fontSize: 13,
    display: 'grid',
    gap: 4,
  },
  toast: {
    position: 'fixed',
    left: 20,
    bottom: 20,
    background: 'rgba(15,15,15,0.92)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: '10px 12px',
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    zIndex: 3,
    boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
  },
  footer: {
    marginTop: 12,
    padding: '31px 20px',
    background: '#282d1a',
    color: TOKENS.gold,
    display: 'flex',
    alignItems: 'flex-end',
    height: '222px',
    borderRadius: 0,
    width: '100%',
  },
  footerContact: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  footerTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 500,
    color: TOKENS.gold,
  },
  footerLinksColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: 20,
    color: TOKENS.gold,
  },
  footerLinkStrong: {
    color: TOKENS.gold,
    textDecoration: 'none',
    fontWeight: 500,
  },
  sidebarFrame: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 49,
    padding: '20px 5px',
  },
  sidebarNav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  logoWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },
  logoBadge: {
    width: 26,
    height: 27,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  logoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  logoText: {
    fontFamily: 'IBM Plex Sans, IBM Plex Sans KR, sans-serif',
    fontWeight: 600,
    fontSize: 20,
    letterSpacing: '-0.4px',
    color: '#fff',
  },
  navButton: {
    background: TOKENS.gold,
    color: '#0b0b0b',
    border: 'none',
    borderRadius: 2,
    padding: '11px 14px',
    fontFamily: 'IBM Plex Sans KR, sans-serif',
    fontSize: 10,
    cursor: 'pointer',
    textDecoration: 'none',
  },
  sidebarHeading: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  sidebarTitleBlock: {
    fontFamily: 'Noto Sans KR, sans-serif',
    fontSize: 42,
    fontWeight: 500,
    lineHeight: 1.06,
    color: '#fff',
    letterSpacing: '-0.84px',
    margin: 0,
  },
  sidebarHighlight: {
    color: TOKENS.gold,
  },
  sidebarAddress: {
    margin: 0,
    color: '#cbcbcb',
    fontSize: 16,
    fontWeight: 400,
  },
  offeringTitle: {
    margin: 0,
    color: TOKENS.gold,
    fontSize: 20,
    fontWeight: 500,
  },
  offerRow: {
    display: 'flex',
    gap: 10,
    marginTop: 20,
  },
  offerCard: {
    background: TOKENS.gold,
    borderRadius: 4,
    padding: '20px 10px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    boxShadow: '0 10px 24px rgba(0,0,0,0.35)',
  },
  offerIcon: {
    width: 30,
    height: 30,
  },
  offerText: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 500,
    color: '#0b0b0b',
    margin: 0,
    lineHeight: 1.15,
  },
};

