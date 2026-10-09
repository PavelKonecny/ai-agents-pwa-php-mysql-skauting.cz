# Vzhled, ovládání a texty

Šablona má stejný vzhled jako **Schůzkovač** (schuzkovac.skauting.cz) – aplikace Junáka tak vypadají jednotně.
Nové obrazovky skládej z hotových tříd a komponent níže; vlastní styly přidávej jen tam, kde nic nesedí.

## Jednotný vizuální styl Junáka (JVS)

Barvy jsou proměnné v `src/styles.css` (nepoužívej v kódu pevné barvy):

| Proměnná | Světlý | K čemu |
|---|---|---|
| `--c-navy` | `#527760` (zelená) | horní a dolní lišta, úvodní pás – uživatel ji mění v Profilu |
| `--c-primary` / `-strong` / `-soft` | `#077ea5` / `#075772` / `#e3f1f6` | tlačítka, odkazy, zvýraznění |
| `--c-accent` / `-soft` | `#ffd23f` / `#fff6d1` | žlutá z rádcovské příručky – tipy, aktivní položka menu |
| `--c-orange` | `#d9542b` | odznaky (počty), DEMO |
| `--c-ok`, `--c-warn`, `--c-danger` (+ `-soft`) | | stavy: hotovo, pozor, chyba / mazání |
| `--c-bg`, `--c-surface`, `--c-surface-2` | | pozadí stránky, karta, vnořená úroveň |
| `--c-text`, `--c-muted`, `--c-border` | | text, vedlejší text, okraje |

**Tmavý režim** je v `styles.css` dvakrát (podle telefonu a ručně zvolený `data-theme="dark"`) – novou barvu
doplň do **obou** bloků. Navíc má `--c-sheet` (dialogy světlejší než stránka), `--c-input` (pole tmavší než karta)
a `--c-backdrop`. Každá úroveň zanoření má jiné pozadí (karta → `.nested`), ať je čitelná.

**Písma** JVS (SKAUT Bold na nadpisy, TheMix Bold na tučné texty) v šabloně nejsou – proměnné `--font-head`
a `--font-bold` je už obsahují a bez souborů se použije systémové písmo. Schůzkovač je používá se souhlasem
Junáka; máš-li ho i ty, vlož `.woff2` do `public/fonts/` a odkomentuj `@font-face` na začátku `styles.css`.
Písma načítej lokálně, ne z cizího CDN.

**Ikona aplikace**: `public/icon.svg` (512×512, důležitý obsah uprostřed – okraj ~10 % kvůli „maskable“).
Pozadí ikony nech v barvě `BARVY_LISTY[0]` – ikona v záložce prohlížeče a `<Logo />` se pak přebarví podle
barvy lišty, kterou si uživatel vybere. Logo SKAUT do ikony dávej jen v souladu s pravidly Junáka.

## Hotové prvky

Rám (`src/app.tsx`):

- **Horní lišta** `.topbar` – znak aplikace, název + podtitulek (`.sub`: přezdívka · role), tečka stavu
  (`.status-dot` online / `.off` / `.busy`), Aktualizovat, vpravo **avatar → Profil**.
- **Spodní menu** `.bottomnav` – 2–5 položek s ikonou (`NAV`), aktivní má žlutý proužek; počet čekajících věcí
  jako `<span class="navbadge">3</span>`. Profil do menu nedávej (je pod avatarem).
- **Pruhy** pod lištou: `.banner.offline`, `.banner.info`, `.banner.error`, `.banner.demo` (oranžové šrafování
  pro ukázková data) – volitelně se zavíracím `.banner-zavrit`.
- **Hlášky** `ukaz(text)` / `ukaz(text, true)` → `.toast` / `.toast.error` nad spodním menu.

Třídy (`src/styles.css`):

