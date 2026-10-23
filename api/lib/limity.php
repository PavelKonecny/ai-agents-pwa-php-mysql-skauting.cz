<?php
// LIMIT POŽADAVKŮ: obecný strop podle IP a podle přístupu (tokenu), přísnější pro anonymní a drahé akce.
// Počítadla jsou v tabulce Pocitadla po minutových oknech a NEJDOU přes globální zámek (Db::pricti je jeden UPDATE/INSERT),
// aby se limit nestal úzkým hrdlem. IP z REMOTE_ADDR (za reverzní proxy ho doplní Apache modulem mod_remoteip –
// hlavičku X-Forwarded-For sami nečteme, podvrhnout ji může kdokoli). Ukládá se jen HMAC otisk IP, ne IP adresa.
// Nastavení: config 'limity' => ['ip' => 600, 'token' => 300, 'anonymni' => 40, 'drahe' => 30] (požadavků za minutu).
// Drahé akce aplikace (AI, nahrávání souborů, import, odchozí volání) přidej do DRAHE_AKCE.
declare(strict_types=1);

const LIMITY_VYCHOZI = ['ip' => 600, 'token' => 300, 'anonymni' => 40, 'drahe' => 30];

/** Akce, které stojí server hodně (odchozí volání, velká data, AI, nahrávání) – přísnější limit na přístup. */
const DRAHE_AKCE = ['pristupy.create'];

function limit(App $app, string $druh): int
{
    $cfg = (array) $app->cfg('limity', []);
    return (int) ($cfg[$druh] ?? LIMITY_VYCHOZI[$druh]);
}

/** Otisk IP klienta (HMAC s tajným install_key) – do počítadel a limitů, nikdy čitelná IP. */
function otiskIp(App $app, string $ucel): string
{
    return $ucel . ':' . substr(hash_hmac('sha256', (string) ($_SERVER['REMOTE_ADDR'] ?? ''), (string) $app->cfg('install_key', 'skaut-app')), 0, 32);
}

/** Přičte požadavek do počítadla (minutové okno podle času aplikace) a při překročení vyhodí rate_limit. */
function hlidejPocitadlo(App $app, string $klic, int $max): void
{
    if ($max <= 0) return;
    if ($app->db->pricti(hash('sha256', $klic), substr($app->ted(), 0, 16), $app->uuid()) > $max) {
        throw new Chyba('rate_limit', 'Příliš mnoho požadavků za krátkou dobu. Zkus to prosím za minutu.');
    }
}

/** Limity jednoho požadavku API (volá rozcestník před akcí). */
function hlidejLimity(App $app, string $akce, mixed $token): void
{
    $ip = otiskIp($app, 'ip');
    hlidejPocitadlo($app, $ip, limit($app, 'ip'));
    if (!is_string($token) || $token === '') {
        hlidejPocitadlo($app, "anonymni|{$ip}", limit($app, 'anonymni'));
    } else {
        $tok = 'token:' . substr(App::otisk($token), 0, 32);
        hlidejPocitadlo($app, $tok, limit($app, 'token'));
        if (in_array($akce, DRAHE_AKCE, true)) hlidejPocitadlo($app, "drahe|{$tok}", limit($app, 'drahe'));
    }
    if (random_int(1, 50) === 1) $app->db->uklidPocitadel(substr(gmdate('Y-m-d\TH:i', strtotime($app->ted()) - 3600), 0, 16));
}
