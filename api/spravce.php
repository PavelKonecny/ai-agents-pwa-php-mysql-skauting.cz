<?php
// Založení správce aplikace z příkazové řádky na serveru (bez webu a bez install_key):
//   php api/spravce.php            první správce (když už nějaký je, skončí)
//   php api/spravce.php --dalsi    další správce (např. při ztrátě pozvánky)
// Vypíše odkaz s pozvánkou – zobrazí se jen jednou. Z webu se nespustí.
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$configFile = getenv('APP_CONFIG') ?: __DIR__ . '/config.php';
if (!is_file($configFile)) {
    fwrite(STDERR, "Chybí konfigurace: {$configFile}\n");
    exit(1);
}
$config = require $configFile;

require_once __DIR__ . '/lib/core.php';
$db = new Db($config['db']);
$db->ensureSchema();
$app = new App($db, $config);

try {
    $token = zalozSpravce($app, in_array('--dalsi', $argv, true));
} catch (Chyba $e) {
    fwrite(STDERR, $e->kod === 'exists' ? "Správce už existuje. Dalšího založíš: php api/spravce.php --dalsi\n" : $e->getMessage() . "\n");
    exit(1);
}
$koren = rtrim((string) ($config['app_url'] ?? ''), '/');
echo "Pozvánka správce (zobrazí se jen teď, nikomu ji neposílej):\n";
echo ($koren !== '' ? "{$koren}/" : '<adresa aplikace>/') . "#/pozvanka?t={$token}\n";
