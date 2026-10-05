<?php
// Návratová adresa po přihlášení ve skautISu (tuto adresu zaregistruj ke svému APPID).
// skautIS sem pošle POST se skautIS_Token. Uložíme jednorázový kód a vrátíme uživatele do aplikace.
declare(strict_types=1);

header('Cache-Control: no-store');
$config = require (getenv('APP_CONFIG') ?: __DIR__ . '/config.php');
require_once __DIR__ . '/lib/core.php';

$zpet = static function (string $hash): never {
    header('Location: ../#/' . $hash, true, 303);
    exit;
};

$token = (string) ($_POST['skautIS_Token'] ?? '');
if ($token === '') $zpet('skautis?chyba=' . rawurlencode('skautIS nepředal přihlášení.'));
try {
    $db = new Db($config['db']);
    $db->ensureSchema();
    $kod = skautisZalozKod(new App($db, $config), $token);
    $zpet('skautis?kod=' . $kod);
} catch (Chyba $e) {
    $zpet('skautis?chyba=' . rawurlencode($e->getMessage()));
} catch (Throwable $e) {
    error_log('[skautis] ' . $e);
    $zpet('skautis?chyba=' . rawurlencode('Přihlášení přes skautIS se nepovedlo.'));
}
