/** @type {import('tailwindcss').Config} */
const { fontFamily } = require('tailwindcss/defaultTheme');

module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e6f7ff',
          100: '#bae7ff',
          200: '#91d5ff',
          300: '#69c0ff',
          400: '#40a9ff',
          500: '#0099FF', // Main Thai-style blue
          600: '#0080d6',
          700: '#006bb3',
          800: '#005591',
          900: '#003f6e',
        },
        background: {
          cream: '#FFFAF0', // Thai-style cream background
          light: '#FEFEFE',
        },
        thai: {
          blue: '#0099FF',
          cream: '#FFFAF0',
          gray: {
            25: '#fcfcfd',
            50: '#f9fafb',
            100: '#f3f4f6',
            200: '#e5e7eb',
            300: '#d1d5db',
            400: '#9ca3af',
            500: '#6b7280',
            600: '#4b5563',
            700: '#374151',
            800: '#1f2937',
            900: '#111827',
          }
        }
      },
      fontFamily: {
        sans: ['var(--font-sarabun)', 'var(--font-noto-sans-thai)', ...fontFamily.sans],
        inter: ['var(--font-inter)', ...fontFamily.sans],
      },
      animation: {
        'slide-in': 'slideIn 0.3s ease-out',
        'slide-out': 'slideOut 0.3s ease-in',
        'slide': 'slide 2s ease-in-out infinite',
        'flow': 'flow 5s linear infinite',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideOut: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        slide: {
          '0%': { transform: 'translateX(-100%)' },
          '50%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        flow: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '5%': { opacity: '1' },
          '15%': { opacity: '1' },
          '20%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}