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
        sidebar: {
          bg: '#1a1d27',
          hover: '#252836',
          active: '#2d3748',
        },
        primary: {
          DEFAULT: '#667eea',
          dark: '#5a6fd6',
        },
        content: {
          bg: '#f7f8fc',
        },
        card: {
          bg: '#ffffff',
        },
        unread: {
          bg: '#f0f4ff',
        },
        border: {
          DEFAULT: '#e8ecf4',
        },
        text: {
          DEFAULT: '#2d3748',
          muted: '#718096',
        },
        success: '#48bb78',
        warning: '#ed8936',
        error: '#fc8181',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'gradient-shift': 'gradientShift 8s ease infinite',
        'card-float': 'cardFloat 3s ease-in-out infinite',
        'card-float-delay-1': 'cardFloat 3s ease-in-out 1s infinite',
        'card-float-delay-2': 'cardFloat 3s ease-in-out 2s infinite',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-in-up': 'slideInUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'spin-slow': 'spin 3s linear infinite',
        'toast-enter': 'toastEnter 0.3s ease-out',
        'toast-exit': 'toastExit 0.3s ease-in',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
      },
      keyframes: {
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        cardFloat: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        slideInRight: {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        slideInUp: {
          from: { transform: 'translateY(20px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        toastEnter: {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        toastExit: {
          from: { transform: 'translateX(0)', opacity: '1' },
          to: { transform: 'translateX(100%)', opacity: '0' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
      backgroundSize: {
        '400%': '400%',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.1)',
        'modal': '0 20px 60px rgba(0,0,0,0.2)',
        'compose': '0 -4px 20px rgba(0,0,0,0.15)',
      },
    },
  },
  plugins: [],
}

export default config
