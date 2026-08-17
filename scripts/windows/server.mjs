import { createServer } from 'node:http';
import { readFile, stat, writeFile, unlink } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const host = '127.0.0.1';
const port = Number(process.env.MEDIA_HUB_PORT ?? process.argv[3] ?? 4173);
const root = resolve(process.argv[2] ?? 'dist/media-hub/browser');
const pidFile = join(process.cwd(), 'media-hub.pid');

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

async function existingFile(pathname) {
  try {
    return (await stat(pathname)).isFile() ? pathname : null;
  } catch {
    return null;
  }
}

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const relative = normalize(decoded).replace(/^([/\\])+/, '');
  const candidate = resolve(root, relative);
  return candidate === root || candidate.startsWith(`${root}${sep}`) ? candidate : null;
}

const server = createServer(async (request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    response.end(JSON.stringify({ status: 'ok', app: 'media-hub' }));
    return;
  }

  if (!['GET', 'HEAD'].includes(request.method ?? 'GET')) {
    response.writeHead(405, { allow: 'GET, HEAD' });
    response.end();
    return;
  }

  try {
    const requested = safePath(request.url ?? '/');
    if (!requested) throw new Error('Invalid path');
    const filePath = await existingFile(requested) ?? join(root, 'index.html');
    const body = await readFile(filePath);
    response.writeHead(200, {
      'content-type': mimeTypes[extname(filePath)] ?? 'application/octet-stream',
      'cache-control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    });
    if (request.method === 'HEAD') response.end();
    else response.end(body);
  } catch {
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Media Hub konnte die angeforderte Datei nicht laden.');
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} ist bereits belegt. Media Hub wurde nicht gestartet.`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});

server.listen(port, host, async () => {
  await writeFile(pidFile, String(process.pid), 'utf8');
  console.log(`Media Hub läuft unter http://${host}:${port}`);
});

async function shutdown() {
  server.close(async () => {
    try { await unlink(pidFile); } catch { /* File may already be gone. */ }
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
