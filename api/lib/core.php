<?php
// Jádro API: obsluha požadavku, přihlášení tokenem z pozvánky, pozvánky a správa přístupů.
// Vlastní akce aplikace patří do api/lib/akce.php – tento soubor upravuj jen výjimečně.
declare(strict_types=1);

require_once __DIR__ . '/schema.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/akce.php';
require_once __DIR__ . '/skautis.php';

/** Chyba pro uživatele: kód (pro aplikaci) + česká zpráva (zobrazí se). */
final class Chyba extends Exception
{
    public function __construct(public string $kod, string $zprava) { parent::__construct($zprava); }
}

final class App
{
    private ?string $pevnyCas = null;

    public function __construct(public Db $db, public array $cfg) {}

    public function ted(): string
    {
        if ($this->pevnyCas !== null) return $this->pevnyCas;
        $t = microtime(true);
        return gmdate('Y-m-d\TH:i:s', (int) $t) . sprintf('.%03dZ', (int) (($t - floor($t)) * 1000));
    }

    /** Jen pro testy (config 'test' => true). */
    public function nastavCas(?string $iso): void { $this->pevnyCas = $iso; }

    public function uuid(): string
    {
        $b = random_bytes(16);
        $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
        $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
    }

    public function token(): string { return bin2hex(random_bytes(24)); }
    public static function otisk(string $s): string { return hash('sha256', $s); }
    public function cfg(string $klic, mixed $vychozi = null): mixed { return $this->cfg[$klic] ?? $vychozi; }
}

/** Kdo volá: řádek z Pristupy. */
final class Ctx
{
    public function __construct(public App $app, public array $kdo) {}
    public function role(): string { return $this->kdo['role']; }
    public function jmeno(): string { return $this->kdo['prezdivka'] !== '' ? $this->kdo['prezdivka'] : 'neznámý'; }

    /** Povolí akci jen vyjmenovaným rolím. */
    public function jen(string ...$role): void
    {
        if (!in_array($this->role(), $role, true)) throw new Chyba('forbidden', 'Na tuto akci nemáš oprávnění.');
    }
}

// --- Pomocné funkce pro akce -------------------------------------------------

function zive(array $radky): array { return array_values(array_filter($radky, fn ($r) => ($r['deleted'] ?? '') !== '1')); }

function podleId(array $radky, string $id): ?array
{
    foreach ($radky as $r) if (($r['id'] ?? '') === $id) return $r;
    return null;
}

/** Povinný text z požadavku (ořízne mezery, hlídá délku). */
function text(array $req, string $pole, int $max = 200): string
{
    $v = $req[$pole] ?? null;
    if (!is_string($v)) throw new Chyba('bad_request', "Chybí nebo je neplatné pole „{$pole}“.");
    $s = trim($v);
    if (mb_strlen($s) > $max) throw new Chyba('bad_request', "Pole „{$pole}“ je příliš dlouhé.");
    return $s;
}

function textVolitelny(array $req, string $pole, int $max = 200): string
{
    return ($req[$pole] ?? null) === null || $req[$pole] === '' ? '' : text($req, $pole, $max);
}

function prazdnyRadek(string $tabulka, string $id): array
{
    $r = [];
    foreach (Db::sloupce($tabulka) as $c) $r[$c] = '';
    $r['id'] = $id;
    return $r;
}

/** Uloží nový nebo upravený záznam s metadaty (kdo a kdy). */
function uloz(Ctx $ctx, string $tabulka, array $radek): array
{
    $radek = array_merge($radek, ['updatedAt' => $ctx->app->ted(), 'updatedBy' => $ctx->jmeno()]);
    $ctx->app->db->withLock(fn () => $ctx->app->db->zapis($tabulka, [$radek]));
    return $radek;
}

// --- Obsluha požadavku ---------------------------------------------------------

