import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

// Servidor Vite isolado para os testes:
// - envDir aponta para tests/ (sem arquivos .env): o resultado não depende do .env.local de quem roda;
// - cacheDir próprio: não apaga o cache de dependências de um `pnpm dev` aberto (página em branco / 504).
export function createTestServer() {
  return createServer({
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: 'custom',
    envDir: fileURLToPath(new URL('.', import.meta.url)),
    cacheDir: 'node_modules/.vite-test',
    logLevel: 'error',
  })
}
