import { createServer } from 'node:http';
import { readFile, stat, writeFile, unlink } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

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

function safePath(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const relative = normalize(decoded).replace(/^([/\\])+/, '');
  const candidate = resolve(root, relative);
  return candidate === root || candidate.startsWith(`${root}${sep}`) ? candidate : null;
}

export async function startServer({ root, port = 4173, host = '127.0.0.1', pidFile } = {}) {
  const resolvedRoot = resolve(root ?? 'dist/media-hub/browser');

  const server = createServer(async (request, response) => {
    if (request.url === '/health') {
      response.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      });
      response.end(JSON.stringify({ status: 'ok', app: 'media-hub' }));
      return;
    }

    if (!['GET', 'HEAD'].includes(request.method ?? 'GET')) {
      response.writeHead(405, { allow: 'GET, HEAD' });
      response.end();
      return;
    }

    try {
      const requested = safePath(resolvedRoot, request.url ?? '/');
      if (!requested) throw new Error('Invalid path');
      const filePath = (await existingFile(requested)) ?? join(resolvedRoot, 'index.html');
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

  await new Promise((resolvePromise, rejectPromise) => {
    server.once('error', rejectPromise);
    server.listen(port, host, () => {
      server.removeListener('error', rejectPromise);
      resolvePromise();
    });
  });

  server.on('error', (error) => console.error(error));

  if (pidFile) await writeFile(pidFile, String(process.pid), 'utf8');
  return { server, root: resolvedRoot, port, host, pidFile };
}

export function stopServer(instance) {
  if (!instance?.server) return Promise.resolve();
  const { server, pidFile } = instance;
  return new Promise((resolvePromise) => {
    server.close(async () => {
      if (pidFile) {
        try {
          await unlink(pidFile);
        } catch {
          /* File may already be gone. */
        }
      }
      resolvePromise();
    });
    server.closeAllConnections?.();
  });
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  const pidFile = join(process.cwd(), 'media-hub.pid');
  try {
    const instance = await startServer({
      root: process.argv[2] ?? 'dist/media-hub/browser',
      port: Number(process.env.MEDIA_HUB_PORT ?? process.argv[3] ?? 4173),
      pidFile,
    });
    console.log(`Media Hub läuft unter http://${instance.host}:${instance.port}`);

    const shutdown = () => stopServer(instance).then(() => process.exit(0));
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    if (error?.code === 'EADDRINUSE') {
      console.error('Port ist bereits belegt. Media Hub wurde nicht gestartet.');
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  }
}
