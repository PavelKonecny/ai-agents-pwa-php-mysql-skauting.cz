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
    const html = await (await fetch(`${B}/install.php?key=test-klic-123`)).text();
    admin = html.match(/pozvanka\?t=([0-9a-f]+)/)![1];
    clen = (await call<{ token: string }>({ action: 'pristupy.create', token: admin, role: 'clen', prezdivka: 'Veverka' })).token;
  }, 30000);

  afterAll(() => {
    server?.kill();
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* Windows může soubor ještě držet */ }
  });

  it('instalace je opakovatelná a chráněná klíčem', async () => {
    expect(await (await fetch(`${B}/install.php?key=test-klic-123`)).text()).toContain('Správce už existuje');
    expect((await fetch(`${B}/install.php?key=spatne`)).status).toBe(403);
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

  it('neznámá akce a neplatný vstup', async () => {
    expect(await chyba({ action: 'neexistuje', token: clen })).toBe('bad_request');
    expect(await chyba({ action: 'profil.prezdivka', token: clen, prezdivka: 'x'.repeat(100) })).toBe('bad_request');
  });
});
