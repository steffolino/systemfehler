import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const repoRoot = path.resolve(__dirname, '..')
  const frontendEnv = loadEnv(mode, __dirname, '')
  const rootEnv = loadEnv(mode, repoRoot, '')

  // Keep local frontend/.env behavior, but backfill missing VITE_* keys from repo root .env.
  for (const [key, value] of Object.entries(rootEnv)) {
    if (!key.startsWith('VITE_')) continue
    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = value
    }
  }

  const publicPathRaw = (
    process.env.PUBLIC_PATH ||
    frontendEnv.PUBLIC_PATH ||
    rootEnv.PUBLIC_PATH ||
    '/'
  ).trim()
  const publicPath = publicPathRaw.endsWith('/') ? publicPathRaw : `${publicPathRaw}/`

  return {
    // Base path for project pages; override with PUBLIC_PATH in CI.
    base: publicPath || '/',
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  }
})
