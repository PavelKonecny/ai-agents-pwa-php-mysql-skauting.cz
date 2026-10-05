// UKÁZKA hlavní obrazovky: seznam položek (načtení, přidání, odškrtnutí, smazání).
// Nahraď vlastní obrazovkou aplikace. Vzor: data z API → stav komponenty → po změně znovu načíst.

import { useEffect, useState } from 'preact/hooks';
import type { Radek } from '../../shared/schema';
import { api } from '../lib/api';
import { jeSpravce, ukaz } from '../lib/stav';

export function Domu() {
  const [polozky, setPolozky] = useState<Radek[] | null>(null);
  const [nazev, setNazev] = useState('');
  const nacti = () => api<Radek[]>('polozky.list').then(setPolozky).catch((e) => ukaz(e.message, true));
  useEffect(() => { void nacti(); }, []);

  const pridat = async () => {
    if (!nazev.trim()) return;
    try { await api('polozky.uloz', { nazev }); setNazev(''); await nacti(); } catch (e) { ukaz((e as Error).message, true); }
  };
  const prepnout = async (p: Radek) => {
    try { await api('polozky.uloz', { id: p.id, nazev: p.nazev, poznamka: p.poznamka, hotovo: p.hotovo === '1' ? '' : '1' }); await nacti(); } catch (e) { ukaz((e as Error).message, true); }
  };
  const smazat = async (p: Radek) => {
    if (!confirm(`Smazat „${p.nazev}“?`)) return;
    try { await api('polozky.smaz', { id: p.id }); await nacti(); } catch (e) { ukaz((e as Error).message, true); }
  };

  return (
    <div class="stack">
      <h1>Položky</h1>
      <div class="radek">
        <input class="pole" value={nazev} placeholder="Nová položka" onInput={(e) => setNazev(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === 'Enter') void pridat(); }} />
        <button class="tlacitko" disabled={!nazev.trim()} onClick={pridat} aria-label="Přidat">+</button>
      </div>
      {!polozky ? <p class="tlumene">Načítám…</p> : polozky.length === 0 ? <p class="tlumene">Zatím nic. Přidej první položku.</p> : (
        <div class="stack">
          {polozky.map((p) => (
            <div class="karta radek">
              <input type="checkbox" checked={p.hotovo === '1'} onChange={() => prepnout(p)} aria-label="Hotovo" />
              <span class="roste" style={{ textDecoration: p.hotovo === '1' ? 'line-through' : 'none' }}>{p.nazev}</span>
              <span class="maly tlumene">{p.updatedBy}</span>
              {jeSpravce.value && <button class="tlacitko text" onClick={() => smazat(p)} aria-label="Smazat">🗑</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
