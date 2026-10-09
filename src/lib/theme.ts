// Vzhled aplikace (jen pro tento telefon): světlý/tmavý režim, tapeta na pozadí, barva lišty, velikost písma.
// Volby se ukládají do localStorage; applyVzhled() se volá při startu (src/main.tsx).

import { signal } from '@preact/signals';
import ikonaSvg from '../../public/icon.svg?raw';

export const REZIMY = [
  { id: 'auto', label: 'Podle telefonu' },
  { id: 'light', label: 'Světlý' },
  { id: 'dark', label: 'Tmavý' },
] as const;

/** Tapety – vzory jsou v styles.css jako třídy .wp-<id>. */
export const TAPETY = [
  { id: '', label: 'Žádná' },
  { id: 'ctverecky', label: 'Čtverečky' },
  { id: 'les', label: 'Les' },
  { id: 'lilie', label: 'Lilie' },
  { id: 'hvezdy', label: 'Hvězdy' },
  { id: 'vrstevnice', label: 'Mapa' },
  { id: 'tabor', label: 'Tábor' },
] as const;

/** První barva = výchozí; musí odpovídat --c-navy v styles.css a pozadí public/icon.svg. */
export const BARVY_LISTY = [
  { id: '#527760', label: 'Zelená' },
  { id: '#002039', label: 'Skautská noc' },
  { id: '#075772', label: 'Modrá' },
  { id: '#1f4d2b', label: 'Lesní zelená' },
  { id: '#5a1f2e', label: 'Vínová' },
  { id: '#3b2a5a', label: 'Fialová' },
  { id: '#4a3b1f', label: 'Hnědá' },
  { id: '#a3245e', label: 'Růžová' },
] as const;

/** pismo = velikost písma v procentech (85–130, výchozí 100). */
export interface Vzhled { rezim: string; tapeta: string; lista: string; pismo: number }

export const PISMO_MIN = 85;
export const PISMO_MAX = 130;

const KEY = 'app-vzhled';
const VYCHOZI: Vzhled = { rezim: 'auto', tapeta: 'ctverecky', lista: BARVY_LISTY[0].id, pismo: 100 };

function load(): Vzhled {
  try { return { ...VYCHOZI, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return VYCHOZI; }
}

export const vzhled = signal<Vzhled>(load());

/** Ikona aplikace v barvě lišty (nahradí barvu pozadí ikony). */
export function ikonaVBarve(barva: string): string {
  return ikonaSvg.replace(`fill="${BARVY_LISTY[0].id}"`, `fill="${barva}"`);
}

/** Ikona v záložce prohlížeče v barvě lišty. Ikonu už nainstalované aplikace změnit nejde – ta je z manifestu. */
function nastavIkonu(barva: string) {
  if (!/^#[0-9a-f]{6}$/i.test(barva)) return;
  document.querySelector('link[rel="icon"]')?.setAttribute('href', `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ikonaVBarve(barva))}`);
}

export function applyVzhled() {
  const v = vzhled.value;
  const html = document.documentElement;
  if (v.rezim === 'auto') delete html.dataset.theme;
  else html.dataset.theme = v.rezim;
  document.body.className = document.body.className.replace(/\bwp-\S+/g, '').trim();
  if (v.tapeta) document.body.classList.add(`wp-${v.tapeta}`);
  html.style.setProperty('--c-navy', v.lista);
  const pismo = Math.min(PISMO_MAX, Math.max(PISMO_MIN, Number(v.pismo) || 100));
  html.style.fontSize = pismo === 100 ? '' : `${pismo}%`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', v.lista);
  nastavIkonu(v.lista);
}

export function setVzhled(patch: Partial<Vzhled>) {
  vzhled.value = { ...vzhled.value, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(vzhled.value)); } catch { /* nedostupné úložiště */ }
  applyVzhled();
}
