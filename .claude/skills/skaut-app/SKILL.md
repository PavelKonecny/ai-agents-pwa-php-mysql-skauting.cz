---
name: skaut-app
description: Vývoj skautských webových aplikací (PWA + PHP API + MySQL) nasazovaných na hosting skauting.cz s kódem na github.com/skaut. Použij vždy, když v tomto repozitáři přidáváš funkci, tabulku, akci API nebo obrazovku, opravuješ chybu, připravuješ nasazení, zakládáš nový projekt ze šablony nebo řešíš přihlášení (pozvánky, skautIS).
---

# Skautská aplikace – pravidla a postupy pro AI agenty

Tento repozitář vznikl ze šablony [ai-agents-pwa-php-mysql-skauting.cz](https://github.com/PavelKonecny/ai-agents-pwa-php-mysql-skauting.cz). Cílem je, aby **běžný člověk** (rádce, vedoucí,
správce střediska) dokázal s pomocí AI agenta připravit a provozovat malou aplikaci pro skauty
**bez vlastních serverů a s minimem údržby**. Drž se proto zavedeného řešení – nepřidávej nové
technologie, služby ani závislosti, pokud to úkol opravdu nevyžaduje.

## Architektura (neměnit bez dohody)

| Část | Technologie | Kde |
|---|---|---|
| Aplikace | Preact + TypeScript + Vite, PWA (instalace na plochu, offline čtení) | `src/` |
| API | PHP 8.1+ bez frameworku a bez Composeru, JSON přes POST | `api/` |
| Data | MySQL/MariaDB (hosting), SQLite (lokálně a v testech) | `api/lib/db.php` |
| Schéma | **jediný zdroj pravdy** `shared/schema.ts` → generuje `api/lib/schema.php` | `shared/` |
| Testy | Vitest; API se testuje přes skutečný `php -S` nad SQLite | `tests/` |
| Kód | GitHub, organizace **github.com/skaut** | – |
| Provoz | hosting **skauting.cz** (Apache + PHP + MySQL), každá aplikace = vlastní subdoména + vlastní databáze | – |
| Nasazení | GitHub Actions: push do `main` → testy → sestavení → FTP | `.github/workflows/` |

Proč takto: hosting skauting.cz umí jen statické soubory + PHP + MySQL (žádný Node, Docker ani
cron). Aplikace se proto sestaví do statických souborů a server řeší jen malé PHP API.

## Zlatá pravidla

1. **Oprávnění kontroluj na serveru.** Každá akce v `api/lib/akce.php` sama ověří roli (`$ctx->jen('admin')`)
   a vlastnictví záznamu. Klient jen skrývá tlačítka – a jeho kontrola musí odpovídat serveru
   (když server něco povolí, klient to nesmí zablokovat, a naopak).
2. **Schéma jen přidává.** Nové tabulky a sloupce přidávej do `shared/schema.ts`; v databázi se
   vytvoří samy při prvním požadavku (`ensureSchema`). Sloupce **nikdy nepřejmenovávej ani nemaž** –
   na produkci jsou data. Když potřebuješ jiný význam, přidej nový sloupec a starý přestaň používat.
3. **Všechny hodnoty jsou text**, mazání je měkké (`deleted = '1'`), každý zápis přes `uloz()` (doplní
   `updatedAt`, `updatedBy`). Datum `RRRR-MM-DD`, čas ISO UTC, příznak `'1'` / `''`.
4. **Uložené hodnoty ≠ popisky.** Když se mění text v UI (např. název stavu), měň popisek v aplikaci,
   ne hodnotu v databázi – jinak se rozbijí existující data.
5. **Minimum osobních údajů.** Uživatelé jsou často děti 10–15 let: jen přezdívky, žádné e-maily,
   telefony, adresy ani rodná čísla, pokud to není nezbytné a odsouhlasené. Viz `reference/bezpecnost.md`.
6. **Mobil na prvním místě.** Každou obrazovku ověř na šířce 375 px (iPhone) i v tmavém režimu.
7. **Malá data.** Žádné obrázky v seznamech, které se stahují pořád dokola; velké seznamy načítej
   až když jsou potřeba (sbalené sekce) a sdílej jeden požadavek mezi komponentami.
8. **Čeština.** UI, hlášky, komentáře v kódu i commity česky. Chybové hlášky pro uživatele musí
   říct, co se stalo a co má udělat (`throw new Chyba('kod', 'Česká věta.')`).
9. **Tajemství nikdy do gitu.** `api/config.php`, hesla, FTP údaje, tokeny – nikdy. FTP údaje patří
   do GitHub Secrets. Před commitem zkontroluj `git status` a necommituj soubory, které jsi nevytvořil.
