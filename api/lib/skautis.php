<?php
// Volitelné přihlášení přes skautIS (pro dospělé s účtem ve skautISu). Výchozí přístup zůstávají pozvánky.
//
// POZOR: tento modul není ověřený proti skutečnému skautISu. Před nasazením ho vyzkoušej na
// testovacím skautISu (test-is.skaut.cz) – viz .claude/skills/skaut-app/reference/skautis.md.
//
// Tok:
//  1) aplikace přesměruje na  https://is.skaut.cz/Login/?appid=<APPID>
//  2) skautIS po přihlášení pošle POST na návratovou adresu registrovanou k APPID  →  api/skautis.php
//  3) skautis.php ověří token webovou službou (UserDetail), uloží jednorázový kód a přesměruje do aplikace #/skautis?kod=…
//  4) aplikace kód použije: přihlášený uživatel si účet PROPOJÍ (skautis.propojit),
//     nepřihlášený se PŘIHLÁSÍ, pokud už má propojený přístup (skautis.prihlasit).
//  Účet skautIS tedy nedává přístup sám o sobě – vždy ho nejdřív povolí správce pozvánkou.
declare(strict_types=1);

function skautisCfg(App $app): array { return (array) $app->cfg('skautis', []); }

function skautisZapnuty(App $app): bool { return trim((string) (skautisCfg($app)['appid'] ?? '')) !== ''; }

function skautisZaklad(App $app): string
{
    return !empty(skautisCfg($app)['test']) ? 'https://test-is.skaut.cz' : 'https://is.skaut.cz';
}

function skautisLoginUrl(App $app): string
{
    return skautisZaklad($app) . '/Login/?appid=' . rawurlencode((string) skautisCfg($app)['appid']);
}

/** Ověří přihlašovací token ze skautISu a vrátí osobu. Vyhodí Chyba, když token neplatí. */
function skautisOverToken(App $app, string $token): array
{
    if (!class_exists('SoapClient')) throw new Chyba('skautis', 'Na serveru chybí PHP rozšíření SOAP – požádej správce hostingu o jeho zapnutí.');
    try {
        $soap = new SoapClient(skautisZaklad($app) . '/JunakWebservice/UserManagement.asmx?WSDL', ['exceptions' => true, 'connection_timeout' => 8]);
        $res = $soap->UserDetail(['userDetailInput' => ['ID_Login' => $token, 'ID_Application' => (string) skautisCfg($app)['appid']]]);
        $u = $res->UserDetailResult ?? null;
    } catch (Throwable $e) {
        error_log('[skautis] ' . $e->getMessage());
        throw new Chyba('skautis', 'Přihlášení přes skautIS se nepodařilo ověřit. Zkus to znovu.');
    }
    $osoba = (string) ($u->ID_Person ?? '');
    if ($osoba === '') throw new Chyba('skautis', 'skautIS nevrátil údaje o osobě.');
    return ['osoba' => $osoba, 'jmeno' => (string) ($u->UserName ?? '')];
}

/** Krok 3: z POSTu ze skautISu udělá jednorázový kód (platí 5 minut). Volá api/skautis.php. */
function skautisZalozKod(App $app, string $token): string
{
    $o = skautisOverToken($app, $token);
    $kod = $app->token();
    $ted = $app->ted();
    $app->db->withLock(fn () => $app->db->zapis('SkautisKody', [array_merge(prazdnyRadek('SkautisKody', $app->uuid()), [
        'kodHash' => App::otisk($kod), 'osoba' => $o['osoba'], 'jmeno' => $o['jmeno'],
        'plati' => gmdate('Y-m-d\TH:i:s\Z', strtotime($ted) + 300), 'updatedAt' => $ted, 'updatedBy' => 'skautIS',
    ])]));
    return $kod;
}

/** Spotřebuje jednorázový kód (jde použít jen jednou). */
function skautisPouzijKod(App $app, array $req): array
{
    $kod = text($req, 'kod', 100);
    return $app->db->withLock(function () use ($app, $kod) {
        $r = zive($app->db->cti('SkautisKody', '`kodHash` = ?', [App::otisk($kod)]))[0] ?? null;
        if (!$r || strtotime($r['plati']) < strtotime($app->ted())) throw new Chyba('skautis', 'Přihlášení přes skautIS vypršelo. Zkus to znovu.');
        $app->db->zapis('SkautisKody', [array_merge($r, ['deleted' => '1'])]);
        return $r;
    });
}

/** Přihlášený uživatel (pozvánkou) si propojí účet skautIS – příště se může přihlásit přes skautIS. */
function skautisPropojit(Ctx $ctx, array $req): array
{
    $r = skautisPouzijKod($ctx->app, $req);
    $ctx->kdo = uloz($ctx, 'Pristupy', array_merge($ctx->kdo, ['skautisOsoba' => $r['osoba']]));
    return hello($ctx);
}

/** Přihlášení přes skautIS na novém zařízení: najde propojený přístup a vydá pro zařízení vlastní klíč. */
function skautisPrihlasit(App $app, array $req): array
{
    $r = skautisPouzijKod($app, $req);
    $vzor = null;
    foreach (zive($app->db->cti('Pristupy')) as $p) {
        if ($p['skautisOsoba'] === $r['osoba'] && $p['zruseno'] === '') { $vzor = $p; break; }
    }
    if (!$vzor) throw new Chyba('not_linked', 'Tento účet skautIS zatím není propojený. Nejdřív otevři pozvánku od správce a v profilu zvol „Propojit se skautIS“.');
    $token = $app->token();
    $ted = $app->ted();
    $app->db->withLock(fn () => $app->db->zapis('Pristupy', [array_merge($vzor, [
        'id' => $app->uuid(), 'tokenHash' => App::otisk($token), 'popis' => 'přihlášení přes skautIS',
        'vytvoreno' => $ted, 'posledniPouziti' => '', 'updatedAt' => $ted, 'updatedBy' => 'skautIS',
    ])]));
    return ['token' => $token];
}
