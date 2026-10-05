<?php
// VLASTNÍ AKCE APLIKACE. Sem patří veškerá logika konkrétní aplikace.
// Každá akce: název 'objekt.sloveso' => funkce(Ctx $ctx, array $req): mixed (vrací data pro aplikaci).
// Oprávnění vždy kontroluj NA SERVERU ($ctx->jen('admin'), vlastnictví záznamu…) – klientovi se nevěří.
// Chyby pro uživatele: throw new Chyba('kód', 'Česká zpráva.').
declare(strict_types=1);

function akceAplikace(): array
{
    return [
        'polozky.list' => fn (Ctx $ctx, array $req) => polozkyList($ctx),
        'polozky.uloz' => fn (Ctx $ctx, array $req) => polozkyUloz($ctx, $req),
        'polozky.smaz' => fn (Ctx $ctx, array $req) => polozkySmaz($ctx, text($req, 'id', 80)),
    ];
}

// --- UKÁZKA: seznam položek (nahraď vlastní logikou) -----------------------------

function polozkyList(Ctx $ctx): array
{
    $list = zive($ctx->app->db->cti('Polozky'));
    usort($list, fn ($a, $b) => strcmp($b['updatedAt'], $a['updatedAt']));
    return $list;
}

/** Nová položka (bez id) nebo úprava existující (s id). Smí admin i člen. */
function polozkyUloz(Ctx $ctx, array $req): array
{
    $ctx->jen('admin', 'clen');
    $nazev = text($req, 'nazev', 200);
    if ($nazev === '') throw new Chyba('bad_request', 'Zadej název.');
    $id = textVolitelny($req, 'id', 80);
    $puvodni = $id !== '' ? podleId(zive($ctx->app->db->cti('Polozky')), $id) : null;
    if ($id !== '' && !$puvodni) throw new Chyba('not_found', 'Položka nenalezena.');
    return uloz($ctx, 'Polozky', array_merge($puvodni ?? prazdnyRadek('Polozky', $ctx->app->uuid()), [
        'nazev' => $nazev,
        'poznamka' => textVolitelny($req, 'poznamka', MAX_HODNOTA),
        'hotovo' => ($req['hotovo'] ?? '') === '1' ? '1' : '',
    ]));
}

/** Smazat smí jen správce (ukázka omezení podle role). Mazání je měkké (deleted = '1'). */
function polozkySmaz(Ctx $ctx, string $id): array
{
    $ctx->jen('admin');
    $p = podleId(zive($ctx->app->db->cti('Polozky')), $id);
    if (!$p) throw new Chyba('not_found', 'Položka nenalezena.');
    uloz($ctx, 'Polozky', array_merge($p, ['deleted' => '1']));
    return ['ok' => true];
}
