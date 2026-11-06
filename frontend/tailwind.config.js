/** @type {import('tailwindcss').Config} */

// Warm and friendly, kept calm. Soft greens on oat paper, one marigold for "look at this soon".
// The colour names below replace Tailwind's `teal`, `slate` and `stone`, so every screen picks them up.
const sage = {
  50: '#F1F6EE',
  100: '#E0EDE0',
  200: '#C6DDC9',
  300: '#A4C8AB',
  400: '#78AB86',
  500: '#4F8F69',
  600: '#3B7A57',
  700: '#2D6A4F', // primary: white text on it is 6.5:1
  800: '#24543F',
  900: '#1B4030',
};

// Neutrals with a little green in them, so grey never looks cold next to the sage
const ink = {
  50: '#F8F6EF',
  100: '#EFEBDD',
  200: '#E2DCC8',
  300: '#CFC8B0',
  400: '#A39D88',
  500: '#6B6A58',
  600: '#555A4E',
  700: '#3F473F',
  800: '#2B3832',
  900: '#1E2B25',
};

// The page itself: oat paper
const oat = {
  50: '#F5F1E6',
  100: '#EDE8D8',
  200: '#E2DCC8',
  300: '#D2CAB0',
  400: '#A39D88',
  500: '#7A7764',
  600: '#5B5E52',
  700: '#3F473F',
  800: '#2B3832',
  900: '#1E2B25',
};

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
        teal: sage,
        slate: ink,
        stone: oat,
        marigold: { 50: '#FFF6DD', 100: '#FBEBC0', 400: '#EBB04A', 500: '#E3A12F', 700: '#8A5A00' },
        cream: '#FFFDF8',
      },
      fontFamily: {
        // Figtree for reading. Noto fills in for Bengali and Hindi so they never fall back to a random system font.
        sans: ['Figtree', 'Noto Sans Bengali', 'Noto Sans Devanagari', 'system-ui', 'sans-serif'],
        serif: ['"Young Serif"', '"Noto Serif Bengali"', '"Noto Serif Devanagari"', 'Georgia', 'serif'],
      },
      // A tighter scale than before: body 15px, small 13px. Tap targets stay 44px or more.
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.1rem' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.9375rem', { lineHeight: '1.5rem' }],
        lg: ['1.0625rem', { lineHeight: '1.6rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '1.95rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.3rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.6rem' }],
      },
      boxShadow: {
        // used on the one hero card and on dialogs only, not under every box
        soft: '0 1px 2px rgba(58, 52, 30, 0.05), 0 12px 32px -12px rgba(58, 52, 30, 0.16)',
      },
    },
  },
  plugins: [],
};
