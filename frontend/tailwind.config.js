/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // CC Casino (Figma) primitives
        cc: {
          accent2: '#282D1A',
          textSub: '#CBCBCB',
        },
        // Gold tier
        gold: {
          primary: '#D2FD9C',
          bg: '#394508',
          dark: '#212b01',
          darker: '#161c01',
        },
        // Platinum tier
        platinum: {
          primary: '#07AF4D',
          bg: '#075a28',
          dark: '#053d1b',
          darker: '#032210',
        },
        // Diamond tier
        diamond: {
          primary: '#0AA787',
          bg: '#0A7C65',
          dark: '#065446',
          darker: '#032C26',
        },
        // Accent
        accent: {
          orange: '#F97935',
          yellow: '#FFBC42',
        },

        // Admin main palette (from provided reference code)
        admin: {
          bg: '#1c1c1e',
          surface: '#2c2c2e',
          input: '#3a3a3c',
          border: '#3a3a3c',
          border2: '#48484a',
          text: '#f2f2f7',
          muted: '#8e8e93',
          green: '#2DAA48',
          greenDark: '#1A512E',
          neon: '#9AFF00',
        },
      },
      fontFamily: {
        sans: ['Noto Sans KR', 'sans-serif'],
        ibm: ['IBM Plex Sans', 'sans-serif'],
        ibmKr: ['IBM Plex Sans KR', 'sans-serif'],
      },
      animation: {
        shimmer: 'shimmer 2s linear infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [],
};
