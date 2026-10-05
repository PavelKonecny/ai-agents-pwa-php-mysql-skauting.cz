// Profil: přezdívka, propojení se skautISem, verze aplikace, odhlášení z tohoto zařízení.

import { useState } from 'preact/hooks';
import { ROLE_NAZVY } from '../../shared/schema';
import { api } from '../lib/api';
import { hello, ja, ukaz, ulozToken, type Hello } from '../lib/stav';
import { skautisStart } from './Vitej';

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
      <h1>Profil</h1>
      <div class="karta stack">
        <label class="maly">Přezdívka
          <input class="pole" value={prezdivka} maxLength={40} onInput={(e) => setPrezdivka(e.currentTarget.value)} />
        </label>
        <button class="tlacitko" disabled={!prezdivka.trim() || prezdivka === ja.value?.prezdivka} onClick={ulozit}>Uložit</button>
        <span class="maly tlumene">Role: {ja.value ? ROLE_NAZVY[ja.value.role] : ''}</span>
      </div>
      {h.skautis && (
        <div class="karta stack">
          <h2>skautIS</h2>
          {ja.value?.skautis
            ? <p class="maly">Účet je propojený – na jiném zařízení se můžeš přihlásit přes skautIS.</p>
            : <>
                <p class="maly tlumene">Propoj si účet skautIS a na dalších zařízeních se přihlásíš bez pozvánky.</p>
                <button class="tlacitko druhotne" onClick={() => skautisStart(h.skautis, true)}>Propojit se skautIS</button>
              </>}
        </div>
      )}
      <button class="tlacitko text chyba" onClick={odhlasit}>Odhlásit tento telefon</button>
      <p class="maly tlumene stred">
        {h.aplikace.nazev} · verze {__APP_VERSION__}<br />
        připraveno {new Date(__BUILD_DATE__).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  );
}
