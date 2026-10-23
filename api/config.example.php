<?php
// Vzor konfigurace. Na hostingu zkopíruj jako config.php a vyplň. config.php se NIKDY nedává do gitu
// a automatické nasazení ho nepřepisuje.
return [
    'db' => [
        // MySQL/MariaDB na hostingu skauting.cz (každá aplikace má vlastní databázi):
        'dsn' => 'mysql:host=localhost;dbname=NAZEV_DATABAZE;charset=utf8mb4',
        'user' => 'UZIVATEL',
        'password' => 'ZMEN-MNE',
        // Lokální vývoj bez MySQL:  'dsn' => 'sqlite:' . __DIR__ . '/data/app.sqlite',
    ],

    // Tajný klíč pro install.php (vytvoření prvního správce) – zadává se do formuláře, ne do adresy.
    // Dlouhý náhodný řetězec. Kdo ho zná, může si vytvořit správce: po nastavení ho změň nebo install.php smaž.
    'install_key' => 'ZMEN-MNE-dlouhy-nahodny-retezec',

    // Volitelné přihlášení přes skautIS. Prázdné appid = vypnuto (jen pozvánky).
    // 'test' => true používá testovací skautIS (test-is.skaut.cz) – nejdřív vždy testovat tam.
    'skautis' => ['appid' => '', 'test' => true],

    // Adresa aplikace (např. 'https://nazev.skauting.cz/') pro odkaz v install.php. Vyplň ji – prázdná se odvodí
    // z hlavičky Host požadavku. Adresy pro uživatele (pozvánky, přesměrování) nikdy nestav z hlavičky Host.
    'app_url' => '',

    // Limit požadavků za minutu (api/lib/limity.php): ip = vše z jedné IP, token = jeden přístup,
    // anonymni = bez přihlášení z jedné IP, drahe = náročné akce jednoho přístupu (DRAHE_AKCE).
    // Za reverzní proxy musí Apache doplnit skutečnou IP klienta do REMOTE_ADDR (mod_remoteip:
    // RemoteIPHeader X-Forwarded-For + RemoteIPTrustedProxy <adresa proxy>), jinak by všichni sdíleli IP proxy.
    // 'limity' => ['ip' => 600, 'token' => 300, 'anonymni' => 40, 'drahe' => 30],

    // Podrobné chybové hlášky v odpovědích – jen pro ladění, v provozu false.
    'debug' => false,
];
