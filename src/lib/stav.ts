// Globální stav aplikace (Preact signals): přihlášení, informace o mně, hlášky, směrování podle # v adrese.

import { computed, signal } from '@preact/signals';
import type { Role } from '../../shared/schema';

export interface Pristup {
  id: string; role: Role; prezdivka: string; popis: string;
  vytvoreno: string; zruseno: string; posledniPouziti: string; skautis: boolean;
}
export interface Hello { ja: Pristup; aplikace: { nazev: string; kratce: string; popis: string }; skautis: string; serverTime: string }

const KLIC = 'app-token';
const nacti = () => { try { return localStorage.getItem(KLIC) ?? ''; } catch { return ''; } };

export const token = signal(nacti());
export const hello = signal<Hello | null>(null);
export const ja = computed(() => hello.value?.ja ?? null);
export const jeSpravce = computed(() => ja.value?.role === 'admin');
export const online = signal(navigator.onLine);
addEventListener('online', () => { online.value = true; });
addEventListener('offline', () => { online.value = false; });

export function ulozToken(t: string) {
  token.value = t;
  try { t ? localStorage.setItem(KLIC, t) : localStorage.removeItem(KLIC); } catch { /* soukromé okno */ }
}

/** Událost pro obrazovky: uživatel klepl na „Aktualizovat“ v horní liště → načíst data znovu. */
export const OBNOVIT = 'app-obnovit';

// --- Hlášky ---------------------------------------------------------------------
export const hlaska = signal<{ text: string; chyba: boolean } | null>(null);
let casovac: ReturnType<typeof setTimeout> | undefined;
export function ukaz(text: string, chyba = false) {
  hlaska.value = { text, chyba };
  clearTimeout(casovac);
  casovac = setTimeout(() => { hlaska.value = null; }, chyba ? 6000 : 3000);
}

// --- Směrování: #/cesta?param=… -----------------------------------------------------
const parse = () => {
  const [cesta, dotaz = ''] = location.hash.replace(/^#\/?/, '').split('?');
  return { cesta: cesta.split('/').filter(Boolean), param: new URLSearchParams(dotaz) };
};
export const trasa = signal(parse());
addEventListener('hashchange', () => { trasa.value = parse(); });
export function jdi(cesta: string, nahradit = false) {
  const h = `#/${cesta}`;
  if (nahradit) history.replaceState(null, '', h); else history.pushState(null, '', h);
  trasa.value = parse();
}
