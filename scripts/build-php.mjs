// 1) vygeneruje api/lib/schema.php ze shared/schema.ts (jediný zdroj pravdy pro tabulky, sloupce a role),
// 2) s přepínačem --dist složí aplikaci (dist/) + api/ do dist-nahrat/ – přesně to, co jde na hosting.
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const tmp = join(tmpdir(), `schema-${process.pid}.mjs`);
await build({ entryPoints: [join(root, 'shared/schema.ts')], bundle: true, format: 'esm', outfile: tmp, logLevel: 'silent' });
const schema = await import(pathToFileURL(tmp).href);
rmSync(tmp, { force: true });

const php = (v) => {
  if (Array.isArray(v)) return `[${v.map(php).join(', ')}]`;
  if (v && typeof v === 'object') return `[${Object.entries(v).map(([k, x]) => `${php(k)} => ${php(x)}`).join(', ')}]`;
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
};

writeFileSync(join(root, 'api/lib/schema.php'), `<?php
// GENEROVANÝ SOUBOR – neupravovat. Zdroj: shared/schema.ts. Sestavení: npm run build / npm test
declare(strict_types=1);

const APLIKACE = ${php(schema.APLIKACE)};
const ROLE = ${php([...schema.ROLE])};
const TABULKY = ${php(schema.TABULKY)};
const META = ${php([...schema.META])};
const MAX_HODNOTA = ${schema.MAX_HODNOTA};
`);
console.log('Vygenerováno api/lib/schema.php');

if (process.argv.includes('--dist')) {
  if (!existsSync(join(root, 'dist/index.html'))) throw new Error('Nejdřív sestav aplikaci: npm run build');
  const cil = join(root, 'dist-nahrat');
  // vyprázdnit obsah, ne celou složku – může ji mít otevřenou FTP klient nebo Průzkumník
  mkdirSync(cil, { recursive: true });
  for (const f of readdirSync(cil)) rmSync(join(cil, f), { recursive: true, force: true });
  cpSync(join(root, 'dist'), cil, { recursive: true });
  cpSync(join(root, 'api'), join(cil, 'api'), {
    recursive: true,
    filter: (src) => !/config\.php$|\.sqlite|[\\/]data[\\/][^.]/.test(src),
  });
  cpSync(join(root, 'scripts/htaccess-root'), join(cil, '.htaccess'));
  console.log('Složeno do dist-nahrat/ – to je obsah kořene webu na hostingu (config.php se nenahrává).');
}
