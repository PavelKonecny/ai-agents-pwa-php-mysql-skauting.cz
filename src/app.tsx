// Rám aplikace: horní lišta, obsah podle cesty (#/…), spodní navigace, hlášky.
// Nová obrazovka = soubor v src/screens + řádek v OBRAZOVKY (+ položka v NAV, pokud má být v menu).

import { useEffect } from 'preact/hooks';
import type { ComponentType } from 'preact';
import { api } from './lib/api';
import { hello, hlaska, jeSpravce, online, token, trasa, ukaz, ulozToken, type Hello } from './lib/stav';
import { Vitej, Pozvanka, SkautisNavrat } from './screens/Vitej';
import { Domu } from './screens/Domu';
import { Sprava } from './screens/Sprava';
import { Profil } from './screens/Profil';

const OBRAZOVKY: Record<string, ComponentType> = { '': Domu, sprava: Sprava, profil: Profil };
const NAV = [
  { cesta: '', nazev: 'Domů', ikona: '🏠' },
  { cesta: 'sprava', nazev: 'Správa', ikona: '⚙️', jenSpravce: true },
  { cesta: 'profil', nazev: 'Profil', ikona: '👤' },
];

export async function nactiHello() {
  try {
    hello.value = await api<Hello>('hello');
  } catch (e) {
    const err = e as { kod?: string; message: string };
    if (err.kod === 'unauthorized') { ulozToken(''); hello.value = null; }
    ukaz(err.message, true);
  }
}

export function App() {
  useEffect(() => { if (token.value) void nactiHello(); }, [token.value]);
  const [p0] = trasa.value.cesta;
  const h = hlaska.value;
  const hlaskaEl = h && <div class={`hlaska ${h.chyba ? 'chyba' : ''}`} role="status">{h.text}</div>;

  // obrazovky dostupné bez přihlášení
  if (p0 === 'pozvanka') return <main class="obsah"><Pozvanka />{hlaskaEl}</main>;
  if (p0 === 'skautis') return <main class="obsah"><SkautisNavrat />{hlaskaEl}</main>;
  if (!token.value) return <main class="obsah"><Vitej />{hlaskaEl}</main>;
  if (!hello.value) return <main class="obsah"><p class="tlumene">Načítám…</p>{hlaskaEl}</main>;

  const Obrazovka = OBRAZOVKY[p0 ?? ''] ?? Domu;
  return (
    <div class="aplikace">
      <header class="lista">
        <b>{hello.value.aplikace.nazev}</b>
        <span class="maly">{hello.value.ja.prezdivka}{!online.value ? ' · offline' : ''}</span>
      </header>
      <main class="obsah"><Obrazovka /></main>
      <nav class="menu">
        {NAV.filter((n) => !n.jenSpravce || jeSpravce.value).map((n) => (
          <a href={`#/${n.cesta}`} class={(p0 ?? '') === n.cesta ? 'aktivni' : ''}><span aria-hidden="true">{n.ikona}</span>{n.nazev}</a>
        ))}
      </nav>
      {hlaskaEl}
    </div>
  );
}
