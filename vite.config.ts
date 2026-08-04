import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const UPSTREAM = 'https://demo.traccar.org'

// ponytail: en dev el proxy de Vite reemplaza a la funcion serverless.
// Mismo contrato de URL en ambos entornos: /api/traccar/<recurso>
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const auth = Buffer.from(
    `${env.TRACCAR_EMAIL ?? ''}:${env.TRACCAR_PASSWORD ?? ''}`,
  ).toString('base64')

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': resolve(__dirname, './src') },
    },
    server: {
      proxy: {
        '/api/traccar': {
          target: UPSTREAM,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/traccar/, '/api'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Authorization', `Basic ${auth}`)
            })
          },
        },
      },
    },
  }
})
