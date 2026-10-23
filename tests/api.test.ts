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

describe.skipIf(!maPhp)('API (PHP + SQLite)', () => {
  let admin = '';
  let clen = '';

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'skaut-app-'));
    dbFile = join(dir, 'test.sqlite');
    const cfg = join(dir, 'config.php');
    writeFileSync(cfg, `<?php return ['db' => ['dsn' => 'sqlite:' . ${JSON.stringify(dbFile)}], 'install_key' => 'test-klic-123', 'app_url' => 'http://localhost/', 'test' => true, 'debug' => true];`);
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
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* Windows může soubor ještě držet */ }
  });

  it('instalace je opakovatelná a chráněná klíčem', async () => {
    expect(await (await instalace('test-klic-123')).text()).toContain('Správce už existuje');
    expect((await instalace('spatne')).status).toBe(403);
    // klíč v adrese se nepřijímá (zůstal by v logu serveru a historii prohlížeče)
    expect(await (await fetch(`${B}/install.php?key=test-klic-123`)).text()).not.toMatch(/pozvanka\?t=/);
    expect(await (await instalace('test-klic-123', true)).text()).toMatch(/pozvanka\?t=/);
  });

  it('přihlášení tokenem; token se ukládá jen jako otisk', async () => {
    const h = await call<{ ja: { role: string; prezdivka: string } }>({ action: 'hello', token: clen });
    expect(h.ja).toMatchObject({ role: 'clen', prezdivka: 'Veverka' });
    expect(await chyba({ action: 'hello', token: 'x'.repeat(40) })).toBe('unauthorized');
    expect(readFileSync(dbFile).includes(Buffer.from(clen))).toBe(false);
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

  it('neznámá akce a neplatný vstup', async () => {
    expect(await chyba({ action: 'neexistuje', token: clen })).toBe('bad_request');
    expect(await chyba({ action: 'profil.prezdivka', token: clen, prezdivka: 'x'.repeat(100) })).toBe('bad_request');
  });
});
