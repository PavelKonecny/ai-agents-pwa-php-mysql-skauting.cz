<?php
// GENEROVANÝ SOUBOR – neupravovat. Zdroj: shared/schema.ts. Sestavení: npm run build / npm test
declare(strict_types=1);

const APLIKACE = ['nazev' => 'Skautská aplikace', 'kratce' => 'Aplikace', 'popis' => 'Šablona skautské webové aplikace'];
const ROLE = ['admin', 'clen'];
const TABULKY = ['Pristupy' => ['tokenHash', 'role', 'prezdivka', 'popis', 'vytvoreno', 'zruseno', 'posledniPouziti', 'skautisOsoba'], 'SkautisKody' => ['kodHash', 'osoba', 'jmeno', 'plati'], 'Polozky' => ['nazev', 'poznamka', 'hotovo']];
const META = ['updatedAt', 'updatedBy', 'deleted'];
const MAX_HODNOTA = 5000;
