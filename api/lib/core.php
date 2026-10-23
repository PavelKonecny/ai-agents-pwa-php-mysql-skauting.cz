<?php
// Jádro API: obsluha požadavku, přihlášení tokenem z pozvánky, pozvánky a správa přístupů.
// Vlastní akce aplikace patří do api/lib/akce.php – tento soubor upravuj jen výjimečně.
declare(strict_types=1);

require_once __DIR__ . '/schema.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/akce.php';
require_once __DIR__ . '/limity.php';
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

/**
 * Volitelný odkaz na web z požadavku: prázdný, nebo http(s)://… Jiné adresy (javascript:, data:…) odmítne –
 * uložený javascript: odkaz by se po kliknutí spustil v aplikaci a mohl ukrást přístup z prohlížeče.
 * Každé pole s adresou ukládej přes tuto funkci; v aplikaci ho zobrazuj přes <OdkazVen> (src/components/ui.tsx).
 */
function odkaz(array $req, string $pole, int $max = 2000): string
{
    $v = textVolitelny($req, $pole, $max);
    if ($v !== '' && !preg_match('#^https?://[^\s]+$#i', $v)) throw new Chyba('bad_request', 'Odkaz musí začínat http:// nebo https://');
    return $v;
}

/**
 * Ověřený cíl stahování ['host', 'port', 'ip'], nebo null: jen http(s), porty 80/443 a veřejné IP adresy.
 * Ochrana proti zneužití serveru k požadavkům do jeho vnitřní sítě (SSRF) – localhost, 10.x, 192.168.x,
 * 169.254.x (metadata cloudu)… $test = povolit 127.0.0.1 a jiné porty (jen testy).
 */
function verejnaAdresa(string $url, bool $test = false): ?array
{
    $u = parse_url($url);
    $schema = strtolower($u['scheme'] ?? '');
    $host = strtolower(trim($u['host'] ?? '', '[]'));
    if (!in_array($schema, ['http', 'https'], true) || $host === '' || isset($u['user']) || isset($u['pass'])) return null;
    $port = (int) ($u['port'] ?? ($schema === 'https' ? 443 : 80));
    if (!$test && !in_array($port, [80, 443], true)) return null;
    $ips = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : array_merge(
        array_column(@dns_get_record($host, DNS_A) ?: [], 'ip'),
        array_column(@dns_get_record($host, DNS_AAAA) ?: [], 'ipv6'),
    );
    if (!$ips) return null;
    foreach ($ips as $ip) {
        if ($test && $ip === '127.0.0.1') continue;
        if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) return null;
        // IPv4 zabalená v IPv6 (::ffff:10.0.0.1) a sdílený prostor operátorů 100.64.0.0/10 filtr nezachytí
        if (stripos($ip, '::ffff:') === 0) return null;
        if (str_contains($ip, '.') && (ip2long($ip) & 0xFFC00000) === 0x64400000) return null;
    }
    return ['host' => $host, 'port' => $port, 'ip' => $ips[0]];
}

/**
 * Stáhne stránku z webu (např. náhled odkazu) – jen z veřejných adres, max. $max bajtů, krátké časové limity.
 * Přesměrování sleduje ručně a každou další adresu znovu ověří; spojí se jen na ověřenou IP.
 * Vrací ['kod' => HTTP kód, 'typ' => Content-Type, 'telo' => obsah], nebo null. Stahování z webu nikdy
 * nedělej přímo přes curl / file_get_contents s adresou od uživatele – vždy přes tuto funkci.
 */
function stahniVerejne(App $app, string $url, int $max = 300000): ?array
{
    if (!function_exists('curl_init')) return null;
    $test = (bool) $app->cfg('test');
    for ($i = 0; $i <= 4; $i++) {
        $cil = verejnaAdresa($url, $test);
        if (!$cil) return null;
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => false, CURLOPT_CONNECTTIMEOUT => 4, CURLOPT_TIMEOUT => 8,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS, CURLOPT_RANGE => '0-' . $max, CURLOPT_USERAGENT => 'SkautApp/1.0',
            CURLOPT_RESOLVE => ["{$cil['host']}:{$cil['port']}:" . (str_contains($cil['ip'], ':') ? "[{$cil['ip']}]" : $cil['ip'])],
        ]);
        $telo = curl_exec($ch);
        $kod = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $typ = (string) curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        $dalsi = (string) curl_getinfo($ch, CURLINFO_REDIRECT_URL);
        if ($telo === false) return null;
        if ($kod >= 300 && $kod < 400 && $dalsi !== '') { $url = $dalsi; continue; }
        return ['kod' => $kod, 'typ' => $typ, 'telo' => substr((string) $telo, 0, $max)];
    }
    return null;
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
        error_log('[api] ' . popisVyjimky($e));
        return ['ok' => false, 'error' => ['code' => 'internal', 'message' => $app->cfg('debug') ? $e->getMessage() : 'Chyba serveru. Zkus to prosím znovu.']];
    }
}

