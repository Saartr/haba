/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#00C9A7',
        'primary-dark': '#00A88D',
        error: '#FF4D4F',
      },
    },
  },
  plugins: [],
};
