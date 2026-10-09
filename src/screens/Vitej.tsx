// Úvod (bez přihlášení), přijetí pozvánky a návrat z přihlášení přes skautIS.

import { useEffect, useState } from 'preact/hooks';
import { APLIKACE } from '../../shared/schema';
import { api, tokenZOdkazu } from '../lib/api';
import { jdi, token, trasa, ukaz, ulozToken } from '../lib/stav';
import { Icon, Logo } from '../components/ui';
import { NaPlochu } from '../components/NaPlochu';

const PROPOJIT = 'app-skautis-propojit';

export function Vitej() {
  const [text, setText] = useState('');
  const [skautis, setSkautis] = useState('');
  useEffect(() => { api<{ skautis: string }>('info').then((i) => setSkautis(i.skautis)).catch(() => {}); }, []);
  const pripojit = () => {
    const t = tokenZOdkazu(text);
    if (!t) return ukaz('Tohle nevypadá jako pozvánka. Zkopíruj celý odkaz, který ti přišel.', true);
    ulozToken(t);
    jdi('', true);
  };
  return (
    <div>
      <div class="hero">
        <Logo />
        <h1>{APLIKACE.nazev}</h1>
        <p>{APLIKACE.popis}</p>
      </div>
      <div class="stack">
        <div class="card stack">
          <h2>Mám pozvánku</h2>
          <p class="small muted" style={{ margin: 0 }}>Pozvánku ti pošle správce jako odkaz. Stačí ji otevřít. Pokud ji máš zkopírovanou, vlož ji sem:</p>
          <input class="input" value={text} placeholder="Vlož odkaz s pozvánkou" onInput={(e) => setText(e.currentTarget.value)} />
          <button class="btn block" disabled={!text} onClick={pripojit}>Připojit se</button>
        </div>
        {skautis && (
          <div class="card stack">
            <h2>Mám propojený účet skautIS</h2>
            <a class="btn block secondary" href={skautis}><Icon name="link" size={18} /> Přihlásit přes skautIS</a>
          </div>
        )}
        <NaPlochu />
      </div>
      <footer class="paticka small muted">{APLIKACE.nazev} · verze {__APP_VERSION__}</footer>
    </div>
  );
}

/** #/pozvanka?t=… – uloží klíč z pozvánky a ověří ho. */
export function Pozvanka() {
  useEffect(() => {
    const t = trasa.value.param.get('t');
    if (t) ulozToken(t);
    jdi('', true);
  }, []);
  return <p class="muted center">Otevírám pozvánku…</p>;
}

/** Spustí přihlášení přes skautIS. propojit = přihlášený uživatel si účet propojuje (ne přihlašuje). */
export function skautisStart(loginUrl: string, propojit: boolean) {
  try { propojit ? sessionStorage.setItem(PROPOJIT, '1') : sessionStorage.removeItem(PROPOJIT); } catch { /* nic */ }
  location.href = loginUrl;
}

/** #/skautis?kod=… – návrat ze skautISu (api/skautis.php). */
export function SkautisNavrat() {
  const [chyba, setChyba] = useState(trasa.value.param.get('chyba') ?? '');
  useEffect(() => {
    const kod = trasa.value.param.get('kod');
    if (!kod) return;
    let propojit = false;
    try { propojit = sessionStorage.getItem(PROPOJIT) === '1' && !!token.value; sessionStorage.removeItem(PROPOJIT); } catch { /* nic */ }
    (propojit
      ? api('skautis.propojit', { kod }).then(() => { ukaz('Účet skautIS je propojený.'); jdi('profil', true); })
      : api<{ token: string }>('skautis.prihlasit', { kod }).then((r) => { ulozToken(r.token); jdi('', true); })
    ).catch((e) => setChyba((e as Error).message));
  }, []);
  if (!chyba) return <p class="muted center">Dokončuji přihlášení přes skautIS…</p>;
  return (
    <div class="stack">
      <div class="center"><Logo size={56} /></div>
      <div class="card stack">
        <h2>Přihlášení přes skautIS se nepovedlo</h2>
        <p style={{ margin: 0 }}>{chyba}</p>
        <button class="btn block" onClick={() => jdi('', true)}>Pokračovat</button>
      </div>
    </div>
  );
}
