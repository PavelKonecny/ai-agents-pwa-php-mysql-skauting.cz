// Lokální PHP API nad SQLite pro vývoj:  npm run api  (v druhém terminálu  npm run dev)
// Při prvním spuštění vytvoří api/config.php pro SQLite a vypíše pozvánku správce.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PHP = process.env.PHP_BIN || 'php';
if (spawnSync(PHP, ['-v']).status !== 0) {
  console.error('Nenašel jsem PHP. Nainstaluj PHP 8.1+ (s pdo_sqlite) nebo nastav proměnnou PHP_BIN na cestu k php.');
  process.exit(1);
}
spawnSync(process.execPath, [join(root, 'scripts/build-php.mjs')], { stdio: 'inherit' });

const cfg = join(root, 'api/config.php');
if (!existsSync(cfg)) {
  writeFileSync(cfg, `<?php return [
    'db' => ['dsn' => 'sqlite:' . __DIR__ . '/data/app.sqlite'],
    'install_key' => 'lokalni-vyvoj',
    'app_url' => 'http://localhost:5190/',
    'skautis' => ['appid' => '', 'test' => true],
    'debug' => true,
];\n`);
  console.log('Vytvořeno api/config.php pro lokální vývoj (SQLite v api/data/).');
}

const port = 8095;
const srv = spawn(PHP, ['-S', `127.0.0.1:${port}`, '-t', join(root, 'api')], { stdio: 'inherit' });
setTimeout(async () => {
  try {
    const html = await (await fetch(`http://127.0.0.1:${port}/install.php?key=lokalni-vyvoj`)).text();
    const odkaz = html.match(/href="([^"]*#\/pozvanka[^"]*)"/)?.[1];
    console.log(odkaz ? `\nPozvánka správce (otevři po spuštění npm run dev):\n${odkaz.replace(/&amp;/g, '&')}\n` : '\nSprávce už existuje (pozvánku najdeš v prohlížeči, kde jsi ji otevřel).\n');
  } catch { /* server ještě neběží */ }
}, 1200);
process.on('SIGINT', () => { srv.kill(); process.exit(0); });
