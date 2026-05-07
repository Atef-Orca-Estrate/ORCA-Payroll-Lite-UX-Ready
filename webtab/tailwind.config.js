export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Geist first — falls back to system SF Pro / Segoe UI if not yet loaded
        sans: ['Geist', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      colors: {
        // CSS-var-backed tokens for use in Tailwind utilities
        // e.g. bg-accent, text-accent-text, border-accent-border
        accent: {
          DEFAULT: 'var(--accent)',
          dark:    'var(--accent-dark)',
          bg:      'var(--accent-bg)',
          border:  'var(--accent-border)',
          text:    'var(--accent-text)',
          muted:   'var(--accent-muted)',
        },
        surface: {
          DEFAULT: 'var(--surface)',
          raised:  'var(--surface-raised)',
          inset:   'var(--surface-inset)',
        },
        brand: {
          sidebar: '#0F172A',
        },
      },
    },
  },
  plugins: [],
}
