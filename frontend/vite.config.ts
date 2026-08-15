import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Windows Docker Desktop bind mounts do not deliver inotify events into the
// container. Opt in via VITE_USE_POLLING (set only on the compose frontend
// service) so native host `npm run dev` does not pay continuous CPU cost.
const usePolling =
  process.env.VITE_USE_POLLING === '1' ||
  process.env.VITE_USE_POLLING === 'true'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    ...(usePolling
      ? {
          watch: { usePolling: true, interval: 1000 },
          // Browser reaches the published host port; keep the HMR client
          // websocket on 5173 rather than a container-only address.
          hmr: { clientPort: 5173 },
        }
      : {}),
    proxy: {
      '/api': {
        // Host: localhost. Docker Compose: set VITE_API_PROXY_TARGET=http://backend:8000
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
