/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        teal: {
          50: '#f0f9f9',
          100: '#d7efef',
          200: '#b2dfdf',
          500: '#2a7c80',
          600: '#1e595c',
          700: '#18474a',
          800: '#14383a',
          900: '#122e30',
        },
        slate: {
          850: '#152026',
          900: '#0f171b',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Noto Sans Bengali', 'Noto Sans Devanagari', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
};
