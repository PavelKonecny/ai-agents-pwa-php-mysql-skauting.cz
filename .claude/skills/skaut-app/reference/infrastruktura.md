# Infrastruktura: GitHub skaut + hosting skauting.cz

Každá aplikace = **jeden repozitář** v organizaci github.com/skaut + **jedna subdoména**
a **jedna databáze** na hostingu skauting.cz. Aplikace se navzájem neovlivňují.

> Údaje označené ⚠️ se liší podle nastavení hostingu – ověř je u správce hostingu skauting.cz
> a doplň do README projektu.

## 1. Repozitář

1. Otevři šablonu [ai-agents-pwa-php-mysql-skauting.cz](https://github.com/PavelKonecny/ai-agents-pwa-php-mysql-skauting.cz) → **Use this template** → **Create a new repository**.
   - Vlastník: `skaut`, název malými písmeny s pomlčkami (např. `schuzkovac`, `prihlasky-na-akce`).
   - Do organizace tě musí přidat její správce (bez členství repozitář v `skaut` nezaložíš).
2. V novém repozitáři uprav `shared/schema.ts` → `APLIKACE` (název, krátký název, popis)
   a `index.html` → `<title>`. Ikonu nahraď v `public/icon.svg`.

## 2. Hosting (jednou pro aplikaci)

1. **Subdoména** – např. `nazev.skauting.cz`, zřizuje se v administraci hostingu ⚠️.
   Kořen subdomény = složka, kam se nahrává obsah `dist-nahrat/`.
2. **Databáze MySQL** – vlastní pro aplikaci (název, uživatel, heslo) ⚠️. Správa dat: phpMyAdmin
   na `https://mysql.skauting.cz`.
3. **FTP účet** s přístupem do složky subdomény ⚠️ (adresa serveru, uživatel, heslo).
4. **HTTPS** pro subdoménu musí být zapnuté (bez něj nefunguje instalace na plochu ani offline režim).
5. Požadavky na PHP: 8.1+, rozšíření `pdo_mysql`, `mbstring`; pro skautIS navíc `soap`.

## 3. Konfigurace na serveru (jednou)

Přes FTP (např. FileZilla) vytvoř na serveru soubor `api/config.php` podle `api/config.example.php`:

```php
<?php
return [
    'db' => ['dsn' => 'mysql:host=localhost;dbname=NAZEV;charset=utf8mb4', 'user' => '…', 'password' => '…'],
    'install_key' => '…dlouhý náhodný řetězec…',
    'skautis' => ['appid' => '', 'test' => true],
    'debug' => false,
];
```

`config.php` je mimo git a automatické nasazení ho nepřepisuje ani nemaže.
Ověření: `https://nazev.skauting.cz/api/config.php` musí vrátit **403** (zvenku nečitelný).

## 4. Automatické nasazení (jednou)

V repozitáři na GitHubu: **Settings → Secrets and variables → Actions**

| Druh | Název | Hodnota |
|---|---|---|
| Secret | `FTP_SERVER` | adresa FTP serveru ⚠️ |
| Secret | `FTP_USERNAME` | FTP uživatel |
| Secret | `FTP_PASSWORD` | FTP heslo |
| Variable | `FTP_DIR` | složka webu na serveru, končí `/` (např. `/nazev/`) ⚠️ |
| Variable | `FTP_PROTOCOL` | `ftps` (výchozí); `ftp` jen pokud hosting FTPS neumí |

Pak **Actions → Nasazení → Run workflow** (nebo push do `main`). Průběh i chyby jsou vidět v kartě Actions.
Nasazení nahrává jen změněné soubory (stav si pamatuje v `.ftp-deploy-sync-state.json` na serveru).

## 5. První spuštění

1. Ověř `https://nazev.skauting.cz/api/` → `{"ok":true,"data":{"status":"běží"}}`.
2. **V anonymním okně** otevři `https://nazev.skauting.cz/api/install.php?key=<install_key>`.
   Vytvoří tabulky a zobrazí **pozvánku správce** – otevři ji (je to tvůj přístup, nikomu ji neposílej).
3. V aplikaci → Správa → pozvi další lidi.

Ztracená pozvánka správce: `install.php?key=…&dalsi=1` vytvoří dalšího správce.

## 6. Provoz

- **Aktualizace** = push/merge do `main`. Databáze se při změně schématu doplní sama.
- **Verze** je v aplikaci v Profilu (`major.minor.počet commitů` + datum). Telefony se aktualizují samy.
- **Zálohy**: phpMyAdmin → Export (SQL). Před každou větší změnou a pravidelně (např. měsíčně).
- **Ruční nasazení** (když Actions nejdou): `npm run dist` a nahrát **obsah** `dist-nahrat/` přes FTP
  do kořene subdomény (včetně skrytých `.htaccess`, bez `api/config.php`).
- **Chyby**: `api/config.php` → `'debug' => true` dočasně ukáže podrobnou chybu v odpovědi API;
  PHP chyby jsou v logu hostingu ⚠️. Po vyřešení vrať `false`.

## 7. Předání projektu

Do README projektu doplň: adresu aplikace, kdo je správce (přezdívka/kontakt), kde je databáze,
kdo má přístup k FTP a GitHub Secrets. Přístupy patří středisku/organizaci, ne jednomu člověku.
