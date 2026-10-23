# Bezpečnost a osobní údaje

Uživatelé skautských aplikací jsou často **děti 10–15 let** a data patří středisku/organizaci.
Junák – český skaut zpracovává osobní údaje podle GDPR; aplikace nesmí sbírat víc, než potřebuje.

## Osobní údaje

- **Výchozí: jen přezdívka.** Žádné e-maily, telefony, adresy, data narození, rodná čísla, zdravotní
  údaje ani fotky dětí, pokud to není nutné pro účel aplikace a neodsouhlasil to správce projektu.
- Když osobní údaje opravdu potřebuješ: zeptej se uživatele (účel, kdo je uvidí, jak dlouho se drží),
  zapiš to do README projektu a ukládej co nejméně (např. rok místo celého data narození).
- Fotky: jen dobrovolně, zmenšené, s možností smazat. Vidí je jen ti, kdo daného člověka vidí.
- Evidenci členů (jména, kontakty, platby) nevytvářej – patří do **skautISu**.
- Žádné sledovací a reklamní služby (Google Analytics, Facebook pixel, …), žádné externí fonty/CDN,
  které by posílaly IP adresy uživatelů třetím stranám.

## Přístupy a tokeny

- Token z pozvánky se na serveru ukládá jen jako **SHA-256 otisk** (`tokenHash`). Nikdy ho neloguj
  a neukládej v čitelné podobě. V odkazu je za `#`, takže se neposílá v adrese na server.
- Zrušení přístupu = `zruseno` (účinné okamžitě). Ztracený telefon → správce zruší / vydá nový odkaz.
- Přístup, který se **rok nepoužil, vyprší** (`NEAKTIVNI_DNI` v `api/lib/core.php`); „Nový odkaz“ ho obnoví.
  Token leží v prohlížeči (localStorage), takže jakákoli chyba typu XSS = převzetí přístupu – i proto odkazy níže.
- Každý člověk má mít vlastní pozvánku (sdílený odkaz nejde zrušit jednomu).
- Kdo smí vydat „Nový odkaz“, smí vystupovat jménem toho člověka. Když přidáváš role, nepovol nižší roli
  obnovovat odkazy stejné nebo vyšší role (např. správce střediska jinému správci) – to patří jen nejvyšší roli.
- Tajné klíče (`install_key`, tokeny) **nikdy v adrese** (`?key=…`) – adresy se ukládají do logu serveru,
  historie prohlížeče a hlavičky Referer. Posílej je v těle POST požadavku (formulář, JSON).

## Oprávnění

- Každá akce API sama kontroluje roli a vlastnictví (`$ctx->jen(...)`, porovnání `pristupId`).
  Nespoléhej na to, že klient tlačítko nezobrazí.
- Vstupy vždy přes `text()` (délka) a whitelist hodnot (`in_array($x, [...], true)`).
- **Vlastník záznamu = id přístupu** (`pristupId` / `autorId` = `$ctx->kdo['id']`), nikdy přezdívka –
  přezdívku si může kdokoli nastavit stejnou. Server ho doplní sám při založení a klient ho nesmí přepsat.
- **Hodnoty „kdo jsem / kam patřím“ od klienta neber jako fakt**: role, id jednotky, id osoby, id přístupu
  v požadavku jsou jen přání. Ověř je proti vlastním datům nebo službě (skautIS) – viz `skautis.md`.
- SQL jen s parametry (`?`), nikdy nevkládej vstup do SQL řetězce. Názvy tabulek a sloupců jen ze schématu.
- Výstup do HTML: Preact escapuje sám; `dangerouslySetInnerHTML` nepoužívej. Cizí HTML (např. z API
  jiných webů) převeď na čistý text.

## Odkazy a stahování z webu

- **Pole s adresou** (odkaz na hru, mapu, spojení…) ukládej přes `odkaz($req, 'pole')` – přijme jen prázdnou
  hodnotu nebo `http(s)://…`. Preact `href` **nijak nečistí**: uložený `javascript:alert(…)` se po kliknutí
  spustí v aplikaci a ukradne přístup tomu, kdo klikl (třeba správci).
- V aplikaci uložené adresy zobrazuj **jen přes `<OdkazVen href={…}>`** (`src/components/ui.tsx`), nikdy
  `<a href={radek.url}>` – chrání i data uložená dřív, než kontrola na serveru vznikla.
- Když má **server stáhnout cizí stránku** (náhled odkazu, import z webu), použij `stahniVerejne($app, $url)`.
  Nikdy `curl_init` / `file_get_contents` s adresou od uživatele: šlo by tak číst vnitřní síť hostingu
  (localhost, 10.x, 192.168.x, 169.254.169.254) – tzv. SSRF. `stahniVerejne` povolí jen veřejné IP a porty
  80/443, přesměrování ověřuje po každém kroku a spojí se jen na ověřenou IP. Uživateli vracej jen to,
  co potřebuje (název stránky), ne celý obsah.
- **Adresy pro uživatele nestav z hlavičky `Host`** (`$_SERVER['HTTP_HOST']`) – jde podvrhnout. Použij
  `app_url` z `config.php`, nebo relativní adresu (`Location: ../#/…`).

## Server

- `api/config.php` a `api/lib/`, `api/data/` jsou zvenku zakázané (`.htaccess`) – neodstraňovat.
- `debug` v `config.php` jen dočasně při ladění; v provozu `false` (jinak by chyby prozradily detaily).
- HTTPS vždy (přesměrování v kořenovém `.htaccess`).
- Kořenový `.htaccess` (`scripts/htaccess-root`) posílá **Content-Security-Policy** (skripty jen z vlastního
  webu), `X-Frame-Options: DENY` a HSTS – neodstraňovat. Nepřidávej inline `<script>`, `eval`, skripty z CDN.
  Když aplikace volá cizí API, doplň jeho adresu do `connect-src` (a v Profilu ověř, že se načte).

## Kontrola před vydáním

- [ ] Nové akce mají kontrolu oprávnění a testy včetně „nesmí“ (`forbidden`).
- [ ] Nová pole s adresou: `odkaz()` na serveru, `<OdkazVen>` v aplikaci, test, že `javascript:` vrátí `bad_request`.
- [ ] Server nic nestahuje z adresy od uživatele jinak než přes `stahniVerejne()`.
- [ ] Vlastnictví záznamů podle id přístupu; hodnoty od klienta (role, jednotka, id) server ověřuje.
- [ ] Žádné tajemství v adrese (`?key=`, `?token=`); adresy pro uživatele ne z hlavičky `Host`.
- [ ] Žádná nová osobní data bez souhlasu správce projektu; README popisuje, co se ukládá.
- [ ] `git status` neobsahuje `config.php`, hesla ani cizí soubory.
- [ ] `https://…/api/config.php` vrací 403.
- [ ] Odpovědi API neposílají víc dat, než obrazovka potřebuje (otisky tokenů, cizí přístupy…).
