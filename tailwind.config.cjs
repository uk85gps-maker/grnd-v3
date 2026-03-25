/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0A0A0A',
        primary: '#B8960C',
        card: '#1A1A1A',
        text: {
          primary: '#FFFFFF',
          secondary: '#8A8A8A',
        },
      },
      borderRadius: {
        brand: '12px',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
