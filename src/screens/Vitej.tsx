// Úvod (bez přihlášení), přijetí pozvánky a návrat z přihlášení přes skautIS.

import { useEffect, useState } from 'preact/hooks';
import { api, tokenZOdkazu } from '../lib/api';
import { jdi, token, trasa, ukaz, ulozToken } from '../lib/stav';

const PROPOJIT = 'app-skautis-propojit';

export function Vitej() {
  const [text, setText] = useState('');
  const [info, setInfo] = useState<{ aplikace: { nazev: string; popis: string }; skautis: string } | null>(null);
  useEffect(() => { api<typeof info>('info').then(setInfo).catch(() => {}); }, []);
  const pripojit = () => {
    const t = tokenZOdkazu(text);
    if (!t) return ukaz('Tohle nevypadá jako pozvánka.', true);
    ulozToken(t);
    jdi('', true);
  };
  return (
    <div class="stack">
      <h1>{info?.aplikace.nazev ?? 'Vítej'}</h1>
      {info?.aplikace.popis && <p class="tlumene">{info.aplikace.popis}</p>}
      <div class="karta stack">
        <h2>Mám pozvánku</h2>
        <p class="maly tlumene">Pozvánku ti pošle správce jako odkaz. Stačí ji otevřít, nebo ji vlož sem:</p>
        <input class="pole" value={text} placeholder="Vlož odkaz s pozvánkou" onInput={(e) => setText(e.currentTarget.value)} />
        <button class="tlacitko" disabled={!text} onClick={pripojit}>Připojit se</button>
      </div>
      {info?.skautis && (
        <div class="karta stack">
          <h2>Mám propojený účet skautIS</h2>
          <a class="tlacitko druhotne" href={info.skautis}>Přihlásit přes skautIS</a>
        </div>
      )}
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
  return <p class="tlumene">Otevírám pozvánku…</p>;
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
  if (!chyba) return <p class="tlumene">Dokončuji přihlášení přes skautIS…</p>;
  return (
    <div class="karta stack">
      <h2>Přihlášení přes skautIS se nepovedlo</h2>
      <p>{chyba}</p>
      <button class="tlacitko" onClick={() => jdi('', true)}>Pokračovat</button>
    </div>
  );
}
