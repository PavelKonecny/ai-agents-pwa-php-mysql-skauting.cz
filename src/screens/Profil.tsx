// Profil (avatar vpravo v horní liště): přezdívka, propojení se skautISem, vzhled aplikace,
// verze aplikace, odhlášení z tohoto zařízení.

import { useState } from 'preact/hooks';
import { ROLE_NAZVY } from '../../shared/schema';
import { api } from '../lib/api';
import { hello, ja, ukaz, ulozToken, type Hello } from '../lib/stav';
import { BARVY_LISTY, PISMO_MAX, PISMO_MIN, REZIMY, setVzhled, TAPETY, vzhled } from '../lib/theme';
import { Avatar, BackButton, Icon } from '../components/ui';
import { skautisStart } from './Vitej';

function Vzhled() {
  const v = vzhled.value;
  return (
    <div class="stack">
      <div class="field">Režim
        <div class="segmented" role="radiogroup" aria-label="Režim" style={{ marginBottom: 0 }}>
          {REZIMY.map((r) => <button role="radio" aria-selected={v.rezim === r.id} aria-checked={v.rezim === r.id} onClick={() => setVzhled({ rezim: r.id })}>{r.label}</button>)}
        </div>
      </div>
      <div class="field">
        <div class="row">
          <span class="grow">Velikost písma</span>
          <b>{v.pismo || 100} %</b>
          {(v.pismo || 100) !== 100 && <button class="btn ghost small" onClick={() => setVzhled({ pismo: 100 })}>Výchozí</button>}
        </div>
        <div class="row" style={{ gap: 10 }}>
          <span aria-hidden="true" style={{ fontSize: '0.8rem' }}>A</span>
          <input type="range" class="pismo-posuvnik grow" min={PISMO_MIN} max={PISMO_MAX} step={5} value={v.pismo || 100} aria-label="Velikost písma v procentech"
            onInput={(e) => setVzhled({ pismo: Number(e.currentTarget.value) })} />
          <span aria-hidden="true" style={{ fontSize: '1.3rem', fontWeight: 700 }}>A</span>
        </div>
      </div>
      <div class="field">Tapeta na pozadí
        <div class="wp-tiles" role="radiogroup" aria-label="Tapeta">
          {TAPETY.map((t) => (
            <button role="radio" aria-checked={v.tapeta === t.id} class={`wp-tile ${t.id ? `wp-${t.id}` : ''}`} onClick={() => setVzhled({ tapeta: t.id })}><span>{t.label}</span></button>
          ))}
        </div>
      </div>
      <div class="field">Barva horní a dolní lišty
        <div class="swatches" role="radiogroup" aria-label="Barva horní a dolní lišty">
          {BARVY_LISTY.map((b) => (
            <button role="radio" class="swatch" aria-checked={v.lista === b.id} aria-label={b.label} title={b.label} style={{ background: b.id }} onClick={() => setVzhled({ lista: b.id })} />
          ))}
        </div>
      </div>
      <p class="small muted" style={{ margin: 0 }}>Vzhled se ukládá jen v tomto telefonu – ostatním se nemění.</p>
    </div>
  );
}

export function Profil() {
  const [prezdivka, setPrezdivka] = useState(ja.value?.prezdivka ?? '');
  const h = hello.value!;
  const ulozit = async () => {
    try { hello.value = await api<Hello>('profil.prezdivka', { prezdivka }); ukaz('Uloženo.'); } catch (e) { ukaz((e as Error).message, true); }
  };
  const odhlasit = () => {
    if (!confirm('Odhlásit tento telefon? Pro návrat budeš potřebovat pozvánku (nebo skautIS, pokud ho máš propojený).')) return;
    ulozToken(''); hello.value = null;
  };
  return (
    <div class="stack">
      <div><BackButton href="#/" label="Zpět" /></div>
      <div class="row" style={{ gap: 12 }}>
        <Avatar name={ja.value?.prezdivka} size={56} round />
        <div class="grow">
          <h1>{ja.value?.prezdivka}</h1>
          <span class="chip info">{ja.value ? ROLE_NAZVY[ja.value.role] : ''}</span>
        </div>
      </div>
      <div class="card stack">
        <label class="field">Přezdívka
          <input class="input" value={prezdivka} maxLength={40} onInput={(e) => setPrezdivka(e.currentTarget.value)} />
        </label>
        <button class="btn" disabled={!prezdivka.trim() || prezdivka === ja.value?.prezdivka} onClick={ulozit}>Uložit přezdívku</button>
      </div>
      {h.skautis && (
        <div class="card stack">
          <h3>skautIS</h3>
          {ja.value?.skautis
            ? <p class="small" style={{ margin: 0 }}><span class="chip ok"><Icon name="check" size={14} /> propojeno</span> Na jiném zařízení se můžeš přihlásit přes skautIS.</p>
            : <>
                <p class="small muted" style={{ margin: 0 }}>Propoj si účet skautIS a na dalších zařízeních se přihlásíš bez pozvánky.</p>
                <button class="btn secondary" onClick={() => skautisStart(h.skautis, true)}><Icon name="link" size={18} /> Propojit se skautIS</button>
              </>}
        </div>
      )}
      <div class="card"><h3 style={{ marginBottom: 10 }}>Vzhled aplikace</h3><Vzhled /></div>
      <button class="btn danger" onClick={odhlasit}><Icon name="logout" size={18} /> Odhlásit tento telefon</button>
      <p class="small muted center">
        {h.aplikace.nazev} · verze {__APP_VERSION__}<br />
        připraveno {new Date(__BUILD_DATE__).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  );
}
