// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Loopback-only static server for one ui dir. GET/HEAD only, no directory listing, no path traversal.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

const HOST = '127.0.0.1';
const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };

export async function startServer(root) {
  const base = resolve(root);
  const server = createServer(async (req, res) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
      const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const file = resolve(join(base, rel));
      if (file !== base && !file.startsWith(base + sep)) { res.writeHead(403); res.end(); return; }
      const st = await stat(file).catch(() => null);
      if (!st || !st.isFile()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : await readFile(file));
    } catch (e) {
      res.writeHead(400); res.end();
    }
  });
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, HOST, ok); });
  const port = server.address().port;
  return { origin: `http://${HOST}:${port}`, port, close: () => new Promise((ok) => server.close(ok)) };
}