10. **Hotovo = ověřeno.** Po změně: `npm run typecheck`, `npm test` (s PHP), u viditelné změny
    vyzkoušej v prohlížeči (`npm run api` + `npm run dev`) a uživateli řekni, co jsi ověřil a co ne.

## Běžné postupy

Podrobné recepty s ukázkami kódu: **`reference/postupy.md`**. Stručně:

- **Nová tabulka / sloupec** → `shared/schema.ts` (`TABULKY`) → `npm test` (vygeneruje `schema.php`).
- **Nová akce API** → funkce v `api/lib/akce.php` + řádek v `akceAplikace()` + test v `tests/api.test.ts`
  (oprávnění, hlavní scénář, neplatný vstup). Název `objekt.sloveso` (`schuzky.list`, `schuzky.uloz`).
- **Nová obrazovka** → `src/screens/Nazev.tsx` + řádek v `OBRAZOVKY` v `src/app.tsx` (+ položka v `NAV`).
- **Nová role** → `ROLE` a `ROLE_NAZVY` v `shared/schema.ts`, pak oprávnění v akcích.
- **Volání API z aplikace** → `await api<Typ>('objekt.sloveso', { … })`, chyby zobraz přes `ukaz(e.message, true)`.

## Přihlášení

- **Výchozí: pozvánky.** Správce v aplikaci vytvoří pozvánku (odkaz s tokenem), pozvaný ji otevře
  a je přihlášený – bez účtu a hesla. Token se ukládá jen jako SHA-256 otisk. Ztracená pozvánka →
  „Nový odkaz“ (stejný člověk, starý odkaz přestane platit).
- **Volitelně: skautIS** pro dospělé. Účet skautIS přístup nedává sám o sobě – uživatel si ho propojí
  po přihlášení pozvánkou a pak se jím přihlašuje na dalších zařízeních. Modul `api/lib/skautis.php`
  **není ověřený proti skutečnému skautISu** – postup a ověření: `reference/skautis.md`.

## Nasazení a provoz

- Push do `main` = nasazení (workflow „Nasazení“). Práce probíhá ve větvích a přes pull requesty;
  workflow „Kontrola“ spustí testy u každé změny.
- První nasazení (subdoména, databáze, `config.php`, GitHub Secrets, `install.php`): `reference/infrastruktura.md`.
- **`install.php` otevírej v anonymním okně** (service worker aplikace by ho v běžném okně mohl zakrýt).
- Verze se počítá sama (`major.minor.počet commitů`) a je vidět v Profilu i s datem sestavení.
  Telefony si novou verzi stáhnou samy při návratu do aplikace.
- Zálohy dat: export databáze v phpMyAdminu (`mysql.skauting.cz`), před každou větší změnou.

## Čemu se vyhnout (poučení z předchozích projektů)

- Service worker zachytí všechny adresy na doméně – `/api/` musí být v `navigateFallbackDenylist`
  (už nastaveno ve `vite.config.ts`, neodstraňovat), jinak `install.php` ukáže bílou stránku.
- Pole uvnitř odkazu `<a>` na mobilu nejde upravovat – klikací karty s editací dělej jako `<div>`
  s `onClick` a editaci otevírej ikonou (tužkou).
- Dva dialogy za sebou: zavření prvního nesmí vymazat data, která potřebuje druhý.
- Tmavý režim: zanořené karty potřebují odlišné pozadí, ne jen okraj; dialog musí být jasně
  odlišený od podkladu.
- Prvky, které se objeví jen v jednom pohledu, nesmí posouvat ovládací prvky (přepínače
  na stejném místě ve všech pohledech).
- Nekombinuj zdroje pravdy: co se zobrazuje podle role, musí sedět s tím, co server dovolí.

## Kdy se zeptat uživatele

Zeptej se (krátce, s doporučenou variantou), když: přidáváš osobní údaje, měníš význam existujících
dat, přidáváš novou službu/závislost/platbu, měníš přihlašování nebo oprávnění rolí, nebo když
zadání připouští víc rozumných výkladů. Jinak rozhodni sám podle těchto pravidel a řekni, co jsi zvolil.

## Další reference

- `reference/postupy.md` – recepty krok za krokem (tabulka, akce, obrazovka, test, offline, obrázky)
- `reference/infrastruktura.md` – hosting skauting.cz, GitHub skaut, první nasazení, provoz
- `reference/bezpecnost.md` – osobní údaje, děti, tokeny, oprávnění, kontrola před vydáním
- `reference/skautis.md` – přihlášení přes skautIS a jak ho ověřit
- `reference/vzhled.md` – JVS Junáka, mobilní UI, texty v aplikaci
