# Postupy krok za krokem

Všechny ukázky odpovídají kódu šablony. Po každém postupu spusť `npm run typecheck` a `npm test`.

## Lokální vývoj

```bash
npm install
npm run api      # terminál 1: PHP API nad SQLite na :8095 (poprvé vypíše pozvánku správce)
npm run dev      # terminál 2: aplikace na http://localhost:5190 (volá /api přes proxy)
```

Potřebuješ PHP 8.1+ s `pdo_sqlite` (nebo proměnnou `PHP_BIN` s cestou k `php`). Lokální data jsou
v `api/data/app.sqlite` – smazáním souboru začneš znovu.

## 1. Nová tabulka

`shared/schema.ts`:

```ts
export const TABULKY = {
  Pristupy: [...],
  SkautisKody: [...],
  Akce: ['nazev', 'datum', 'misto', 'popis', 'kapacita'],          // ← nová tabulka
  Prihlasky: ['akceId', 'pristupId', 'poznamka', 'stav'],          // ← vazba přes …Id
} as const;
```

- Sloupce končící `Id`, `Hash` a `datum` jsou krátké a indexovatelné; ostatní jsou dlouhý text.
- Vazby mezi tabulkami: sloupec `xxxId` s `id` cílového záznamu.
- Po uložení: `npm test` vygeneruje `api/lib/schema.php`. V databázi se tabulka vytvoří sama.

## 2. Nová akce API

`api/lib/akce.php`:

```php
function akceAplikace(): array
{
    return [
        // …
        'akce.list' => fn (Ctx $ctx, array $req) => akceList($ctx),
        'akce.prihlasit' => fn (Ctx $ctx, array $req) => akcePrihlasit($ctx, text($req, 'akceId', 80)),
    ];
}

function akceList(Ctx $ctx): array
{
    $list = zive($ctx->app->db->cti('Akce'));
    usort($list, fn ($a, $b) => strcmp($a['datum'], $b['datum']));
    return $list;
}

function akcePrihlasit(Ctx $ctx, string $akceId): array
{
    $ctx->jen('admin', 'clen');                                   // 1) role
    $akce = podleId(zive($ctx->app->db->cti('Akce')), $akceId);
    if (!$akce) throw new Chyba('not_found', 'Akce nenalezena.');  // 2) existence
    $uz = zive($ctx->app->db->cti('Prihlasky', '`akceId` = ? AND `pristupId` = ?', [$akceId, $ctx->kdo['id']]));
    if ($uz) throw new Chyba('exists', 'Na akci už jsi přihlášený.'); // 3) pravidla
    return uloz($ctx, 'Prihlasky', array_merge(prazdnyRadek('Prihlasky', $ctx->app->uuid()), [
        'akceId' => $akceId, 'pristupId' => $ctx->kdo['id'], 'stav' => 'prihlasen',
    ]));
}
```

Pomocníci z `api/lib/core.php`:

| Funkce | K čemu |
|---|---|
| `text($req, 'pole', max)` / `textVolitelny(...)` | vstup z požadavku (ořezaný, hlídá délku) |
| `$ctx->jen('admin', …)` | povolí jen vyjmenované role |
| `$ctx->kdo` | řádek přístupu volajícího (`id`, `role`, `prezdivka`) |
| `$ctx->app->db->cti('Tabulka', 'podmínka ?', [param])` | čtení (vrací i smazané → obal `zive()`) |
| `uloz($ctx, 'Tabulka', $radek)` | zápis pod zámkem s `updatedAt`/`updatedBy` |
| `prazdnyRadek('Tabulka', $id)`, `podleId($radky, $id)` | nový řádek, hledání |
| `throw new Chyba('kod', 'Zpráva')` | chyba pro uživatele (kódy: `bad_request`, `forbidden`, `not_found`, `exists`) |

Vícekrokový zápis, který musí proběhnout celý: `$ctx->app->db->withLock(function () use (…) { … })`.

## 3. Test akce

`tests/api.test.ts` – vždy oprávnění, hlavní scénář a neplatný vstup:

```ts
it('přihláška na akci', async () => {
  const akce = await call<{ id: string }>({ action: 'akce.uloz', token: admin, nazev: 'Výprava', datum: '2026-11-07' });
  await call({ action: 'akce.prihlasit', token: clen, akceId: akce.id });
  expect(await chyba({ action: 'akce.prihlasit', token: clen, akceId: akce.id })).toBe('exists');
  expect(await chyba({ action: 'akce.prihlasit', token: clen, akceId: 'neni' })).toBe('not_found');
});
```

Spuštění: `npm test` (bez PHP se testy API přeskočí – na GitHubu běží vždy).

## 4. Nová obrazovka

`src/screens/Akce.tsx`:

```tsx
import { useEffect, useState } from 'preact/hooks';
import type { Radek } from '../../shared/schema';
import { api } from '../lib/api';
import { ukaz } from '../lib/stav';
import { Empty } from '../components/ui';

export function Akce() {
  const [list, setList] = useState<Radek[] | null>(null);
  const nacti = () => api<Radek[]>('akce.list').then(setList).catch((e) => ukaz(e.message, true));
  useEffect(() => { void nacti(); }, []);
  if (!list) return <p class="muted">Načítám…</p>;
  return (
    <div class="stack">
      <h1>Akce</h1>
      {list.length === 0 ? <Empty icon="calendar">Zatím žádné akce.</Empty> : (
        <div class="list">
          {list.map((a) => (
            <a class="item" href={`#/akce/${a.id}`}>
              <div class="item-text"><b>{a.nazev}</b><div class="small muted">{a.datum}</div></div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
```

`src/app.tsx`: přidej do `OBRAZOVKY` (`akce: Akce`) a do `NAV`
(`{ cesta: 'akce', nazev: 'Akce', ikona: 'calendar', cesty: ['akce'] }` – ikona je název z `Icon` v `src/components/ui.tsx`).
Obrazovku jen pro správce označ `jenSpravce: true` – **a oprávnění stejně hlídej na serveru**.

Vzhled: používej hotové třídy a komponenty – přehled je v `reference/vzhled.md` (`card`, `item`, `btn`, `input`,
`chip`, `Sheet`, `Icon`…). Nové styly přidávej do `src/styles.css` s proměnnými barev `--c-*` (kvůli tmavému režimu).

## 5. Nová role

`shared/schema.ts`: přidej do `ROLE` a `ROLE_NAZVY` (např. `vedouci: 'vedoucí'`). Správce ji pak
může přidělit v Správě. V akcích ji povol přes `$ctx->jen(...)`.

## 6. Obrázky (fotky, loga)

- V prohlížeči zmenši na max. ~160–200 px a ulož jako data URL (WebP/JPEG) – max. desítky kB.
- Na serveru ověř formát: `preg_match('#^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$#', $v)`.
- Obrázky neposílej v seznamech, které se načítají často – zvlášť, až když jsou potřeba.

## 7. Offline

Aplikace (HTML, JS, CSS) funguje offline díky service workeru. **Data offline nejsou** – když je
potřeba číst data bez signálu, ulož poslední odpověď API do `localStorage`/IndexedDB a při chybě
`offline` ji zobraz s upozorněním „offline – data z <čas>“. Zápisy offline nedělej (konflikty).

## 8. Před odevzdáním

```bash
npm run typecheck
npm test
npm run build
```

Pak v prohlížeči (`npm run api` + `npm run dev`) projdi změněné obrazovky na šířce 375 px a v tmavém
režimu. Commit česky, ve větvi; do `main` přes pull request (po sloučení se nasadí samo).
