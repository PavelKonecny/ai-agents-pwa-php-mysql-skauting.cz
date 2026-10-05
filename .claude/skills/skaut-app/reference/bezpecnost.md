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
- Každý člověk má mít vlastní pozvánku (sdílený odkaz nejde zrušit jednomu).

## Oprávnění

- Každá akce API sama kontroluje roli a vlastnictví (`$ctx->jen(...)`, porovnání `pristupId`).
  Nespoléhej na to, že klient tlačítko nezobrazí.
- Vstupy vždy přes `text()` (délka) a whitelist hodnot (`in_array($x, [...], true)`).
- SQL jen s parametry (`?`), nikdy nevkládej vstup do SQL řetězce. Názvy tabulek a sloupců jen ze schématu.
- Výstup do HTML: Preact escapuje sám; `dangerouslySetInnerHTML` nepoužívej. Cizí HTML (např. z API
  jiných webů) převeď na čistý text.

## Server

- `api/config.php` a `api/lib/`, `api/data/` jsou zvenku zakázané (`.htaccess`) – neodstraňovat.
- `debug` v `config.php` jen dočasně při ladění; v provozu `false` (jinak by chyby prozradily detaily).
- HTTPS vždy (přesměrování v kořenovém `.htaccess`).

## Kontrola před vydáním

- [ ] Nové akce mají kontrolu oprávnění a testy včetně „nesmí“ (`forbidden`).
- [ ] Žádná nová osobní data bez souhlasu správce projektu; README popisuje, co se ukládá.
- [ ] `git status` neobsahuje `config.php`, hesla ani cizí soubory.
- [ ] `https://…/api/config.php` vrací 403.
- [ ] Odpovědi API neposílají víc dat, než obrazovka potřebuje (otisky tokenů, cizí přístupy…).
