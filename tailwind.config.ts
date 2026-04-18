import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          darkest: '#02030a',
          darker: '#050608',
          dark: '#080a0f',
          panel: '#0c0e15',
          elevated: '#0e1220',
          border: '#10131c',
        },
        accent: {
          teal: '#3ecfc5',
          'teal-dim': 'rgba(62,207,197,0.2)',
          'teal-glow': 'rgba(62,207,197,0.08)',
          gold: '#F5A623',
          'gold-dim': 'rgba(245,166,35,0.2)',
        },
        fg: {
          primary: '#f5f7fa',
          muted: 'rgba(245,247,250,0.6)',
          dim: 'rgba(245,247,250,0.4)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SF Mono', 'Consolas', 'monospace'],
      },
      backgroundImage: {
        'radial-teal':
          'radial-gradient(circle at center, rgba(62,207,197,0.08) 0%, transparent 65%)',
        'radial-blue':
          'radial-gradient(circle at center, rgba(30,100,200,0.06) 0%, transparent 65%)',
        'gradient-hero':
          'linear-gradient(170deg, #05080f 0%, #08101c 50%, #050a14 100%)',
      },
      backgroundSize: {
        grid: '52px 52px',
      },
      boxShadow: {
        'teal-glow': '0 0 40px rgba(62,207,197,0.15)',
        'gold-glow': '0 0 30px rgba(245,166,35,0.2)',
      },
    },
  },
  plugins: [],
};

export default config;
