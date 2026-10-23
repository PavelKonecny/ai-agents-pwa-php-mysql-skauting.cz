// npm run test:mysql – testy API nad MySQL/MariaDB. Produkce na hostingu běží na MariaDB, výchozí testy nad SQLite.
// Potřebuje proměnné prostředí:
//   TEST_MYSQL_DSN       např. mysql:host=127.0.0.1;port=3306   (bez dbname – každý běh si založí vlastní databázi)
//   TEST_MYSQL_USER      uživatel, který smí zakládat a mazat databáze (výchozí root)
//   TEST_MYSQL_PASSWORD  heslo
// Lokálně třeba:  docker run -d -p 3306:3306 -e MARIADB_ROOT_PASSWORD=test mariadb:11.4
import { spawnSync } from 'node:child_process';

if (!process.env.TEST_MYSQL_DSN) {
  console.error('Chybí TEST_MYSQL_DSN (např. mysql:host=127.0.0.1;port=3306). Viz komentář v scripts/test-mysql.mjs.');
  process.exit(1);
}
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
for (const [cmd, args] of [['node', ['scripts/build-php.mjs']], [npx, ['vitest', 'run', 'tests/api.test.ts']]]) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
