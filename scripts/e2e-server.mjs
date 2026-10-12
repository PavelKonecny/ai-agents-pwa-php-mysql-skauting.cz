// Server pro testy Playwright (npm run e2e): sestavený balík dist-nahrat/ přes `php -S` nad čerstvou
// SQLite databází v dočasné složce – každé spuštění testů začíná s prázdnou aplikací.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist-nahrat');
const PHP = process.env.PHP_BIN || 'php';
const port = Number(process.env.E2E_PORT || 8190);

if (spawnSync(PHP, ['-v']).status !== 0) {
  console.error('Nenašel jsem PHP. Nainstaluj PHP 8.1+ (s pdo_sqlite) nebo nastav proměnnou PHP_BIN na cestu k php.');
  process.exit(1);
}
if (!existsSync(join(dist, 'index.html'))) {
  console.error('Chybí sestavený balík dist-nahrat/. Spusť nejdřív: npm run dist');
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), 'app-e2e-'));
const cfg = join(dir, 'config.php');
writeFileSync(cfg, `<?php return [
    'db' => ['dsn' => 'sqlite:' . ${JSON.stringify(join(dir, 'e2e.sqlite'))}],
    'install_key' => 'e2e-instalace',
    'app_url' => 'http://127.0.0.1:${port}/',
    'debug' => true,
];\n`);

const srv = spawn(PHP, ['-S', `127.0.0.1:${port}`, '-t', dist], { env: { ...process.env, APP_CONFIG: cfg }, stdio: 'inherit' });
const uklid = () => rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
const konec = () => { srv.kill(); uklid(); process.exit(0); };
process.on('SIGINT', konec);
process.on('SIGTERM', konec);
srv.on('exit', (code) => { uklid(); process.exit(code ?? 0); });
