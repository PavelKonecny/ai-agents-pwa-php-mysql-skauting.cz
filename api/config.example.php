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

    // Tajný klíč pro install.php (vytvoření prvního správce). Dlouhý náhodný řetězec.
    'install_key' => 'ZMEN-MNE-dlouhy-nahodny-retezec',

    // Volitelné přihlášení přes skautIS. Prázdné appid = vypnuto (jen pozvánky).
    // 'test' => true používá testovací skautIS (test-is.skaut.cz) – nejdřív vždy testovat tam.
    'skautis' => ['appid' => '', 'test' => true],

    // Adresa aplikace pro odkaz v install.php. Na hostingu nech prázdné (odvodí se samo).
    'app_url' => '',

    // Podrobné chybové hlášky v odpovědích – jen pro ladění, v provozu false.
    'debug' => false,
];
