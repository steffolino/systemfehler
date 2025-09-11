// apps/fe/nuxt.config.ts
export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2025-09-01',
  nitro: {
    preset: 'cloudflare-pages'
  },
  app: {
    head: {
      title: 'systemfehler',
      meta: [
        { name: 'description', content: 'systemfehler - Das Recht auf Teilhabe ist nicht verhandelbar. systemfehler is a digital infrastructure project countering the collapse of the German welfare system with modular, accessible, and open-source solidarity tools. It supports those left behind by bureaucracy, stigma, and digital exclusion.' }
      ],
      link: [
        { rel: "icon", type: "image/png", sizes: "96x96", href: "/img/favicon-96x96.png" },
        { rel: "icon", type: "image/svg+xml", href: "/img/favicon.svg" },
        { rel: "shortcut icon", href: "/img/favicon.ico" },
        { rel: "apple-touch-icon", sizes: "180x180", href: "/img/apple-touch-icon.png" },
        { rel: "manifest", href: "/img/site.webmanifest" }
      ]
    }
  },
  runtimeConfig: {
    public: {
      apiBase:
        process.env.NODE_ENV === "production"
          ? "https://systemfehler.inequality.workers.dev"
          : "http://localhost:3001",
      searchBase:
        process.env.NODE_ENV === "production"
          ? "https://systemfehler.inequality.workers.dev/api/search"
          : "http://localhost:3001/api/search"
    }
  },
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxt/ui', '@nuxtjs/i18n', '@nuxtjs/color-mode', '@nuxt/icon'],
  css: [__dirname + '/assets/css/main.css'], // absolute path
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
  vite: {
    plugins: [],
    resolve: {
      alias: {
        'node:buffer': false as unknown as string,
        'node:events': false as unknown as string,
        'node:process': false as unknown as string,
        'node:stream': false as unknown as string,
        'node:util': false as unknown as string,
        'node:crypto': false as unknown as string,
        'node:path': false as unknown as string,
        'node:url': false as unknown as string,
        'node:fs': false as unknown as string,
        'node:http': false as unknown as string,
        'node:https': false as unknown as string
      }
    },
    server: {
      proxy: {
        '/api': {
          target: 'https://systemfehler.inequality.workers.dev',
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/api/, '/api')
        }
      }
    }
  }
})