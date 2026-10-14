/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FAF8F4',
        surface: '#FFFFFF',
        sunken: '#F3F0E9',
        line: { DEFAULT: '#E6E2D9', strong: '#D3CEC2' },
        ink: { DEFAULT: '#1F2023', soft: '#46463F', muted: '#6B6860', faint: '#9A968B' },
        accent: {
          DEFAULT: '#454F9B',
          hover: '#38417F',
          soft: '#ECEEF8',
          softer: '#F5F6FB',
          line: '#C9CEE8',
        },
        ok: { DEFAULT: '#2F6B4F', soft: '#E8F1EC', line: '#BBD6C6' },
        warn: { DEFAULT: '#8A5A14', soft: '#F8EFDD', line: '#E5CFA3' },
        bad: { DEFAULT: '#9B3B32', soft: '#F8E9E6', line: '#E3BCB6' },
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
        serif: ['"Source Serif 4 Variable"', 'Source Serif 4', 'Georgia', 'serif'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
      },
      boxShadow: {
        pop: '0 8px 24px -8px rgba(31,32,35,0.18), 0 2px 6px -2px rgba(31,32,35,0.10)',
        panel: '0 1px 2px rgba(31,32,35,0.04)',
        page: '0 1px 3px rgba(31,32,35,0.10), 0 6px 18px -6px rgba(31,32,35,0.12)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(2px)' }, to: { opacity: '1', transform: 'none' } },
        'dot': { '0%, 80%, 100%': { opacity: '0.25' }, '40%': { opacity: '1' } },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out both',
        dot: 'dot 1.2s infinite ease-in-out',
      },
    },
  },
  plugins: [],
};
