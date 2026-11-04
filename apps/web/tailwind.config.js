/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Sali brand: navy ink + peach pen cap (see logo / salivpn.com)
        black: '#040913',
        sali: {
          black: '#040913',
          navy: '#06101F',
          white: '#FFFFFF',
          gray: {
            950: '#0A1222',
            900: '#101A2E',
            800: '#18233A',
            700: '#26324B',
            600: '#36445F',
            500: '#5E6A85',
            400: '#8792AB',
            300: '#B7C0D4',
            200: '#D6DEEE',
            100: '#EEF2FA',
          },
          accent: '#FFC587', // peach: primary actions
          success: '#5BE0A8', // connected / active
          danger: '#FF7A7A',
        },
      },
      fontFamily: {
        display: ['"Sali Sans"', 'system-ui', 'sans-serif'],
        sans: ['"Sali Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        md: '14px',
        lg: '18px',
        xl: '24px',
      },
      transitionTimingFunction: {
        'ease-out-fast': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
