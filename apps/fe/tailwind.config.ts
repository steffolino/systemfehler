import type { Config } from 'tailwindcss'

export default {
  content: [
    './app.vue',
    './error.vue',
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './composables/**/*.{js,ts}',
    './plugins/**/*.{js,ts}',
    './content/**/*.{md,vue}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
  // only if you build class names dynamically:
  safelist: [
    'btn','btn-primary','btn-secondary','btn-accent','btn-ghost','btn-outline','btn-link',
    'badge','alert','card','divider',
    { pattern: /^(bg|text|border|fill|stroke)-(primary|secondary|accent|neutral|info|success|warning|error)$/ },
    { pattern: /^btn-(info|success|warning|error)$/ },
  ],
} satisfies Config
