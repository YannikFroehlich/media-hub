// Zero-dependency smoke test using Node's built-in test runner:
//   node --test scripts/windows/server.test.mjs
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { startServer, stopServer } from './server.mjs';

async function withServer(fn) {
  const root = await mkdtemp(join(tmpdir(), 'media-hub-server-test-'));
  await writeFile(join(root, 'index.html'), '<html>shell</html>');
  await writeFile(join(root, 'ngsw.json'), '{}');
  await writeFile(join(root, 'ngsw-worker.js'), '// sw');
  await writeFile(join(root, 'manifest.webmanifest'), '{}');
  await writeFile(join(root, 'main-ABC123.js'), '// hashed bundle');

  const instance = await startServer({ root, port: 0 });
  try {
    await fn(`http://${instance.host}:${instance.port}`);
  } finally {
    await stopServer(instance);
    await rm(root, { recursive: true, force: true });
  }
}

test('entry-point files (index.html, ngsw.json, ngsw-worker.js, manifest.webmanifest) are never cached long-term', async () => {
  await withServer(async (base) => {
    for (const file of ['index.html', 'ngsw.json', 'ngsw-worker.js', 'manifest.webmanifest']) {
      const response = await fetch(`${base}/${file}`);
      assert.equal(response.headers.get('cache-control'), 'no-cache', file);
    }
  });
});

test('hashed build files are cached immutably', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/main-ABC123.js`);
    assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  });
});

test('responses declare an explicit content-length instead of chunked transfer', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/ngsw-worker.js`);
    assert.equal(response.headers.get('content-length'), String('// sw'.length));
    assert.notEqual(response.headers.get('transfer-encoding'), 'chunked');
  });
});