| Třída | Použití |
|---|---|
| `.stack`, `.row` (`.wrap`), `.grow`, `.grid2`, `.center` | rozvržení |
| `.card` (`.highlight`), `.card-title`, `.section > h2`, `.nested` | karty a oddíly stránky |
| `.list` > `.item` (`.done`, `.wrap`), `.item-text`, `.item-actions`, `.datebox` | řádky seznamu (min. 56 px) |
| `.btn` + `.secondary` / `.ghost` / `.danger` / `.accent` / `.small` / `.block` | tlačítka (min. 44 px) |
| `.iconbtn`, `.backbtn`, `.fab`, `.linklike` | ikonové tlačítko, zpět, plovoucí „+“, odkaz jako text |
| `.field` > `.input` (input/select/textarea), `.check`, `.hledani` | formuláře (písmo ≥ 16 px kvůli iPhonu) |
| `.chip` + `.ok` / `.warn` / `.accent` / `.info`; `button.chip[aria-pressed]` | štítky a přepínače |
| `.segmented` > `button[aria-selected]` | záložky / přepínač 2–4 voleb |
| `.tip`, `.empty`, `.divider`, `.progress > i`, `.linkbox` | tip, prázdný stav, předěl, průběh, odkaz k zkopírování |
| `.hero`, `.paticka`, `.uvod-umi` | úvodní obrazovka |
| `.muted`, `.small` | vedlejší text |

Komponenty (`src/components/ui.tsx`):

- `<Icon name="calendar" size={22} />` – obrysové ikony (home, calendar, check, checklist, bulb, users, flag, plus,
  search, link, left/right/up/down, trash, message, wifiOff, share, copy, clock, external, refresh, edit, close,
  settings, help, image, send, star, logout). Nová ikona = cesta SVG 24×24 ve stejném stylu. **Emoji do ovládání
  nedávej** (jinak vypadají v každém telefonu jinak); v textu (výčet na úvodu) jsou v pořádku.
- `<Logo />` znak aplikace v barvě lišty, `<Avatar name src round />` fotka nebo iniciály.
- `<Sheet open onClose title>` – spodní panel pro formuláře a volby (zavře se i klepnutím vedle).
- `<EditText value onSave label />` – pole, které uloží při opuštění; `<Select>`; `<DateInput>` – výběr data česky
  (týden od pondělí, „pá 23. 10. 2026“) místo nativního `type="date"`.
- `<BackButton href label />`, `<Empty icon>…</Empty>`, `<Tip>…</Tip>`.
- `<NaPlochu />` (`src/components/NaPlochu.tsx`) – návod na přidání na plochu podle telefonu.

**Nastavení vzhledu** (`src/lib/theme.ts`, Profil → Vzhled aplikace; jen pro daný telefon): režim světlý / tmavý /
podle telefonu, velikost písma 85–130 %, tapeta (`.wp-*`), barva lišty (`BARVY_LISTY`).

## Mobil na prvním místě

- Navrhuj pro šířku **375 px**, pak ověř i tablet/počítač. Žádné vodorovné posouvání stránky.
- Dotykové prvky min. **44×44 px**. Hlavní akce dole/na dosah palce.
- Nadpis stránky a přepínače drž na stejném místě ve všech pohledech (nic nesmí „skákat“).
- Úpravy v kartách, na které jde klepnout: ikona tužky (`edit`) → pole s automatickým zaměřením (klávesnice).
- Mazání: ikona koše (`trash`) + `confirm` s důsledkem.
- Ověř **tmavý režim** (Profil → Vzhled → Tmavý) – hlavně dialogy, pole a vnořené karty.
- Načítání: zobraz hned, co už je k dispozici (např. seznam názvů), a doplň detaily, až dorazí.

## Texty v aplikaci

- Česky, tykání, krátké věty. Tlačítka říkají, co se stane: „Do schůzky“, „Uložit do zásobníku“,
  ne „OK“ / „Uložit!“.
- Chybová hláška: co se stalo + co s tím („Pozvánka neplatí. Požádej správce o novou.“).
- Potvrzení u nevratných akcí (`confirm`) s důsledkem („Starý odkaz přestane fungovat.“).
- Stavy pojmenuj jednoznačně (např. „Bez nápadu / Nápad / Připravuji / Hotovo“), ne „vím / nevím“.
- Popisky jsou v UI, ne v datech (viz pravidlo „Uložené hodnoty ≠ popisky“).

## Instalace na plochu

Aplikace je PWA – uživatelé si ji přidají na plochu (Android: Chrome → ⋮ → Přidat na plochu;
iPhone: Safari → Sdílet → Přidat na plochu). Návod podle telefonu ukazuje `<NaPlochu />` na úvodu
a na hlavní obrazovce. Na iPhonu Safari maže data webů neotevřených 7 dní – aplikace na ploše tím netrpí,
proto ji uživatelům doporučuj nainstalovat.
