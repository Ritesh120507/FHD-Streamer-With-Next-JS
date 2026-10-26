/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
      },
      transitionTimingFunction: {
        'fluid': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      animation: {
        'float-slow': 'floatSmooth 24s cubic-bezier(0.4, 0, 0.2, 1) infinite alternate',
        'pulse-live': 'pulseLive 2s infinite',
        'fade-in': 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-up': 'scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        floatSmooth: {
          '0%': { transform: 'translate3d(0px, 0px, 0) scale(1) rotate(0deg)' },
          '33%': { transform: 'translate3d(45px, -55px, 0) scale(1.06) rotate(60deg)' },
          '66%': { transform: 'translate3d(-35px, 45px, 0) scale(0.95) rotate(120deg)' },
          '100%': { transform: 'translate3d(25px, -25px, 0) scale(1.02) rotate(180deg)' },
        },
        pulseLive: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(0.98)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        scaleUp: {
          from: { opacity: '0', transform: 'scale(0.95) translateY(10px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

