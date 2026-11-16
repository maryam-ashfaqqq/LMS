import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#1A2E25',
          soft: '#3E5348',
        },
        paper: '#F5EFE6',
        cream: '#FFFBF5',
        line: '#E6D9C8',
        pine: {
          DEFAULT: '#1B4332',
          deep: '#102A1F',
          mid: '#2D6A4F',
          mist: '#E7F0EB',
        },
        accent: {
          DEFAULT: '#7C3AED',
          deep: '#6D28D9',
          mist: '#F3E8FF',
        },
        clay: {
          DEFAULT: '#7C3AED',
          deep: '#6D28D9',
          mist: '#F3E8FF',
        },
        muted: '#5C6E64',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 18px 50px rgba(16, 42, 31, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
