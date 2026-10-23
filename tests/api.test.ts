// Testy PHP API přes skutečný server `php -S` nad SQLite. Běží, jen když je k dispozici PHP
// (proměnná PHP_BIN nebo `php` v PATH); v GitHub Actions se PHP instaluje automaticky.
// Nová akce = nový test sem (oprávnění + hlavní scénář + chybový vstup).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PHP = process.env.PHP_BIN || 'php';
const maPhp = spawnSync(PHP, ['-v']).status === 0;
// v CI se testy API bez PHP nesmí tiše přeskočit
if (!maPhp && process.env.CI) throw new Error('Testy API potřebují PHP (proměnná PHP_BIN nebo php v PATH).');
// npm run test:mysql: stejná sada nad MySQL/MariaDB – TEST_MYSQL_DSN (např. mysql:host=127.0.0.1;port=3306),
// TEST_MYSQL_USER a TEST_MYSQL_PASSWORD (uživatel smí zakládat databáze); každý běh má vlastní prázdnou databázi.
const MYSQL = process.env.TEST_MYSQL_DSN ?? '';
const MYSQL_USER = process.env.TEST_MYSQL_USER ?? 'root';
const MYSQL_HESLO = process.env.TEST_MYSQL_PASSWORD ?? '';
const MYSQL_DB = `skaut_test_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
/** Spustí PHP s připojením k testovací databázi ($p = PDO) a vrátí výstup. */
function phpDb(kod: string): string {
  const pripoj = MYSQL
    ? `$p = new PDO($argv[1] . ';dbname=' . $argv[4] . ';charset=utf8mb4', $argv[2], $argv[3]);`
    : `$p = new PDO('sqlite:' . $argv[1]);`;
  const r = spawnSync(PHP, ['-r', pripoj + kod, MYSQL || dbFile, MYSQL_USER, MYSQL_HESLO, MYSQL_DB], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`PHP: ${r.stderr || r.stdout}`);
  return r.stdout;
}
/** Celý obsah databáze jako bajty (kontrola, že tam něco NENÍ – třeba token v čitelné podobě). */
function obsahDb(): Buffer {
  if (!MYSQL) return readFileSync(dbFile);
  return Buffer.from(phpDb(`foreach ($p->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $t) foreach ($p->query("SELECT * FROM \`$t\`")->fetchAll(PDO::FETCH_ASSOC) as $r) echo implode("\t", array_map('strval', $r)), "\n";`));
}
/** Konfigurace databáze pro config.php testovacího serveru. */
const dbConfig = () => (MYSQL
  ? `['dsn' => ${JSON.stringify(`${MYSQL};dbname=${MYSQL_DB};charset=utf8mb4`)}, 'user' => ${JSON.stringify(MYSQL_USER)}, 'password' => ${JSON.stringify(MYSQL_HESLO)}]`
  : `['dsn' => 'sqlite:' . ${JSON.stringify(dbFile)}]`);
/** Vysoké limity požadavků pro běžné testy (mnoho požadavků z 127.0.0.1); limity samotné testuje vlastní server. */
const BEZ_LIMITU = `'limity' => ['ip' => 100000, 'token' => 100000, 'anonymni' => 100000, 'drahe' => 100000]`;
const API = join(__dirname, '..', 'api');
const PORT = 18100 + Math.floor(Math.random() * 800);
const B = `http://127.0.0.1:${PORT}`;
/** install.php – klíč jen formulářem (POST), nikdy v adrese. */
const instalace = (key: string, dalsi = false) => fetch(`${B}/install.php`, { method: 'POST', body: new URLSearchParams({ key, ...(dalsi ? { dalsi: '1' } : {}) }) });

let server: ChildProcess | undefined;
let dir = '';
let dbFile = '';
let t = Date.parse('2026-10-05T10:00:00Z');

async function call<T>(req: Record<string, unknown>): Promise<T> {
  t += 1000;
  const res = await fetch(`${B}/index.php`, { method: 'POST', body: JSON.stringify({ ...req, _now: new Date(t).toISOString() }) });
  const j = await res.json();
  if (!j.ok) throw Object.assign(new Error(`${j.error.code}: ${j.error.message}`), { code: j.error.code });
  return j.data as T;
}
async function chyba(req: Record<string, unknown>): Promise<string> {
  try { await call(req); } catch (e) { return (e as { code: string }).code; }
  throw new Error('mělo selhat');
}

