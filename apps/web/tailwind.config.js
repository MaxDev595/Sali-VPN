/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sali: {
          black: '#000000',
          white: '#FFFFFF',
          gray: {
            950: '#0A0A0A',
            900: '#111111',
            800: '#1C1C1C',
            700: '#2A2A2A',
            600: '#3D3D3D',
            500: '#6B6B6B',
            400: '#9A9A9A',
            300: '#C7C7C7',
            200: '#E4E4E4',
            100: '#F2F2F2',
          },
          accent: '#00E38A', // used sparingly: active/connected state only
          danger: '#FF5C5C',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Inter"',
          '"SF Pro Display"',
          'sans-serif',
        ],
      },
      borderRadius: {
        md: '12px',
        lg: '16px',
        xl: '20px',
      },
      transitionTimingFunction: {
        'ease-out-fast': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
