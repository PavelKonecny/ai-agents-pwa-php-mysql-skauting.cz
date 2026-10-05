# Vzhled, ovládání a texty

## Jednotný vizuální styl Junáka (JVS)

- Barvy (proměnné v `src/styles.css`): tmavě modrá `#002039` (lišta), skautská modrá `#077ea5`
  (tlačítka, odkazy), žlutá `#ffd23f` (zvýraznění). Nové barvy přidávej jako proměnné a doplň je
  i pro tmavý režim (`@media (prefers-color-scheme: dark)`).
- Písma JVS (TheMix, SKAUT) nejsou v šabloně – jejich použití je pro projekty Junáka možné, ale soubory
  (`.woff2`) přidej do `public/fonts/` jen s ověřenou licencí a načítej je lokálně (ne z cizího CDN).
- Ikona aplikace: `public/icon.svg` (čtverec 512×512, důležitý obsah uprostřed – okraj ~10 %).

## Mobil na prvním místě

- Navrhuj pro šířku **375 px**, pak ověř i tablet/počítač. Žádné vodorovné posouvání stránky.
- Dotykové prvky min. **44×44 px**. Hlavní akce dole/na dosah palce.
- Nadpis stránky a přepínače drž na stejném místě ve všech pohledech (nic nesmí „skákat“).
- Úpravy v kartách, na které jde klepnout: ikona tužky → pole s automatickým zaměřením (klávesnice).
- Tmavý režim: každá úroveň zanoření (karta v kartě) jiným pozadím; dialogy výrazně odlišené.
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
iPhone: Safari → Sdílet → Přidat na plochu). Na iPhonu Safari maže data webů neotevřených 7 dní –
aplikace na ploše tím netrpí, proto ji uživatelům doporučuj nainstalovat.
