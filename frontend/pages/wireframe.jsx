import Head from 'next/head';

const TOKENS = {
  bg: '#050505',
  gold: '#D2FD9C',
  plat: '#07AF4D',
  dia: '#0AA787',
  warn: '#F97935',
  cardRadius: 18,
};

const CARDS = [
  {
    tier: 'GOLD',
    title: '골드 금고',
    status: 'AVAILABLE',
    reward: '₩10,000',
    steps: ['CC카지노, CC카지노 외부사이트 채널 가입 총 2개'],
    badge: 'AVAILABLE',
    accent: TOKENS.gold,
    progressLabel: '채널 가입 2/2',
  },
  {
    tier: 'PLATINUM',
    title: '플래티넘 금고',
    status: 'LOCKED',
    reward: '₩30,000',
    steps: ['출석 보너스 3회 받기', '단일 5충 1회 완료'],
    badge: 'LOCKED',
    accent: TOKENS.plat,
    progressLabel: '미션 진행률 2/3',
  },
  {
    tier: 'DIAMOND',
    title: '다이아 금고',
    status: 'LOCKED',
    reward: '₩100,000',
    steps: ['누적 5충 500,000원 달성'],
    badge: 'LOCKED',
    accent: TOKENS.dia,
    progressLabel: '미션 진행률 27%',
  },
];

