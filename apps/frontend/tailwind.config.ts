import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
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
    },
  },
  plugins: [],
}

export default config
