# Pokyny pro AI agenty

Tento repozitář je skautská webová aplikace ze šablony [ai-agents-pwa-php-mysql-skauting.cz](https://github.com/PavelKonecny/ai-agents-pwa-php-mysql-skauting.cz)
(PWA + PHP API + MySQL, hosting skauting.cz, kód na github.com/skaut).

**Než začneš cokoli měnit, přečti `.claude/skills/skaut-app/SKILL.md`** – obsahuje architekturu,
závazná pravidla (oprávnění na serveru, schéma jen přidává, minimum osobních údajů, mobil na prvním
místě…) a postupy. Podrobnosti jsou v `.claude/skills/skaut-app/reference/`.

Nejdůležitější příkazy:

```bash
npm install
npm run api        # lokální PHP API (SQLite) – vypíše pozvánku správce
npm run dev        # aplikace na http://localhost:5190
npm run typecheck  # kontrola typů
npm test           # testy (API se testuje přes php -S; potřebuje PHP 8.1+)
npm run build      # produkční sestavení
```

Kde co je:

- `shared/schema.ts` – název aplikace, role, tabulky (jediný zdroj pravdy; generuje `api/lib/schema.php`)
- `api/lib/akce.php` – vlastní akce API (sem patří logika aplikace)
- `api/lib/core.php` – jádro: přihlášení tokenem, pozvánky, pomocné funkce
- `src/screens/` – obrazovky, `src/app.tsx` – rám, navigace, seznam obrazovek
- `src/components/ui.tsx` – ikony a UI prvky, `src/styles.css` – vzhled (JVS, tmavý režim), `src/lib/theme.ts` – nastavení vzhledu
- `tests/api.test.ts` – testy API

Komunikuj s uživatelem česky. Uživatel nemusí být programátor – vysvětluj výsledky srozumitelně
a u rozhodnutí, která mění data, oprávnění nebo osobní údaje, se nejdřív zeptej.