describe.skipIf(!maPhp)(`API (PHP + ${MYSQL ? 'MySQL' : 'SQLite'})`, () => {
  let admin = '';
  let clen = '';

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'skaut-app-'));
    dbFile = join(dir, 'test.sqlite');
    if (MYSQL) {
      const r = spawnSync(PHP, ['-r', '$p = new PDO($argv[1], $argv[2], $argv[3]); $p->exec("CREATE DATABASE `" . $argv[4] . "` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin");', MYSQL, MYSQL_USER, MYSQL_HESLO, MYSQL_DB], { encoding: 'utf8' });
      if (r.status !== 0) throw new Error(`Testovací databázi se nepodařilo založit: ${r.stderr || r.stdout}`);
    }
    const cfg = join(dir, 'config.php');
    writeFileSync(cfg, `<?php return ['db' => ${dbConfig()}, 'install_key' => 'test-klic-123', 'app_url' => 'http://localhost/', 'test' => true, 'debug' => true, ${BEZ_LIMITU}];`);
    server = spawn(PHP, ['-S', `127.0.0.1:${PORT}`, '-t', API], { env: { ...process.env, APP_CONFIG: cfg }, stdio: 'ignore' });
    for (let i = 0; i < 50; i++) {
      try { if ((await fetch(`${B}/index.php`)).ok) break; } catch { /* ještě neběží */ }
      await new Promise((r) => setTimeout(r, 100));
    }
    const html = await (await instalace('test-klic-123')).text();
    admin = html.match(/pozvanka\?t=([0-9a-f]+)/)![1];
    clen = (await call<{ token: string }>({ action: 'pristupy.create', token: admin, role: 'clen', prezdivka: 'Veverka' })).token;
  }, 30000);

  afterAll(() => {
    server?.kill();
    if (MYSQL) spawnSync(PHP, ['-r', '$p = new PDO($argv[1], $argv[2], $argv[3]); $p->exec("DROP DATABASE IF EXISTS `" . $argv[4] . "`");', MYSQL, MYSQL_USER, MYSQL_HESLO, MYSQL_DB]);
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* Windows může soubor ještě držet */ }
  });

  it('instalace je opakovatelná a chráněná klíčem', async () => {
    expect(await (await instalace('test-klic-123')).text()).toContain('Správce už existuje');
    expect((await instalace('spatne')).status).toBe(403);
    // klíč v adrese se nepřijímá (zůstal by v logu serveru a historii prohlížeče)
    expect(await (await fetch(`${B}/install.php?key=test-klic-123`)).text()).not.toMatch(/pozvanka\?t=/);
    // dalšího správce přes web nejde (jen v aplikaci nebo php api/spravce.php --dalsi)
    const dalsi = await (await instalace('test-klic-123', true)).text();
    expect(dalsi).toContain('Správce už existuje');
    expect(dalsi).not.toMatch(/pozvanka\?t=/);
  });

  it('přihlášení tokenem; token se ukládá jen jako otisk', async () => {
    const h = await call<{ ja: { role: string; prezdivka: string } }>({ action: 'hello', token: clen });
    expect(h.ja).toMatchObject({ role: 'clen', prezdivka: 'Veverka' });
    expect(await chyba({ action: 'hello', token: 'x'.repeat(40) })).toBe('unauthorized');
    expect(obsahDb().includes(Buffer.from(clen))).toBe(false);
  });

  it('správu přístupů smí jen správce; zrušení a nový odkaz', async () => {
    expect(await chyba({ action: 'pristupy.list', token: clen })).toBe('forbidden');
    expect(await chyba({ action: 'pristupy.create', token: clen, role: 'admin', prezdivka: 'X' })).toBe('forbidden');
    const t2 = (await call<{ token: string }>({ action: 'pristupy.create', token: admin, role: 'clen', prezdivka: 'Řízek' })).token;
    const ja = (await call<{ ja: { id: string } }>({ action: 'hello', token: t2 })).ja;
    const novy = (await call<{ token: string }>({ action: 'pristupy.relink', token: admin, id: ja.id })).token;
    expect(await chyba({ action: 'hello', token: t2 })).toBe('unauthorized');
    expect((await call<{ ja: { id: string } }>({ action: 'hello', token: novy })).ja.id).toBe(ja.id);
    await call({ action: 'pristupy.revoke', token: admin, id: ja.id });
    expect(await chyba({ action: 'hello', token: novy })).toBe('unauthorized');
  });

  it('ukázkové položky: přidat, upravit, smazat jen správce', async () => {
    const p = await call<{ id: string; updatedBy: string }>({ action: 'polozky.uloz', token: clen, nazev: 'Koupit lana' });
    expect(p.updatedBy).toBe('Veverka');
    await call({ action: 'polozky.uloz', token: clen, id: p.id, nazev: 'Koupit lana', hotovo: '1' });
    const list = await call<{ id: string; hotovo: string }[]>({ action: 'polozky.list', token: clen });
    expect(list.find((x) => x.id === p.id)?.hotovo).toBe('1');
    expect(await chyba({ action: 'polozky.smaz', token: clen, id: p.id })).toBe('forbidden');
    await call({ action: 'polozky.smaz', token: admin, id: p.id });
    expect((await call<{ id: string }[]>({ action: 'polozky.list', token: clen })).some((x) => x.id === p.id)).toBe(false);
    expect(await chyba({ action: 'polozky.uloz', token: clen, nazev: '' })).toBe('bad_request');
  });

  it('skautIS: bez platného kódu nic nepustí; vypnutý skautIS nemá přihlašovací adresu', async () => {
    expect((await call<{ skautis: string }>({ action: 'info' })).skautis).toBe('');
    expect(await chyba({ action: 'skautis.prihlasit', kod: 'neexistuje' })).toBe('skautis');
  });

  it('přístup, který se rok nepoužil, vyprší; nový odkaz ho obnoví', async () => {
    const t3 = (await call<{ token: string }>({ action: 'pristupy.create', token: admin, role: 'clen', prezdivka: 'Sova' })).token;
    const ja = (await call<{ ja: { id: string } }>({ action: 'hello', token: t3 })).ja;
    t += 200 * 86400000;
    await call({ action: 'hello', token: admin });
    await call({ action: 'hello', token: clen }); // ostatní testy pokračují s aktivním členem
    t += 200 * 86400000;
    await call({ action: 'hello', token: clen });
    expect(await chyba({ action: 'hello', token: t3 })).toBe('unauthorized');
    const novy = (await call<{ token: string }>({ action: 'pristupy.relink', token: admin, id: ja.id })).token;
    expect((await call<{ ja: { id: string } }>({ action: 'hello', token: novy })).ja.id).toBe(ja.id);
  });

  it('pomocné funkce: odkaz() jen http(s), verejnaAdresa() nepustí do vnitřní sítě', () => {
    const kod = `require ${JSON.stringify(join(API, 'lib', 'core.php'))};
      $o = function ($v) { try { return odkaz(['u' => $v], 'u'); } catch (Chyba $e) { return 'CHYBA'; } };
      echo json_encode([
        'https' => $o('https://hranostaj.cz/hra'), 'prazdny' => $o(''), 'js' => $o('javascript:alert(1)'), 'js2' => $o('JaVaScRiPt:alert(1)'),
        'data' => $o('data:text/html,x'), 'mezera' => $o('https://a.cz/ x'),
        'meta' => verejnaAdresa('http://169.254.169.254/latest/'), 'lan' => verejnaAdresa('http://192.168.1.1/'),
        'lo' => verejnaAdresa('http://127.0.0.1/'), 'v6' => verejnaAdresa('http://[::ffff:10.0.0.1]/'), 'cgnat' => verejnaAdresa('http://100.64.0.1/'),
        'port' => verejnaAdresa('http://8.8.8.8:22/'), 'ftp' => verejnaAdresa('ftp://8.8.8.8/'), 'heslo' => verejnaAdresa('http://a:b@8.8.8.8/'),
        'verejna' => verejnaAdresa('https://8.8.8.8/')['ip'] ?? null, 'test' => verejnaAdresa('http://127.0.0.1:8080/', true)['port'] ?? null,
      ]);`;
    const r = spawnSync(PHP, ['-r', kod], { encoding: 'utf8' });
    expect(JSON.parse(r.stdout)).toEqual({
      https: 'https://hranostaj.cz/hra', prazdny: '', js: 'CHYBA', js2: 'CHYBA', data: 'CHYBA', mezera: 'CHYBA',
      meta: null, lan: null, lo: null, v6: null, cgnat: null, port: null, ftp: null, heslo: null, verejna: '8.8.8.8', test: 8080,
    });
  });

  it('neotevřená pozvánka vyprší po týdnu, nový odkaz ji obnoví; otevřená nevyprší', async () => {
    const p = await call<{ token: string; pristup: { id: string } }>({ action: 'pristupy.create', token: admin, role: 'clen', prezdivka: 'Liška' });
    expect((await call<{ prezdivka: string; vyprsela: boolean }[]>({ action: 'pristupy.list', token: admin })).find((x) => x.prezdivka === 'Liška')!.vyprsela).toBe(false);
    t += 8 * 86400000;
    await call({ action: 'hello', token: clen });
    expect(await chyba({ action: 'hello', token: p.token })).toBe('vyprsela');
    expect((await call<{ prezdivka: string; vyprsela: boolean }[]>({ action: 'pristupy.list', token: admin })).find((x) => x.prezdivka === 'Liška')!.vyprsela).toBe(true);
    const novy = (await call<{ token: string }>({ action: 'pristupy.relink', token: admin, id: p.pristup.id })).token;
    expect((await call<{ ja: { prezdivka: string } }>({ action: 'hello', token: novy })).ja.prezdivka).toBe('Liška');
    t += 30 * 86400000;
    await call({ action: 'hello', token: clen });
    expect((await call<{ ja: { prezdivka: string } }>({ action: 'hello', token: novy })).ja.prezdivka).toBe('Liška');
  });

  it('vypnutý skautIS: návratová adresa hned skončí; správce z příkazové řádky', async () => {
    const r = await fetch(`${B}/skautis.php`, { method: 'POST', body: new URLSearchParams({ skautIS_Token: 'x' }), redirect: 'manual' });
    expect(decodeURIComponent(r.headers.get('location') ?? '')).toContain('není zapnuté');
    // php api/spravce.php: bez --dalsi skončí (správce už je), s --dalsi vypíše pozvánku; z webu 404
    const cfg = join(dir, 'config.php');
    const bez = spawnSync(PHP, [join(API, 'spravce.php')], { env: { ...process.env, APP_CONFIG: cfg }, encoding: 'utf8' });
    expect(bez.status).toBe(1);
    const s = spawnSync(PHP, [join(API, 'spravce.php'), '--dalsi'], { env: { ...process.env, APP_CONFIG: cfg }, encoding: 'utf8' });
    expect(s.stdout).toMatch(/#\/pozvanka\?t=[0-9a-f]+/);
    expect((await fetch(`${B}/spravce.php`)).status).toBe(404);
  });

  it('CSV bez vzorců: csvBunka()', () => {
    const kod = `require ${JSON.stringify(join(API, 'lib', 'core.php'))};
      echo json_encode(array_map('csvBunka', ['=1+1', ' +SUM(A1)', '-cmd', '@x', "\tx", 'Lano', '-120', 12.5, -3]));`;
    expect(JSON.parse(spawnSync(PHP, ['-r', kod], { encoding: 'utf8' }).stdout)).toEqual(["'=1+1", "' +SUM(A1)", "'-cmd", "'@x", "'\tx", 'Lano', '-120', 12.5, -3]);
  });

  it('limit požadavků: podle IP, tokenu a pro anonymní a drahé akce', async () => {
    const cfg3 = join(dir, 'config-limity.php');
    writeFileSync(cfg3, `<?php return ['db' => ${dbConfig()}, 'install_key' => 'test-klic-123', 'test' => true, 'limity' => ['ip' => 1000, 'token' => 5, 'anonymni' => 3, 'drahe' => 2]];`);
    const port3 = PORT + 2;
    const s3 = spawn(PHP, ['-S', `127.0.0.1:${port3}`, '-t', API], { env: { ...process.env, APP_CONFIG: cfg3 }, stdio: 'ignore' });
    // vlastní minutová okna hodinu po čase ostatních testů (přístupy jsou ještě aktivní)
    const zaklad = Math.floor((t + 3600000) / 60000) * 60000;
    const req3 = async (body: Record<string, unknown>, s = 1) => {
      const cas = new Date(zaklad + s * 1000).toISOString();
      const r = await fetch(`http://127.0.0.1:${port3}/index.php`, { method: 'POST', body: JSON.stringify({ _now: cas, ...body }) });
      return (await r.json()) as { ok: boolean; error?: { code: string } };
    };
    try {
      for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${port3}/index.php`); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
      for (let i = 0; i < 3; i++) expect((await req3({ action: 'ping' })).ok).toBe(true);
      expect((await req3({ action: 'ping' })).error?.code).toBe('rate_limit');
      // drahá akce (pristupy.create): 2 za minutu na přístup
      expect((await req3({ action: 'pristupy.create', token: admin, role: 'clen', prezdivka: 'L1' })).ok).toBe(true);
      expect((await req3({ action: 'pristupy.create', token: admin, role: 'clen', prezdivka: 'L2' })).ok).toBe(true);
      expect((await req3({ action: 'pristupy.create', token: admin, role: 'clen', prezdivka: 'L3' })).error?.code).toBe('rate_limit');
      // token: 5 za minutu celkem
      await req3({ action: 'hello', token: admin });
      await req3({ action: 'hello', token: admin });
      expect((await req3({ action: 'hello', token: admin })).error?.code).toBe('rate_limit');
      expect((await req3({ action: 'hello', token: admin }, 61)).ok).toBe(true);
    } finally { s3.kill(); }
  });

  it('neznámá akce a neplatný vstup', async () => {
    expect(await chyba({ action: 'neexistuje', token: clen })).toBe('bad_request');
    expect(await chyba({ action: 'profil.prezdivka', token: clen, prezdivka: 'x'.repeat(100) })).toBe('bad_request');
  });
});
