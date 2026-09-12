/** Node's ESM resolver needs explicit extensions; tsc emits them bare. */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p);
    else if (extname(p) === '.js') {
      const src = await readFile(p, 'utf8');
      const out = src.replace(
        /(from\s+['"])(\.\.?\/[^'"]+?)(['"])/g,
        (m, a, spec, z) => (extname(spec) ? m : `${a}${spec}.js${z}`),
      );
      if (out !== src) await writeFile(p, out);
    }
  }
}
await walk('.testbuild');
console.log('import specifiers fixed');
