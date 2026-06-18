import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    './src/shared/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gd: '#0D3B2E',
        gm: '#1A4D3A',
        gn: '#BFEF45',
        gs: '#C8D4C9',
        gx: '#6B7E6D',
        'page-bg': '#EDF2EE',
      },
      fontFamily: {
        sora: ['Sora', 'sans-serif'],
        sans: ['DM Sans', 'sans-serif'],
      },
      height: {
        sidebar: '52px',
        header: '56px',
      },
      width: {
        sidebar: '52px',
      },
      boxShadow: {
        // Subtle brand glows — GPU-friendly, used on hover/focus/active states
        glow: '0 0 16px -2px rgba(191, 239, 69, 0.45)',
        'glow-sm': '0 0 10px -2px rgba(191, 239, 69, 0.4)',
        'glow-gd': '0 0 18px -4px rgba(13, 59, 46, 0.28)',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-left': {
          from: { opacity: '0', transform: 'translateX(-6px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.5)' },
          '50%': { boxShadow: '0 0 0 4px rgba(239, 68, 68, 0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'scale-in': 'scale-in 0.18s ease-out',
        'slide-in-left': 'slide-in-left 0.18s ease-out',
        'slide-up': 'slide-up 0.22s ease-out',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
