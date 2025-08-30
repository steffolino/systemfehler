// apps/fe/nuxt.config.ts
import { fileURLToPath } from 'node:url'
import { dirname, resolve as resolvePath } from 'node:path'
const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineNuxtConfig({
  compatibilityDate: '2025-08-01',
  app: {
    head: {
      title: 'systemfehler',
      meta: [
        { name: 'description', content: 'systemfehler - Das Recht auf Teilhabe ist nicht verhandelbar. systemfehler is a digital infrastructure project countering the collapse of the German welfare system with modular, accessible, and open-source solidarity tools. It supports those left behind by bureaucracy, stigma, and digital exclusion.' }
      ],
      link: [
        { rel: "icon", type: "image/png", sizes: "96x96", href: "/favicon-96x96.png" },
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        { rel: "shortcut icon", href: "/favicon.ico" },
        { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
        { rel: "manifest", href: "/site.webmanifest" }
      ]
    },
    // Use the custom error page for 404/500
    error: '~/pages/error.vue'
  },
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
