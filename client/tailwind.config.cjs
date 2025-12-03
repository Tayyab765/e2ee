/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        purple: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          800: '#6b21a8',
          900: '#581c87'
        },
        brand: {
          50: '#e7fff7',
          100: '#c9ffec',
          200: '#9af7d8',
          300: '#63e9c1',
          400: '#32d3a7',
          500: '#16b78c',
          600: '#0f9270',
          700: '#0c7158',
          800: '#0a5645',
          900: '#083e34'
        }
      },
      boxShadow: {
        soft: '0 2px 12px rgba(0,0,0,0.08)'
      }
    }
  }
};
