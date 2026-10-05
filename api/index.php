<?php
// API aplikace. Aplikace posílá POST s JSON tělem { action, token, … } (Content-Type: text/plain kvůli CORS).
// Odpověď: { ok: true, data } nebo { ok: false, error: { code, message } }.
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$out = static function (array $vysledek): never {
    echo json_encode($vysledek, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
};

$configFile = getenv('APP_CONFIG') ?: __DIR__ . '/config.php';
if (!is_file($configFile)) {
    $out(['ok' => false, 'error' => ['code' => 'not_configured', 'message' => 'Chybí api/config.php – vytvoř ho ze vzoru config.example.php.']]);
}
$config = require $configFile;

$metoda = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($metoda === 'GET') $out(['ok' => true, 'data' => ['status' => 'běží']]);

$req = json_decode((string) file_get_contents('php://input', false, null, 0, 3_000_000), true);
if (!is_array($req)) $out(['ok' => false, 'error' => ['code' => 'bad_request', 'message' => 'Neplatný požadavek.']]);

require_once __DIR__ . '/lib/core.php';
try {
    $db = new Db($config['db']);
    $db->ensureSchema(); // po nahrání nové verze doplní nové tabulky/sloupce samo
    $app = new App($db, $config);
} catch (Throwable $e) {
    error_log('[api] DB: ' . $e->getMessage());
    $out(['ok' => false, 'error' => ['code' => 'internal', 'message' => 'Nepodařilo se připojit k databázi.']]);
}
$out(obsluz($app, $req));
