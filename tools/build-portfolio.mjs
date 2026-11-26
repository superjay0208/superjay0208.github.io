// Usage: node tools/build-portfolio.mjs <Slide Projector checkout>
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const site = fileURLToPath(new URL('../', import.meta.url));
const projectorSource = process.argv[2];
if (!projectorSource) throw new Error('Supply the Slide Projector checkout, which provides Three.js and Rolldown.');
const require = createRequire(resolve(projectorSource, 'package.json'));
const threeRoot = dirname(dirname(require.resolve('three')));
const { rolldown } = await import(pathToFileURL(require.resolve('rolldown')));
const output = await rolldown({
  input: resolve(site, 'portfolio/room.mjs'),
  plugins: [{
    name: 'projector-three',
    resolveId(id) {
      if (id === 'three') return resolve(threeRoot, 'build/three.module.js');
      if (id.startsWith('three/addons/')) return resolve(threeRoot, 'examples/jsm', id.slice('three/addons/'.length));
    }
  }]
});
const bundleFile = resolve(site, 'assets/portfolio/room.bundle.mjs');
await output.write({
  file: bundleFile,
  format: 'es',
  minify: true,
  banner: '/*! Contains Three.js (MIT). See THREE-LICENSE.txt in this directory. */'
});
await output.close();

// Normalize indentation in the embedded upstream shader strings.
const bundle = await readFile(bundleFile, 'utf8');
await writeFile(bundleFile, bundle
  .replace(/^[ \t]+/gm, indent => indent.replaceAll('\t', '  '))
  .replace(/[ \t]+$/gm, ''));