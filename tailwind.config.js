/** Tailwind-config voor de gecompileerde CSS (vervangt de CDN-versie). */
module.exports = {
  content: ['./*.html', './kennis/*.html'],
  safelist: ['border-white/10', 'shadow-lg', 'shadow-slate-950/50'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
      },
      colors: { electric: { 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7' } },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(24px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: { 'fade-up': 'fade-up .7s cubic-bezier(.16,1,.3,1) forwards' },
    },
  },
};
