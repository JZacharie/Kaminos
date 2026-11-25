// Loads core.js + every block in a vm sandbox with a permissive DOM stub and returns the registered schemas.
// Used by gen-catalog.mjs and tests/kit/blocks-catalog.test.mjs. No browser needed.
import vm from 'node:vm';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

const stub = () => {
  const f = function () {};
  return new Proxy(f, {
    get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'readyState' ? 'complete' : stub()),
    apply: () => stub(),
    construct: () => stub(),
    set: () => true,
  });
};

/** @returns {{name: string, version: string, schema: object}[]} */
export function loadSchemas(dir = HERE) {
  const win = { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }), getComputedStyle: () => stub(), location: { hash: '', href: 'http://x/' }, devicePixelRatio: 1 };
  const ctx = {
    window: win, document: stub(), console: { warn() {}, log() {}, error() {} }, setTimeout() {}, clearTimeout() {}, requestAnimationFrame() {},
    location: win.location, navigator: {}, getComputedStyle: () => stub(), URL, Date, Math, JSON, Object, Array, String, Number, RegExp, Error, isNaN, parseFloat, parseInt, Intl,
    ResizeObserver: class { observe() {} disconnect() {} }, MutationObserver: class { observe() {} disconnect() {} }, HTMLElement: class {}, Node: class {},
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  const files = ['core.js', join('..', 'data', 'basemap.js'), 'media.lib.js', ...readdirSync(dir).filter((f) => /^[a-z][a-z0-9]*\.js$/.test(f) && f !== 'core.js').sort()];
  for (const f of files) vm.runInContext(readFileSync(join(dir, f), 'utf8'), ctx, { filename: f });
  return JSON.parse(vm.runInContext('JSON.stringify(window.K.block.list())', ctx));
}
