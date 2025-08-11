// nuxt.config.ts
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: '2025-08-01',
  runtimeConfig: {
    public: {
      apiBase: process.env.VITE_API_BASE
    }
  },
  devtools: { enabled: true },
  modules: ['@nuxt/content', '@nuxt/eslint', '@nuxt/ui', '@nuxtjs/i18n', '@nuxtjs/color-mode'],
  css: ['../assets/css/main.css'],
  tailwindcss: {
    viewer: false,
  },
  vite: {
    plugins: [tailwindcss()],
  },
  i18n: {
    locales: [
      {
        code: 'en',
        name: 'English',
        file: 'en.json',
      },
      {
        code: 'de',
        name: 'Deutsch',
        file: 'de.json',
      },
    ],
    defaultLocale: 'en',
    lazy: true,
    langDir: 'locales/',
    strategy: 'prefix_except_default',
  }
})
