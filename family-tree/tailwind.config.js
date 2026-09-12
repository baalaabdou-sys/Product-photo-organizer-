/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        'ink-soft': 'rgb(var(--c-ink-soft) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        faint: 'rgb(var(--c-faint) / <alpha-value>)',
        paper: 'rgb(var(--c-paper) / <alpha-value>)',
        'paper-2': 'rgb(var(--c-paper-2) / <alpha-value>)',
        'paper-3': 'rgb(var(--c-paper-3) / <alpha-value>)',
        rule: 'rgb(var(--c-rule) / <alpha-value>)',
        gold: 'rgb(var(--c-gold) / <alpha-value>)',
        'gold-soft': 'rgb(var(--c-gold-soft) / <alpha-value>)',
        zellige: 'rgb(var(--c-zellige) / <alpha-value>)',
      },
      fontFamily: {
        serif: ['var(--font-serif)'],
        sans: ['var(--font-sans)'],
      },
      letterSpacing: { label: '0.18em', wide2: '0.28em' },
      boxShadow: {
        lift: '0 1px 2px rgb(var(--c-shadow)/0.05), 0 8px 24px -10px rgb(var(--c-shadow)/0.18)',
        'lift-lg': '0 2px 4px rgb(var(--c-shadow)/0.06), 0 28px 60px -24px rgb(var(--c-shadow)/0.30)',
        sheet: '0 -8px 60px -20px rgb(var(--c-shadow)/0.35)',
      },
      transitionTimingFunction: {
        editorial: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
