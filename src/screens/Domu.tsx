// UKÁZKA hlavní obrazovky: seznam položek (načtení, přidání, odškrtnutí, smazání).
// Nahraď vlastní obrazovkou aplikace. Vzor: data z API → stav komponenty → po změně znovu načíst.

import { useEffect, useState } from 'preact/hooks';
import type { Radek } from '../../shared/schema';
import { api } from '../lib/api';
import { jeSpravce, OBNOVIT, ukaz } from '../lib/stav';
import { Empty, Icon } from '../components/ui';
import { NaPlochu } from '../components/NaPlochu';

export function Domu() {
  const [polozky, setPolozky] = useState<Radek[] | null>(null);
  const [nazev, setNazev] = useState('');
  const nacti = () => api<Radek[]>('polozky.list').then(setPolozky).catch((e) => ukaz(e.message, true));
  useEffect(() => {
    void nacti();
    const obnovit = () => void nacti();
    addEventListener(OBNOVIT, obnovit);
    return () => removeEventListener(OBNOVIT, obnovit);
  }, []);

  const pridat = async () => {
    if (!nazev.trim()) return;
    try { await api('polozky.uloz', { nazev }); setNazev(''); await nacti(); } catch (e) { ukaz((e as Error).message, true); }
  };
  const prepnout = async (p: Radek) => {
    try { await api('polozky.uloz', { id: p.id, nazev: p.nazev, poznamka: p.poznamka, hotovo: p.hotovo === '1' ? '' : '1' }); await nacti(); } catch (e) { ukaz((e as Error).message, true); }
  };
  const smazat = async (p: Radek) => {
    if (!confirm(`Smazat „${p.nazev}“? Smazání nejde vrátit.`)) return;
    try { await api('polozky.smaz', { id: p.id }); await nacti(); } catch (e) { ukaz((e as Error).message, true); }
  };
  const hotovo = polozky?.filter((p) => p.hotovo === '1').length ?? 0;

  return (
    <div class="stack">
      <div class="row">
        <h1 class="grow">Položky</h1>
        {!!polozky?.length && <span class="chip ok"><Icon name="check" size={14} /> {hotovo} / {polozky.length}</span>}
      </div>
      <div class="row">
        <input class="input" value={nazev} placeholder="Nová položka" maxLength={200} onInput={(e) => setNazev(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === 'Enter') void pridat(); }} />
        <button class="btn" disabled={!nazev.trim()} onClick={pridat} aria-label="Přidat"><Icon name="plus" size={20} /></button>
      </div>
      {!polozky ? <p class="muted">Načítám…</p> : polozky.length === 0 ? <Empty icon="checklist">Zatím nic. Přidej první položku.</Empty> : (
        <div class="list">
          {polozky.map((p) => (
            <div class={`item ${p.hotovo === '1' ? 'done' : ''}`}>
              <input type="checkbox" class="check" checked={p.hotovo === '1'} onChange={() => prepnout(p)} aria-label="Hotovo" />
              <div class="item-text">
                <b>{p.nazev}</b>
                <div class="small muted">{p.updatedBy}</div>
              </div>
              {jeSpravce.value && <button class="iconbtn" onClick={() => smazat(p)} aria-label="Smazat" title="Smazat"><Icon name="trash" size={20} /></button>}
            </div>
          ))}
        </div>
      )}
      <NaPlochu pripojeno />
    </div>
  );
}
