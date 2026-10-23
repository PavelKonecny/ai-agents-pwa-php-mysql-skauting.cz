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

    // Podrobné chybové hlášky v odpovědích – jen pro ladění, v provozu false.
    'debug' => false,
];
