import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const repoRoot = path.resolve(__dirname, '..')
  const rootEnv = loadEnv(mode, repoRoot, '')
  const publicPathRaw = (process.env.PUBLIC_PATH || rootEnv.PUBLIC_PATH || '/').trim()
  const publicPath = publicPathRaw.endsWith('/') ? publicPathRaw : `${publicPathRaw}/`

  return {
    // Read .env from repo root so frontend and backend share one env source.
    envDir: repoRoot,
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
