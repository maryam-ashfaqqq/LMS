import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#1c1916',
          soft: '#4a433c',
        },
        paper: '#f3eee6',
        cream: '#fffdf8',
        line: '#e5dcd0',
        pine: {
          DEFAULT: '#16382e',
          deep: '#0f2820',
          mid: '#1f6a52',
          mist: '#e5f2ec',
        },
        clay: {
          DEFAULT: '#c45c32',
          deep: '#9d4322',
          mist: '#f8ebe4',
        },
        muted: '#6f675f',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 18px 50px rgba(28, 25, 22, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
