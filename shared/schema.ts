// JEDINÝ ZDROJ PRAVDY o aplikaci a datech. Z tohoto souboru se generuje api/lib/schema.php
// (npm run build / npm test). Tabulky a sloupce se v MySQL vytvoří a doplní samy při prvním požadavku.
//
// Pravidla (viz .claude/skills/skaut-app/SKILL.md):
//  - Všechny hodnoty jsou text. Čísla, data (RRRR-MM-DD) i příznaky ('1' / '') se ukládají jako text.
//  - Sloupce se jen PŘIDÁVAJÍ. Nikdy nepřejmenovávat ani nemazat – produkční data by se ztratila.
//  - Každý záznam má navíc id (UUID) a metadata updatedAt, updatedBy, deleted ('1' = smazáno, měkce).

export const APLIKACE = {
  nazev: 'Skautská aplikace',
  kratce: 'Aplikace',
  popis: 'Šablona skautské webové aplikace',
};

/** Role přístupu. admin = správce aplikace (zve ostatní), clen = běžný uživatel. Další role přidávej sem. */
export const ROLE = ['admin', 'clen'] as const;
export type Role = typeof ROLE[number];
export const ROLE_NAZVY: Record<Role, string> = { admin: 'správce', clen: 'člen' };

/** Tabulky: název -> datové sloupce (bez id a metadat). */
export const TABULKY = {
  /** Přístupy (pozvánky). Token se ukládá jen jako SHA-256 otisk. skautisOsoba = ID_Person ze skautISu. */
  Pristupy: ['tokenHash', 'role', 'prezdivka', 'popis', 'vytvoreno', 'zruseno', 'posledniPouziti', 'skautisOsoba'],
  /** Jednorázové kódy po přihlášení přes skautIS (platí 5 minut). */
  SkautisKody: ['kodHash', 'osoba', 'jmeno', 'plati'],
  /** UKÁZKA – nahraď vlastními tabulkami aplikace. */
  Polozky: ['nazev', 'poznamka', 'hotovo'],
} as const;

export const META = ['updatedAt', 'updatedBy', 'deleted'] as const;

export type Tabulka = keyof typeof TABULKY;
export type Radek = { id: string; updatedAt?: string; updatedBy?: string; deleted?: string; [pole: string]: string | undefined };

export function sloupce(t: Tabulka): string[] {
  return ['id', ...TABULKY[t], ...META];
}

/** Max. délka jedné hodnoty (obrázky jako data URL zvlášť). */
export const MAX_HODNOTA = 5000;