/**
 * Výjimka do logu: třída, zpráva, místo a stack trace BEZ argumentů funkcí – argumenty můžou obsahovat
 * tokeny nebo osobní údaje (výchozí PHP je do trace vypisuje, pokud není zend.exception_ignore_args).
 */
function popisVyjimky(Throwable $e): string
{
    $out = get_class($e) . ': ' . $e->getMessage() . ' v ' . basename($e->getFile()) . ':' . $e->getLine();
    foreach (array_slice($e->getTrace(), 0, 12) as $i => $t) {
        $out .= "\n  #{$i} " . (isset($t['file']) ? basename($t['file']) . ':' . ($t['line'] ?? '?') . ' ' : '') . ($t['class'] ?? '') . ($t['type'] ?? '') . ($t['function'] ?? '') . '()';
    }
    return $out;
}

/**
 * Hodnota do CSV exportu: text začínající =, +, -, @ (i po mezeře či tabulátoru) by Excel spustil jako vzorec
 * („CSV injection“) – dostane apostrof. Čísla (i záporné částky) zůstanou čísly. Exporty vždy přes csvRadek().
 */
function csvBunka(mixed $v): mixed
{
    if (is_int($v) || is_float($v) || $v === null || is_bool($v)) return $v;
    $t = (string) $v;
    if (is_numeric(trim($t))) return $t;
    return preg_match('/^\s*[=+\-@]/u', $t) || preg_match('/^[\t\r]/', $t) ? "'" . $t : $t;
}

/** Řádek CSV se středníkem (Excel v češtině) a ochranou proti vzorcům. */
function csvRadek($f, array $radek): void
{
    fputcsv($f, array_map('csvBunka', $radek), ';', '"', '');
}

function rozcestnik(App $app, array $req): mixed
{
    $akce = (string) ($req['action'] ?? '');
    // posun času jen v testech pod php -S – v provozu ho nejde zapnout ani omylem ('test' => true v config.php)
    if ($app->cfg('test') && PHP_SAPI === 'cli-server' && isset($req['_now'])) $app->nastavCas((string) $req['_now']);
    // limit požadavků podle IP a tokenu (api/lib/limity.php)
    hlidejLimity($app, $akce, $req['token'] ?? null);
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

/** Přístup, který se tak dlouho nepoužil, přestane platit (správce ho obnoví „Novým odkazem“). */
const NEAKTIVNI_DNI = 365;
/** Pozvánka, kterou nikdo neotevřel, platí jen týden od vytvoření (nebo od nového odkazu). */
const PLATNOST_POZVANKY_DNI = 7;

function pozvankaVyprsela(App $app, array $p): bool
{
    return $p['posledniPouziti'] === '' && $p['vytvoreno'] !== '' && strtotime($app->ted()) - strtotime($p['vytvoreno']) > PLATNOST_POZVANKY_DNI * 86400;
}

function prihlasit(App $app, mixed $token): Ctx
{
    if (!is_string($token) || strlen($token) < 16) throw new Chyba('unauthorized', 'Chybí přístupový klíč. Otevři znovu pozvánku.');
    $p = zive($app->db->cti('Pristupy', '`tokenHash` = ?', [App::otisk($token)]))[0] ?? null;
    if (!$p || $p['zruseno'] !== '') throw new Chyba('unauthorized', 'Pozvánka neplatí nebo byla zrušena. Požádej správce o novou.');
    if (pozvankaVyprsela($app, $p)) throw new Chyba('vyprsela', 'Pozvánka vypršela – platí ' . PLATNOST_POZVANKY_DNI . ' dní od vytvoření. Požádej správce o nový odkaz.');
    $ted = $app->ted();
    $naposledy = $p['posledniPouziti'] !== '' ? $p['posledniPouziti'] : $p['vytvoreno'];
    if ($naposledy !== '' && strtotime($ted) - strtotime($naposledy) > NEAKTIVNI_DNI * 86400) {
        throw new Chyba('unauthorized', 'Přístup vypršel – rok se nepoužil. Požádej správce o nový odkaz.');
    }
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

/** Přístup pro správu (seznam lidí): navíc, zda neotevřená pozvánka už vypršela. */
function pristupProSpravu(App $app, array $p): array
{
    return verejnyPristup($p) + ['vyprsela' => pozvankaVyprsela($app, $p)];
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
    $list = array_map(fn ($p) => pristupProSpravu($ctx->app, $p), zive($ctx->app->db->cti('Pristupy')));
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
    // nový odkaz = nová platnost; dřív otevřený přístup se tím rovnou „obnoví“ (posledniPouziti), nový běží týden
    $radek = uloz($ctx, 'Pristupy', array_merge($p, ['tokenHash' => App::otisk($token), 'zruseno' => '', 'vytvoreno' => $ctx->app->ted(),
        'posledniPouziti' => $p['posledniPouziti'] !== '' ? $ctx->app->ted() : '']));
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
