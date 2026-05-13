import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const KDOCS_API = 'https://www.kdocs.cn/api/v3/ide/file/csDYhtk0UKaq/script/V2-3npmjOBLq53lBH7k3XW64z/sync_task'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/cargo': {
        target: KDOCS_API,
        changeOrigin: true,
        rewrite: () => '',
        configure(proxy) {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('AirScript-Token', '6fGqU99bv52z1X4GgGwyoV')
            proxyReq.setHeader('Content-Type', 'application/json')
          })
        },
      },
    },
  },
})
