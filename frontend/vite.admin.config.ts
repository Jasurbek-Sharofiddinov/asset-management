import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

// Windows Docker Desktop bind mounts skip inotify; opt in via VITE_USE_POLLING
// (set on the compose frontend-admin service only).
const usePolling =
  process.env.VITE_USE_POLLING === '1' ||
  process.env.VITE_USE_POLLING === 'true'

const CONSOLE_ENTRY = '/admin.html'

/**
 * `build.rollupOptions.input` only steers the production bundle. Without this,
 * the dev server still resolves `/` (and every client route) to the default
 * `index.html`, which boots the *tenant* SPA on :5174 — its login form posts to
 * /api/auth/login and rejects platform operators. Serve admin.html instead.
 */
function platformConsoleEntry(): Plugin {
  return {
    name: 'platform-console-entry',
    configureServer(server) {
      // Registered here so it runs ahead of Vite's html + proxy middlewares.
      server.middlewares.use((req, _res, next) => {
        const url = req.url ?? '/'
        const pathname = url.split('?')[0]
        const isNavigation =
          (req.method === 'GET' || req.method === 'HEAD') &&
          (req.headers.accept ?? '').includes('text/html')
        // Module graph, HMR client and the API proxy must pass through intact.
        const isInternal =
          pathname.startsWith('/@') ||
          pathname.startsWith('/src/') ||
          pathname.startsWith('/node_modules/') ||
          pathname.startsWith('/api/')
        const isStaticFile = pathname !== '/' && /\.[^/]+$/.test(pathname)

        if (
          isNavigation &&
          !isInternal &&
          (!isStaticFile || pathname === '/index.html')
        ) {
          req.url = CONSOLE_ENTRY + url.slice(pathname.length)
        }
        next()
      })
    },
  }
}

// Separate Vite config so the platform console never shares a rollup graph
// with the tenant SPA (index.html → dist/). Output: dist-admin/
export default defineConfig({
  plugins: [react(), tailwindcss(), platformConsoleEntry()],
  build: {
    outDir: 'dist-admin',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'admin.html'),
    },
  },
  server: {
    port: 5174,
    ...(usePolling
      ? {
          watch: { usePolling: true, interval: 1000 },
          hmr: { clientPort: 5174 },
        }
      : {}),
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
