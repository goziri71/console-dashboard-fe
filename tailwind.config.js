/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        page: '#0A0A0A',
        card: '#12141A',
        'card-hover': '#1A1D25',
        sidebar: '#0E1015',
        'sidebar-active': '#1A1D25',
        border: '#1E2530',
        'border-subtle': '#15171E',
        accent: '#C8E64A',
        'accent-dim': 'rgba(200, 230, 74, 0.12)',
        'text-primary': '#FFFFFF',
        'text-secondary': '#8B8F97',
        'text-muted': '#5A5F6B',
        success: '#22C55E',
        error: '#EF4444',
        warning: '#F59E0B',
        info: '#3B82F6',
        'success-bg': 'rgba(34, 197, 94, 0.12)',
        'error-bg': 'rgba(239, 68, 68, 0.12)',
        'warning-bg': 'rgba(245, 158, 11, 0.12)',
        'info-bg': 'rgba(59, 130, 246, 0.12)',
        'accent-bg': 'rgba(200, 230, 74, 0.12)',
      },
      borderRadius: {
        card: '12px',
        button: '8px',
        badge: '6px',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.22, 1, 0.36, 1)',
        smooth: 'cubic-bezier(0.2, 0, 0, 1)',
      },
      transitionDuration: {
        fast: '140ms',
        base: '220ms',
        slow: '320ms',
      },
    },
  },
  plugins: [],
}