function obsluz(App $app, array $req): array
{
    try {
        return ['ok' => true, 'data' => rozcestnik($app, $req)];
    } catch (Chyba $e) {
        return ['ok' => false, 'error' => ['code' => $e->kod, 'message' => $e->getMessage()]];
    } catch (Throwable $e) {
        error_log('[api] ' . $e);
        return ['ok' => false, 'error' => ['code' => 'internal', 'message' => $app->cfg('debug') ? $e->getMessage() : 'Chyba serveru. Zkus to prosím znovu.']];
    }
}

function rozcestnik(App $app, array $req): mixed
{
    $akce = (string) ($req['action'] ?? '');
    if ($app->cfg('test') && isset($req['_now'])) $app->nastavCas((string) $req['_now']);
    // akce bez přihlášení
    if ($akce === 'ping') return ['serverTime' => $app->ted()];
    if ($akce === 'info') return ['aplikace' => APLIKACE, 'skautis' => skautisZapnuty($app) ? skautisLoginUrl($app) : ''];
    if ($akce === 'skautis.prihlasit') return skautisPrihlasit($app, $req);

    $ctx = prihlasit($app, $req['token'] ?? null);
    $vestavene = [
        'hello' => fn () => hello($ctx),
        'profil.prezdivka' => fn () => profilPrezdivka($ctx, $req),
        'pristupy.list' => fn () => pristupyList($ctx),
        'pristupy.create' => fn () => pristupyCreate($ctx, $req),
        'pristupy.revoke' => fn () => pristupyRevoke($ctx, text($req, 'id', 80)),
        'pristupy.relink' => fn () => pristupyRelink($ctx, text($req, 'id', 80)),
        'pristupy.role' => fn () => pristupyRole($ctx, $req),
        'skautis.propojit' => fn () => skautisPropojit($ctx, $req),
    ];
    if (isset($vestavene[$akce])) return $vestavene[$akce]();
    $vlastni = akceAplikace();
    if (isset($vlastni[$akce])) return $vlastni[$akce]($ctx, $req);
    throw new Chyba('bad_request', "Neznámá akce „{$akce}“.");
}

function prihlasit(App $app, mixed $token): Ctx
{
    if (!is_string($token) || strlen($token) < 16) throw new Chyba('unauthorized', 'Chybí přístupový klíč. Otevři znovu pozvánku.');
    $p = zive($app->db->cti('Pristupy', '`tokenHash` = ?', [App::otisk($token)]))[0] ?? null;
    if (!$p || $p['zruseno'] !== '') throw new Chyba('unauthorized', 'Pozvánka neplatí nebo byla zrušena. Požádej správce o novou.');
    $ted = $app->ted();
    // poslední použití stačí zapisovat jednou za hodinu
    if ($p['posledniPouziti'] === '' || strtotime($ted) - strtotime($p['posledniPouziti']) > 3600) {
        $p['posledniPouziti'] = $ted;
        $app->db->withLock(fn () => $app->db->zapis('Pristupy', [$p]));
    }
    return new Ctx($app, $p);
}

function verejnyPristup(array $p): array
{
    return [
        'id' => $p['id'], 'role' => $p['role'], 'prezdivka' => $p['prezdivka'], 'popis' => $p['popis'],
        'vytvoreno' => $p['vytvoreno'], 'zruseno' => $p['zruseno'], 'posledniPouziti' => $p['posledniPouziti'],
        'skautis' => $p['skautisOsoba'] !== '',
    ];
}

function hello(Ctx $ctx): array
{
    return ['ja' => verejnyPristup($ctx->kdo), 'aplikace' => APLIKACE, 'skautis' => skautisZapnuty($ctx->app) ? skautisLoginUrl($ctx->app) : '', 'serverTime' => $ctx->app->ted()];
}

function profilPrezdivka(Ctx $ctx, array $req): array
{
    $prezdivka = text($req, 'prezdivka', 40);
    if ($prezdivka === '') throw new Chyba('bad_request', 'Zadej přezdívku.');
    $ctx->kdo = uloz($ctx, 'Pristupy', array_merge($ctx->kdo, ['prezdivka' => $prezdivka]));
    return hello($ctx);
}

