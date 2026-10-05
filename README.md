# Šablona skautské aplikace pro AI agenty

**AI instrukce a šablona pro aplikace: PWA + PHP API + MySQL, hosting skauting.cz.**

Základ pro malé webové aplikace pro skauty – plánovače, přihlášky, evidence vybavení, hry…
Aplikaci si člověk přidá na plochu telefonu jako běžnou aplikaci, funguje i se slabým signálem
a nepotřebuje žádný vlastní server: běží na **hostingu skauting.cz**, kód je na **github.com/skaut**
a po každé schválené změně se nasadí sama.

Šablona je připravená pro práci s **AI agentem** (Claude Code, Codex, Cursor…): agent dostane
pravidla a postupy ze souboru [AGENTS.md](AGENTS.md) a skillu
[.claude/skills/skaut-app](.claude/skills/skaut-app/SKILL.md).

## Co šablona umí hned

- přihlášení **pozvánkou** (odkaz bez účtu a hesla) a volitelně **přes skautIS**
- role (správce, člen), správa přístupů: pozvat, změnit roli, nový odkaz, zrušit
- ukázkovou obrazovku se seznamem (nahradíš vlastní)
- instalaci na plochu (PWA), automatické aktualizace v telefonech, verzi v Profilu
- světlý i tmavý režim v barvách Junáka
- testy a automatické nasazení přes GitHub Actions

## Jak založit novou aplikaci

1. **Repozitář:** na GitHubu v této šabloně klikni **Use this template → Create a new repository**.
   Kód skautských aplikací patří do organizace [github.com/skaut](https://github.com/skaut)
   (do organizace tě přidá její správce).
2. **Hosting:** zřiď subdoménu, databázi MySQL a FTP účet na skauting.cz, na server nahraj
   `api/config.php` a v GitHubu nastav FTP údaje – postup krok za krokem v
   [reference/infrastruktura.md](.claude/skills/skaut-app/reference/infrastruktura.md).
3. **Vývoj s AI agentem:** naklonuj repozitář, otevři ho v agentovi a popiš, co má aplikace dělat
   („Aplikace na přihlašování na oddílové akce. Vedoucí zakládá akce, členové se přihlašují…“).
   Agent upraví schéma, akce API, obrazovky a testy podle pravidel ze skillu.
4. **Nasazení:** změny se přes pull request sloučí do `main` → GitHub Actions je otestuje a nahraje
   na hosting. Poprvé otevři v anonymním okně `https://<aplikace>/api/install.php?key=<install_key>`
   a získáš pozvánku správce.

## Pro vývojáře

```bash
npm install
npm run api   # PHP API nad SQLite (potřebuje PHP 8.1+), vypíše pozvánku správce
npm run dev   # http://localhost:5190
npm test
```

| Složka | Obsah |
|---|---|
| `shared/schema.ts` | název aplikace, role, tabulky – jediný zdroj pravdy |
| `api/` | PHP API (`index.php`, `install.php`, `skautis.php`, `lib/`) |
| `src/` | aplikace (Preact + TypeScript) |
| `tests/` | testy API přes `php -S` |
| `.github/workflows/` | kontrola změn a nasazení na hosting |
| `.claude/skills/skaut-app/` | pravidla a postupy pro AI agenty |

## Údaje o tomto projektu

> Doplň po založení: adresa aplikace, správce (přezdívka, kontakt), co aplikace ukládá za údaje,
> kdo má přístup k databázi, FTP a GitHub Secrets.

## Licence

[MIT](LICENSE)
