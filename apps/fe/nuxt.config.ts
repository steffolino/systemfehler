// apps/fe/nuxt.config.ts
import { fileURLToPath } from 'node:url'
import { dirname, resolve as resolvePath } from 'node:path'
const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineNuxtConfig({
  compatibilityDate: '2025-08-01',
  runtimeConfig: {
    public: {
      apiBase: process.env.VITE_API_BASE,
      searchBase: process.env.NUXT_PUBLIC_SEARCH_BASE || 'http://localhost:8000'
    }
  },
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxt/ui', '@nuxtjs/i18n', '@nuxtjs/color-mode', '@nuxt/icon'],
  css: [resolvePath(__dirname, 'assets/css/main.css')], // absolute path
  postcss: {
    plugins: {
      '@tailwindcss/postcss': {},
      autoprefixer: {}
    }
  },
    i18n: {
    locales: [
      { code: 'en', name: 'English', file: 'en.json' },
      { code: 'de', name: 'Deutsch', file: 'de.json' },
    ],
    defaultLocale: 'en',
    lazy: true,
    langDir: 'locales/',
    strategy: 'prefix_except_default',
  },
  colorMode: { classSuffix: '' },
  vite: { plugins: [] }
})