// --- Pozvánky ------------------------------------------------------------------

function pristupyList(Ctx $ctx): array
{
    $ctx->jen('admin');
    $list = array_map('verejnyPristup', zive($ctx->app->db->cti('Pristupy')));
    usort($list, fn ($a, $b) => strcmp($b['vytvoreno'], $a['vytvoreno']));
    return $list;
}

function pristupyCreate(Ctx $ctx, array $req): array
{
    $ctx->jen('admin');
    $role = text($req, 'role', 20);
    if (!in_array($role, ROLE, true)) throw new Chyba('bad_request', 'Neplatná role.');
    $prezdivka = text($req, 'prezdivka', 40);
    if ($prezdivka === '') throw new Chyba('bad_request', 'Zadej přezdívku pozvaného.');
    $token = $ctx->app->token();
    $radek = uloz($ctx, 'Pristupy', array_merge(prazdnyRadek('Pristupy', $ctx->app->uuid()), [
        'tokenHash' => App::otisk($token), 'role' => $role, 'prezdivka' => $prezdivka,
        'popis' => textVolitelny($req, 'popis', 100), 'vytvoreno' => $ctx->app->ted(),
    ]));
    return ['token' => $token, 'pristup' => verejnyPristup($radek)];
}

function nactiCiziPristup(Ctx $ctx, string $id): array
{
    $ctx->jen('admin');
    if ($id === $ctx->kdo['id']) throw new Chyba('bad_request', 'Vlastní přístup takto měnit nelze.');
    $p = podleId(zive($ctx->app->db->cti('Pristupy')), $id);
    if (!$p) throw new Chyba('not_found', 'Přístup nenalezen.');
    return $p;
}

function pristupyRevoke(Ctx $ctx, string $id): array
{
    $p = nactiCiziPristup($ctx, $id);
    return verejnyPristup(uloz($ctx, 'Pristupy', array_merge($p, ['zruseno' => $ctx->app->ted()])));
}

/** Nový odkaz pro existující přístup (ztracená pozvánka, nový telefon). Starý odkaz přestane platit. */
function pristupyRelink(Ctx $ctx, string $id): array
{
    $p = nactiCiziPristup($ctx, $id);
    $token = $ctx->app->token();
    $radek = uloz($ctx, 'Pristupy', array_merge($p, ['tokenHash' => App::otisk($token), 'zruseno' => '']));
    return ['token' => $token, 'pristup' => verejnyPristup($radek)];
}

function pristupyRole(Ctx $ctx, array $req): array
{
    $p = nactiCiziPristup($ctx, text($req, 'id', 80));
    $role = text($req, 'role', 20);
    if (!in_array($role, ROLE, true)) throw new Chyba('bad_request', 'Neplatná role.');
    return verejnyPristup(uloz($ctx, 'Pristupy', array_merge($p, ['role' => $role])));
}

/** První správce (install.php). Vrací token pozvánky – zobrazí se jen jednou. */
function zalozSpravce(App $app, bool $dalsi = false): string
{
    return $app->db->withLock(function () use ($app, $dalsi) {
        $spravci = array_filter(zive($app->db->cti('Pristupy')), fn ($p) => $p['role'] === 'admin' && $p['zruseno'] === '');
        if ($spravci && !$dalsi) throw new Chyba('exists', 'Aplikace už správce má.');
        $token = $app->token();
        $ted = $app->ted();
        $app->db->zapis('Pristupy', [array_merge(prazdnyRadek('Pristupy', $app->uuid()), [
            'tokenHash' => App::otisk($token), 'role' => 'admin', 'prezdivka' => 'Správce', 'popis' => 'založeno instalací',
            'vytvoreno' => $ted, 'updatedAt' => $ted, 'updatedBy' => 'instalace',
        ])]);
        return $token;
    });
}
