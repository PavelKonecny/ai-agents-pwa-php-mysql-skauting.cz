<?php
// První nastavení: vytvoří tabulky a pozvánku pro prvního správce.
// Otevři v ANONYMNÍM okně:  https://<adresa>/api/install.php?key=<install_key z config.php>
//   …&dalsi=1   vytvoří dalšího správce (např. při ztrátě pozvánky)
declare(strict_types=1);

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');

$stranka = static function (string $titulek, string $obsah): never {
    echo '<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<title>Instalace</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;color:#14212b}'
        . 'h1{color:#002039}code,.link{word-break:break-all;background:#f0f4f7;padding:.6rem;border-radius:8px;display:block}.ok{color:#2e8b57}.err{color:#c0392b}</style></head><body>'
        . "<h1>$titulek</h1>$obsah</body></html>";
    exit;
};
$esc = static fn (string $s): string => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');

$configFile = getenv('APP_CONFIG') ?: __DIR__ . '/config.php';
if (!is_file($configFile)) $stranka('Chybí konfigurace', '<p class="err">Chybí <b>api/config.php</b>. Zkopíruj <b>config.example.php</b> jako <b>config.php</b> a vyplň ho.</p>');
$config = require $configFile;

$klic = (string) ($config['install_key'] ?? '');
if ($klic === '' || str_starts_with($klic, 'ZMEN-MNE')) $stranka('Nastav klíč', '<p class="err">V config.php nastav vlastní <b>install_key</b>.</p>');
if (!hash_equals($klic, (string) ($_GET['key'] ?? ''))) { http_response_code(403); $stranka('Přístup odepřen', '<p class="err">Chybí nebo nesedí parametr <b>?key=</b>.</p>'); }

require_once __DIR__ . '/lib/core.php';
try {
    $db = new Db($config['db']);
    $log = $db->migrate();
} catch (Throwable $e) {
    $stranka('Chyba databáze', '<p class="err">Nepodařilo se připojit nebo vytvořit tabulky:</p><code>' . $esc($e->getMessage()) . '</code>');
}

$app = new App($db, $config);
$https = (($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
// adresa aplikace: z config.php (app_url), jinak odvozená z adresy této stránky (…/api/install.php → …/)
$koren = (string) ($config['app_url'] ?? '') ?: ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost')
    . rtrim(str_replace('\\', '/', dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '/api/install.php'))), '/') . '/';

$obsah = '<p class="ok">Databáze je připravená.</p>';
if ($log) $obsah .= '<ul><li>' . implode('</li><li>', array_map($esc, $log)) . '</li></ul>';
try {
    $token = zalozSpravce($app, isset($_GET['dalsi']));
    $odkaz = $koren . '#/pozvanka?t=' . $token;
    $obsah .= '<h2>Pozvánka správce</h2><p>Otevři tento odkaz v telefonu nebo prohlížeči. Je to tvůj osobní přístup – nikomu ho neposílej, zobrazí se jen teď:</p>'
        . '<a class="link" href="' . $esc($odkaz) . '">' . $esc($odkaz) . '</a>';
} catch (Chyba $e) {
    if ($e->kod !== 'exists') throw $e;
    $obsah .= '<p>Správce už existuje. Dalšího vytvoříš přidáním <b>&amp;dalsi=1</b> k adrese této stránky.</p>';
}
$stranka(APLIKACE['nazev'] . ' – instalace', $obsah);
