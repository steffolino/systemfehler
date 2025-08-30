// vite.config.js or nuxt.config.ts
export default {
  optimizeDeps: {
    include: ['buffer']
  },
  define: {
    'process.env': {},
    'global': 'globalThis'
  },
  resolve: {
    alias: {
      buffer: 'buffer/'
    }
  }
}
