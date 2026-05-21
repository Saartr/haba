/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Palette — Figma TapaDS
        purple: {
          50:  '#f2f0ff',
          100: '#e0dbff',
          200: '#c1b8ff',
          300: '#9e8fff',
          400: '#8370ff',
          500: '#6047ff',
          600: '#381aff',
          700: '#1e00e0',
          800: '#1600a8',
          900: '#0f0070',
          950: '#0a0047',
        },
        neutral: {
          0:   '#ffffff',
          100: '#efefef',
          200: '#e0e0e0',
          300: '#c9c9c9',
          400: '#b5b5b5',
          500: '#9e9e9e',
          600: '#757575',
          700: '#424242',
          800: '#323232',
          900: '#212121',
          950: '#121212',
        },
        green: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        yellow: {
          50:  '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
        },
        red: {
          50:  '#fef1f1',
          100: '#fddfdd',
          200: '#fbbfbb',
          300: '#f99b94',
          400: '#f76e64',
          500: '#f44336',
          600: '#e41b0c',
          700: '#ae1409',
          800: '#790e06',
          900: '#440804',
        },
        // Semantic aliases (static, for backward compat)
        primary: '#6047ff',
        error:   '#f44336',
        // Semantic tokens — CSS-variable-driven, dark-mode-aware
        brand: {
          primary: 'var(--color-brand-primary)',
          pressed: 'var(--color-brand-primary-pressed)',
        },
        surface: {
          default:  'var(--color-surface-default)',
          input:    'var(--color-surface-input)',
          disabled: 'var(--color-surface-input-disabled)',
        },
        text: {
          primary:      'var(--color-text-primary)',
          secondary:    'var(--color-text-secondary)',
          label:        'var(--color-text-label)',
          placeholder:  'var(--color-text-placeholder)',
          'on-primary': 'var(--color-text-on-primary)',
          link:         'var(--color-text-link)',
        },
        icon: {
          'on-primary':  'var(--color-icon-on-primary)',
          placeholder:   'var(--color-icon-placeholder)',
          error:         'var(--color-icon-error)',
        },
        border: {
          input: 'var(--color-border-input-default)',
          error: 'var(--color-border-input-error)',
        },
        semantic: {
          error: 'var(--color-semantic-error)',
        },
      },
      fontSize: {
        // Headings — Bold, lineHeight 1.5
        'h1': ['40px', { lineHeight: '60px' }],
        'h2': ['28px', { lineHeight: '42px' }],
        'h3': ['24px', { lineHeight: '36px' }],
        'h4': ['20px', { lineHeight: '30px' }],
        'h5': ['16px', { lineHeight: '24px' }],
        // Body 16 — lineHeight 1.6
        'body-16': ['16px', { lineHeight: '26px' }],
        // Body 14 — lineHeight 1.4
        'body-14': ['14px', { lineHeight: '20px' }],
        // Body 12 — lineHeight 1.4
        'body-12': ['12px', { lineHeight: '17px' }],
      },
      fontFamily: {
        'manrope':          ['Manrope_400Regular'],
        'manrope-medium':   ['Manrope_500Medium'],
        'manrope-semibold': ['Manrope_600SemiBold'],
        'manrope-bold':     ['Manrope_700Bold'],
      },
      letterSpacing: {
        'default': '0.2px',
      },
    },
  },
  plugins: [],
};
