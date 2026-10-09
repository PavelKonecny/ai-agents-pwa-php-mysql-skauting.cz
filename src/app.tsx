// Rám aplikace: horní lišta, upozornění, obsah podle cesty (#/…), spodní navigace, hlášky.
// Nová obrazovka = soubor v src/screens + řádek v OBRAZOVKY (+ položka v NAV, pokud má být v menu).

import { useEffect, useState } from 'preact/hooks';
import type { ComponentType } from 'preact';
import { api } from './lib/api';
import { hello, hlaska, jeSpravce, OBNOVIT, online, token, trasa, ukaz, ulozToken, type Hello } from './lib/stav';
import { Avatar, Icon, Logo } from './components/ui';
import { Vitej, Pozvanka, SkautisNavrat } from './screens/Vitej';
import { Domu } from './screens/Domu';
import { Sprava } from './screens/Sprava';
import { Profil } from './screens/Profil';

const OBRAZOVKY: Record<string, ComponentType> = { '': Domu, sprava: Sprava, profil: Profil };
/**
 * Spodní menu: 2–5 položek s ikonou z components/ui.tsx (Icon). `cesty` = obrazovky, kdy je položka zvýrazněná.
 * Profil v menu není – otevírá se avatarem vpravo v horní liště.
 */
const NAV = [
  { cesta: '', nazev: 'Domů', ikona: 'home', cesty: [''] },
  { cesta: 'sprava', nazev: 'Správa', ikona: 'users', cesty: ['sprava'], jenSpravce: true },
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

function TopBar() {
  const h = hello.value!;
  const [nacitam, setNacitam] = useState(false);
  const obnovit = async () => {
    setNacitam(true);
    await nactiHello();
    setNacitam(false);
    dispatchEvent(new Event(OBNOVIT));
  };
  return (
    <header class="topbar">
      <Logo size={36} />
      <h1>
        {h.aplikace.nazev}
        <span class="sub">{h.ja.prezdivka}{jeSpravce.value ? ' · správce' : ''}</span>
      </h1>
      <span class={`status-dot ${nacitam ? 'busy' : online.value ? '' : 'off'}`} title={online.value ? 'Online' : 'Offline'} />
      <button onClick={obnovit} aria-label="Aktualizovat"><Icon name="refresh" size={20} /></button>
      <a href="#/profil" class="profilbtn" aria-label="Profil" title="Profil – přezdívka, vzhled, odhlášení">
        <Avatar name={h.ja.prezdivka} size={32} round />
      </a>
    </header>
  );
}

function BottomNav() {
  const p = trasa.value.cesta[0] ?? '';
  const polozky = NAV.filter((n) => !n.jenSpravce || jeSpravce.value);
  if (polozky.length < 2) return null; // jediná položka by byla jen na ozdobu
  return (
    <nav class="bottomnav">
      {polozky.map((n) => (
        <a href={`#/${n.cesta}`} class={n.cesty.includes(p) ? 'active' : ''}><Icon name={n.ikona} /> {n.nazev}</a>
      ))}
    </nav>
  );
}

export function App() {
  useEffect(() => { if (token.value) void nactiHello(); }, [token.value]);
  const [p0] = trasa.value.cesta;
  const h = hlaska.value;
  const hlaskaEl = h && <div class={`toast ${h.chyba ? 'error' : ''}`} role="status">{h.text}</div>;

  // obrazovky dostupné bez přihlášení
  if (p0 === 'pozvanka') return <div class="app"><main><Pozvanka /></main>{hlaskaEl}</div>;
  if (p0 === 'skautis') return <div class="app"><main><SkautisNavrat /></main>{hlaskaEl}</div>;
  if (!token.value) return <div class="app"><main><Vitej /></main>{hlaskaEl}</div>;
  if (!hello.value) return <div class="app"><main><p class="muted center">Načítám…</p></main>{hlaskaEl}</div>;

  const Obrazovka = OBRAZOVKY[p0 ?? ''] ?? Domu;
  return (
    <div class="app">
      <TopBar />
      {!online.value && <div class="banner offline"><Icon name="wifiOff" size={18} /> Offline – změny teď nejde uložit.</div>}
      <main><Obrazovka /></main>
      <BottomNav />
      {hlaskaEl}
    </div>
  );
}
