/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
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
      },
      fontFamily: {
        sans: ['Noto Sans KR', 'sans-serif'],
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