export default function Wireframe() {
  return (
    <>
      <Head>
        <title>Vault Wireframe</title>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap"
        />
      </Head>
      <main style={styles.page}>
        <div style={styles.layout}>
          <aside style={styles.sidebar}>
            <div style={styles.sidebarHeader}>
              <div style={styles.brandRow}>
                <div style={styles.brandMark}>CC</div>
                <span style={styles.brandText}>CC CASINO</span>
                <span style={styles.joinBtn}>신규가입</span>
              </div>
              <div style={styles.sidebarTitle}>씨씨카지노는 신규회원 전용금고</div>
              <div style={styles.sidebarLabel}>평생주소 : 씨씨주소.COM</div>
            </div>
            <div style={styles.sidebarActions}>
              <div style={styles.actionCard}>
                <div style={styles.actionIcon}>★</div>
                <div style={styles.actionText}>CC카지노 바로가기</div>
              </div>
              <div style={styles.actionCard}>
                <div style={styles.actionIcon}>✉</div>
                <div style={styles.actionText}>CC카지노 텔레공식채널</div>
              </div>
            </div>
            <div style={styles.sidebarFooter}>
              <div style={styles.contactTitle}>Contact</div>
              <div style={styles.contactList}>
                <span>CC카지노 텔레공식채널</span>
                <span>CC카지노 바로가기</span>
                <span>CC카지노 공식 텔레채널</span>
              </div>
            </div>
          </aside>

          <section style={styles.main}>
            <header style={styles.hero}>
              <div>
                <div style={styles.heroSup}>이벤트 종료까지 2일 23시간 50분</div>
                <h1 style={styles.heroTitle}>미션 금고 챌린지</h1>
                <div style={styles.heroLabel}>LIMITED EVENT</div>
              </div>
            </header>

            <div style={styles.cardGrid}>
              {CARDS.map((card) => (
                <article key={card.tier} style={{ ...styles.card, borderColor: card.accent }}>
                  <div style={{ ...styles.cardHeader, background: tint(card.accent, 0.1) }}>
                    <div style={styles.cardBadge}>{card.badge}</div>
                    <div style={{ ...styles.cardTier, color: card.accent }}>{card.tier}</div>
                  </div>
                  <div style={styles.cardBody}>
                    <div style={styles.cardIcon}>🔒</div>
                    <div style={styles.cardTitle}>{card.title}</div>
                    <div style={{ ...styles.reward, color: card.accent }}>{card.reward}</div>
                    <div style={styles.progressRow}>
                      <div style={styles.progressLabel}>{card.progressLabel}</div>
                      <div style={styles.progressTrack}>
                        <div style={{ ...styles.progressFill, background: card.accent }} />
                      </div>
                    </div>
                    <ul style={styles.cardList}>
                      {card.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ul>
                    <button style={{ ...styles.cta, background: card.accent }}>조건 필요</button>
                  </div>
                </article>
              ))}
            </div>

            <div style={styles.bonusBlock}>
              <div style={styles.bonusTitle}>완성 보너스!</div>
              <div style={styles.bonusText}>나머지 금고 1개를 열면 추가로 보너스 지급</div>
              <div style={styles.bonusProgress}>
                <div style={styles.bonusTrack}>
                  <div style={styles.bonusFill} />
                  <div style={styles.bonusMarks}>
                    <span style={styles.mark}>●</span>
                    <span style={styles.mark}>●</span>
                    <span style={styles.mark}>○</span>
                  </div>
                </div>
                <div style={styles.bonusLabel}>완성까지 1개 남음</div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

function tint(hex, alpha) {
  return hex + Math.round(alpha * 255).toString(16).padStart(2, '0');
}

const styles = {
  page: {
    minHeight: '100vh',
    background: TOKENS.bg,
    color: '#f8fafc',
    fontFamily: 'Noto Sans KR, sans-serif',
    padding: 24,
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '340px 1fr',
    gap: 24,
    alignItems: 'start',
  },
  sidebar: {
    background: '#1a2008',
    border: `1px solid ${TOKENS.gold}33`,
    borderRadius: 12,
    padding: 18,
    display: 'grid',
    gap: 18,
  },
  sidebarHeader: { display: 'grid', gap: 10 },
  brandRow: { display: 'flex', alignItems: 'center', gap: 8 },
  brandMark: {
    background: TOKENS.gold,
    color: '#050505',
    borderRadius: 6,
    padding: '6px 8px',
    fontWeight: 700,
    fontSize: 12,
  },
  brandText: { fontWeight: 700, fontSize: 16 },
  joinBtn: {
    marginLeft: 'auto',
    background: '#2f3714',
    color: TOKENS.gold,
    padding: '8px 10px',
    borderRadius: 6,
    fontSize: 12,
  },
  sidebarTitle: { fontSize: 20, fontWeight: 700, lineHeight: 1.3 },
  sidebarLabel: { color: TOKENS.gold, fontWeight: 600, fontSize: 14 },
  sidebarActions: { display: 'grid', gap: 10 },
  actionCard: {
    background: TOKENS.gold,
    color: '#050505',
    borderRadius: 8,
    padding: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontWeight: 700,
  },
  actionIcon: { width: 28, height: 28, background: '#111', color: TOKENS.gold, borderRadius: 6, display: 'grid', placeItems: 'center' },
  actionText: { fontSize: 16 },
  sidebarFooter: { display: 'grid', gap: 8, marginTop: 6 },
  contactTitle: { color: TOKENS.gold, fontSize: 16, fontWeight: 700 },
  contactList: { display: 'grid', gap: 4, color: TOKENS.gold, fontSize: 14 },
  main: {
    background: '#0b0b0b',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 18,
    display: 'grid',
    gap: 18,
  },
  hero: { borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 12 },
  heroSup: { color: TOKENS.warn, fontSize: 14, marginBottom: 6 },
  heroTitle: { margin: 0, fontSize: 28, color: '#f8fafc' },
  heroLabel: {
    display: 'inline-flex',
    marginTop: 8,
    padding: '6px 10px',
    borderRadius: 12,
    background: 'rgba(7,175,77,0.12)',
    color: TOKENS.plat,
    fontWeight: 700,
    fontSize: 12,
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 14,
  },
  card: {
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(20,20,20,0.9)',
    borderRadius: TOKENS.cardRadius,
    padding: 14,
    display: 'grid',
    gap: 10,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 10px',
    borderRadius: 12,
    fontWeight: 700,
  },
  cardBadge: {
    background: '#111',
    borderRadius: 999,
    padding: '6px 10px',
    fontSize: 12,
    border: '1px solid rgba(255,255,255,0.16)',
  },
  cardTier: { fontSize: 12, fontWeight: 800 },
  cardBody: { display: 'grid', gap: 8 },
  cardIcon: { fontSize: 28 },
  cardTitle: { fontSize: 18, fontWeight: 700 },
  reward: { fontSize: 22, fontWeight: 800 },
  progressRow: { display: 'grid', gap: 6 },
  progressLabel: { color: '#e2e8f0', fontSize: 13, fontWeight: 600 },
  progressTrack: {
    position: 'relative',
    height: 10,
    background: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: { position: 'absolute', inset: 0, width: '60%' },
  cardList: { margin: 0, paddingLeft: 16, display: 'grid', gap: 4, color: '#e2e8f0', fontSize: 13 },
  cta: {
    border: 'none',
    borderRadius: 10,
    color: '#050505',
    fontWeight: 700,
    padding: '10px 12px',
    cursor: 'pointer',
  },
  bonusBlock: {
    background: 'rgba(30,30,30,0.9)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 14,
    display: 'grid',
    gap: 6,
  },
  bonusTitle: { fontSize: 18, fontWeight: 800 },
  bonusText: { fontSize: 14, color: '#cbd5e1' },
  bonusProgress: { display: 'grid', gap: 6 },
  bonusTrack: {
    position: 'relative',
    height: 12,
    background: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
  },
  bonusFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    width: '66%',
    background: 'linear-gradient(90deg, #fbbf24, #22c55e)',
    borderRadius: 999,
  },
  bonusMarks: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 8px',
    color: '#fff',
    fontSize: 12,
  },
  mark: { opacity: 0.8 },
  bonusLabel: { fontSize: 13, color: '#e2e8f0' },
};
