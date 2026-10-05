<?php
// Databázová vrstva: MySQL/MariaDB (hosting) nebo SQLite (lokální vývoj a testy).
// Každá tabulka ze shared/schema.ts = jedna SQL tabulka (název malými písmeny). Všechny hodnoty jsou text.
// Tabulky a sloupce se vytvoří/doplní samy (ensureSchema při každém požadavku – jeden levný dotaz).
declare(strict_types=1);

final class Db
{
    public PDO $pdo;
    public string $driver;
    private int $lockDepth = 0;

    public function __construct(array $cfg)
    {
        $this->pdo = new PDO($cfg['dsn'], $cfg['user'] ?? null, $cfg['password'] ?? null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_STRINGIFY_FETCHES => true,
        ] + (str_starts_with($cfg['dsn'], 'mysql:') ? [PDO::MYSQL_ATTR_FOUND_ROWS => true] : []));
        $this->driver = $this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        if ($this->driver === 'mysql') {
            $this->pdo->exec('SET NAMES utf8mb4 COLLATE utf8mb4_bin');
        } else {
            $this->pdo->exec('PRAGMA journal_mode = WAL');
            $this->pdo->exec('PRAGMA busy_timeout = 10000');
        }
    }

    public static function nazev(string $tabulka): string { return strtolower($tabulka); }

    /** @return string[] */
    public static function sloupce(string $tabulka): array { return array_merge(['id'], TABULKY[$tabulka], META); }

    /** Krátké indexovatelné sloupce (id, …Id, otisky, data); ostatní jsou dlouhý text. */
    private static function klicovy(string $c): bool
    {
        return $c === 'id' || str_ends_with($c, 'Id') || str_ends_with($c, 'Hash') || in_array($c, ['updatedAt', 'updatedBy', 'deleted', 'role', 'datum'], true);
    }

    private function typ(string $c): string
    {
        if (self::klicovy($c)) return $this->driver === 'mysql' ? "VARCHAR(191) NOT NULL DEFAULT ''" : "TEXT NOT NULL DEFAULT ''";
        return $this->driver === 'mysql' ? 'MEDIUMTEXT NULL' : "TEXT NOT NULL DEFAULT ''";
    }

    /** Vytvoří chybějící tabulky a doplní chybějící sloupce. Bezpečné spouštět opakovaně. */
    public function migrate(): array
    {
        $log = [];
        foreach (array_keys(TABULKY) as $t) {
            $nazev = self::nazev($t);
            $cols = self::sloupce($t);
            $existujici = $this->existujiciSloupce($nazev);
            if ($existujici === null) {
                $defs = array_map(fn ($c) => "`$c` " . $this->typ($c), $cols);
                $defs[] = 'PRIMARY KEY (`id`)';
                $suffix = $this->driver === 'mysql' ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin' : '';
                $this->pdo->exec("CREATE TABLE `$nazev` (" . implode(', ', $defs) . ")$suffix");
                foreach ($cols as $c) {
                    if (str_ends_with($c, 'Hash')) $this->pdo->exec("CREATE INDEX `ix_{$nazev}_$c` ON `$nazev` (`$c`)");
                }
                $log[] = "vytvořena tabulka $nazev";
                continue;
            }
            foreach ($cols as $c) {
                if (!in_array($c, $existujici, true)) {
                    $this->pdo->exec("ALTER TABLE `$nazev` ADD COLUMN `$c` " . $this->typ($c));
                    $log[] = "doplněn sloupec $nazev.$c";
                }
            }
        }
        $this->ulozOtisk();
        return $log;
    }

    private static function otisk(): string { return md5(json_encode(TABULKY)); }

    /** Jeden levný dotaz na otisk schématu; po nasazení nové verze s novou tabulkou/sloupcem spustí migrate(). */
    public function ensureSchema(): void
    {
        try {
            $cur = $this->pdo->query("SELECT `hodnota` FROM `app_meta` WHERE `klic` = 'schema'")->fetchColumn();
        } catch (PDOException) {
            $cur = false;
        }
        if ($cur === self::otisk()) return;
        try {
            $this->migrate();
        } catch (PDOException) {
            $this->migrate(); // souběžný požadavek mezitím doplnil totéž
        }
    }

    private function ulozOtisk(): void
    {
        $this->pdo->exec('CREATE TABLE IF NOT EXISTS `app_meta` (`klic` VARCHAR(64) NOT NULL PRIMARY KEY, `hodnota` TEXT NOT NULL)'
            . ($this->driver === 'mysql' ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin' : ''));
        $this->pdo->exec("DELETE FROM `app_meta` WHERE `klic` = 'schema'");
        $this->pdo->prepare("INSERT INTO `app_meta` (`klic`, `hodnota`) VALUES ('schema', ?)")->execute([self::otisk()]);
    }

    /** @return string[]|null null = tabulka neexistuje */
    private function existujiciSloupce(string $nazev): ?array
    {
        if ($this->driver === 'mysql') {
            $st = $this->pdo->prepare('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?');
            $st->execute([$nazev]);
            $cols = $st->fetchAll(PDO::FETCH_COLUMN);
            return $cols ?: null;
        }
        $cols = $this->pdo->query("PRAGMA table_info(`$nazev`)")->fetchAll();
        return $cols ? array_column($cols, 'name') : null;
    }

    /** Zámek pro zápisy: transakce + (MySQL) pojmenovaný zámek. Re-entrantní. */
    public function withLock(callable $fn): mixed
    {
        if ($this->lockDepth > 0) return $fn();
        if ($this->driver === 'mysql') {
            $ok = $this->pdo->query("SELECT GET_LOCK(CONCAT(DATABASE(), ':zamek'), 20)")->fetchColumn();
            if ((string) $ok !== '1') throw new RuntimeException('Server je přetížený, zkus to za chvíli znovu.');
            $this->pdo->beginTransaction();
        } else {
            $this->pdo->exec('BEGIN IMMEDIATE');
        }
        $this->lockDepth++;
        try {
            $vysledek = $fn();
            $this->driver === 'mysql' ? $this->pdo->commit() : $this->pdo->exec('COMMIT');
            return $vysledek;
        } catch (Throwable $e) {
            if ($this->driver === 'mysql') { if ($this->pdo->inTransaction()) $this->pdo->rollBack(); }
            else { try { $this->pdo->exec('ROLLBACK'); } catch (Throwable) { /* už ukončeno */ } }
            throw $e;
        } finally {
            $this->lockDepth--;
            if ($this->driver === 'mysql') $this->pdo->query("SELECT RELEASE_LOCK(CONCAT(DATABASE(), ':zamek'))");
        }
    }

    /** Řádky tabulky (všechny hodnoty jako text). $kde = SQL podmínka s ? parametry. */
    public function cti(string $tabulka, string $kde = '', array $param = []): array
    {
        $sql = 'SELECT * FROM `' . self::nazev($tabulka) . '`' . ($kde !== '' ? " WHERE $kde" : '');
        $st = $this->pdo->prepare($sql);
        $st->execute($param);
        $cols = self::sloupce($tabulka);
        $out = [];
        foreach ($st->fetchAll() as $r) {
            $radek = [];
            foreach ($cols as $c) $radek[$c] = (string) ($r[$c] ?? '');
            $out[] = $radek;
        }
        return $out;
    }

    /** Upsert řádků podle id. */
    public function zapis(string $tabulka, array $radky): void
    {
        $nazev = self::nazev($tabulka);
        $cols = self::sloupce($tabulka);
        $bezId = array_values(array_filter($cols, fn ($c) => $c !== 'id'));
        $upd = $this->pdo->prepare("UPDATE `$nazev` SET " . implode(', ', array_map(fn ($c) => "`$c` = ?", $bezId)) . ' WHERE `id` = ?');
        $ins = $this->pdo->prepare("INSERT INTO `$nazev` (`" . implode('`, `', $cols) . '`) VALUES (' . implode(', ', array_fill(0, count($cols), '?')) . ')');
        foreach ($radky as $r) {
            $upd->execute(array_merge(array_map(fn ($c) => (string) ($r[$c] ?? ''), $bezId), [$r['id']]));
            if ($upd->rowCount() === 0) $ins->execute(array_map(fn ($c) => (string) ($r[$c] ?? ''), $cols));
        }
    }
}
