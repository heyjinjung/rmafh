import Head from 'next/head';

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
  return (
    <>
      <Head>
        <title>CC Casino - 신규회원 전용금고</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;600&family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet" />
      </Head>

      <div style={styles.page} className="page">
        {/* ─── Sidebar Container ─── */}
        <aside style={styles.sidebar} className="sidebar">
          {/* Nav */}
          <nav style={styles.nav}>
            <div style={styles.logo}>
              <img src={ICON_STAR} alt="CC Casino" style={styles.logoIcon} />
              <span style={styles.logoText}>CC CASINO</span>
            </div>
            <a href="#" style={styles.navButton}>금고 가이드</a>
          </nav>

          {/* Header */}
          <div style={styles.header}>
            <h1 style={styles.title} className="title">
              <span style={{ color: TOKENS.textWhite }}>씨씨카지노</span>
              <br />
              <span style={{ color: TOKENS.accent1 }}>신규회원 전용금고</span>
            </h1>
            <p style={styles.address}>평생주소 : 씨씨주소.COM</p>
          </div>

          {/* Game Links */}
          <div style={styles.offerings}>
            <h3 style={styles.offeringsTitle}>게임 바로가기</h3>
            <div style={styles.modules} className="modules">
              <a href="#" style={styles.navCard} className="nav-card">
                <img src={ICON_GAME} alt="" style={styles.navCardIcon} />
                <div style={styles.navCardText}>
                  <span>CC카지노</span>
                  <span>바로가기</span>
                </div>
              </a>
              <a href="#" style={styles.navCard} className="nav-card">
                <img src={ICON_TELEGRAM} alt="" style={styles.navCardIcon} />
                <div style={styles.navCardText}>
                  <span>CC카지노</span>
                  <span>텔레공식채널</span>
                </div>
              </a>
            </div>
          </div>
        </aside>

        {/* ─── Footer ─── */}
        <footer style={styles.footer} className="footer">
          <div style={styles.footerContent}>
            <p style={styles.contactTitle}>Contact</p>
            <div style={styles.contactLinks}>
              <span>CC고객센터 텔레그램</span>
              <span>CC카지노 바로가기</span>
              <span>CC카지노 공식 탤래채널</span>
            </div>
          </div>
        </footer>

        {/* ─── Main Content ─── */}
        <main style={styles.main} className="main">
          <VaultCardsPlaceholder />
        </main>
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
          .footer { position: relative !important; width: 100% !important; max-width: 760px !important; margin: 0 auto; left: 0 !important; bottom: 0 !important; }
          .main { position: relative !important; width: 100% !important; max-width: 760px !important; margin: 0 auto; left: 0 !important; right: 0 !important; top: 0 !important; bottom: 0 !important; order: -1; }
          .modules { flex-wrap: wrap; }
          .nav-card { width: 121px !important; height: 85px !important; padding: 14px 10px !important; }
        }
        @media (max-width: 640px) {
          .sidebar { max-width: 100% !important; padding: 10px 16px !important; }
          .title { font-size: 28px !important; }
          .nav-card { width: 157px !important; height: 99px !important; }
          .footer { height: 144px !important; padding: 20px !important; }
        }
      `}</style>
    </>
  );
}

function VaultCardsPlaceholder() {
  return (
    <div style={styles.cardsContainer}>
      <div style={styles.placeholderText}>
        🔐 금고 카드 영역
        <br />
        <small style={{ opacity: 0.6 }}>(Figma Code Layer 5 영역)</small>
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
    overflow: 'hidden',
  },
  cardsContainer: {
    position: 'absolute',
    top: 8,
    left: 17,
    right: 0,
    height: 375,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px dashed rgba(210,253,156,0.3)',
    borderRadius: 12,
    background: 'rgba(210,253,156,0.05)',
  },
  placeholderText: {
    fontFamily: "'Noto Sans KR', sans-serif",
    fontSize: 24,
    fontWeight: 500,
    color: TOKENS.accent1,
    textAlign: 'center',
    opacity: 0.8,
  },
};

