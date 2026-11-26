import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const MIME_BY_EXT: Record<string, string> = {
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8',
};

function localCustomPackMiddleware(): Plugin {
  const packRoot = path.resolve(__dirname, '.krunked-quest-assets');
  return {
    name: 'krunked-local-pack-middleware',
    configureServer(server) {
      server.middlewares.use('/.krunked-quest-assets', (req, res, next) => {
        if (!req.url) {
          next();
          return;
        }
        const cleanPath = decodeURIComponent(req.url.split('?')[0] || '');
        const resolved = path.resolve(packRoot, '.' + cleanPath);
        if (!resolved.startsWith(packRoot) || !fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }
        const ext = path.extname(resolved).toLowerCase();
        res.setHeader('Content-Type', MIME_BY_EXT[ext] ?? 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-cache');
        fs.createReadStream(resolved).pipe(res);
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [localCustomPackMiddleware()],
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    outDir: 'dist',
    emptyOutDir: true,
  },
});
