// Návod „Přidej si aplikaci na plochu“ podle telefonu. Na Androidu rovnou nabídne instalaci.

import { useState } from 'preact/hooks';
import { install, installed, installPrompt, iosMimoSafari, platforma, type Platforma } from '../lib/install';
import { ukaz } from '../lib/stav';
import { Icon } from './ui';

const SKRYTO = 'app-naplochu-skryto';

function Kroky({ p }: { p: Platforma }) {
  if (p === 'ios') {
    return (
      <ol class="small" style={{ margin: 0, paddingLeft: 20 }}>
        <li>Otevři aplikaci v <b>Safari</b>.</li>
        <li>Dole klepni na <b>Sdílet</b> <Icon name="share" size={14} /> (čtvereček se šipkou).</li>
        <li>Sjeď níž a vyber <b>Přidat na plochu</b>, pak <b>Přidat</b>.</li>
      </ol>
    );
  }
  return (
    <ol class="small" style={{ margin: 0, paddingLeft: 20 }}>
      <li>V Chromu klepni vpravo nahoře na <b>⋮</b> (tři tečky).</li>
      <li>Vyber <b>Přidat na plochu</b> nebo <b>Nainstalovat aplikaci</b>.</li>
      <li>Potvrď. Ikona aplikace se objeví na ploše.</li>
    </ol>
  );
}

/** pripojeno = uživatel je už přihlášený (karta v aplikaci, dá se skrýt). */
export function NaPlochu({ pripojeno = false }: { pripojeno?: boolean }) {
  const [skryto, setSkryto] = useState(() => { try { return pripojeno && localStorage.getItem(SKRYTO) === '1'; } catch { return false; } });
  const [jiny, setJiny] = useState(false);
  if (installed.value || skryto) return null;
  const p = platforma();
  const zobrazit: Platforma = jiny ? (p === 'ios' ? 'android' : 'ios') : p === 'jine' ? 'android' : p;

  const skryt = () => {
    try { localStorage.setItem(SKRYTO, '1'); } catch { /* nic */ }
    setSkryto(true);
  };
  const nainstalovat = async () => { if (await install()) ukaz('Aplikace je na ploše.'); };
  const kopirovatAdresu = () => navigator.clipboard.writeText(location.origin + location.pathname).then(() => ukaz('Adresa zkopírována.'), () => {});

  return (
    <div class="card stack">
      <div class="card-title" style={{ marginBottom: 0 }}>
        <Icon name="star" size={18} />
        <h3 class="grow">Přidej si aplikaci na plochu</h3>
        {pripojeno && <button class="iconbtn" aria-label="Skrýt návod" title="Skrýt" onClick={skryt}><Icon name="close" size={18} /></button>}
      </div>
      <p class="small muted" style={{ margin: 0 }}>Pak ji otevřeš jednou ikonou jako běžnou aplikaci, přes celou obrazovku a i bez signálu.</p>
      {/* Safari maže data webů neotevřených 7 dní (i přihlášení) – aplikace z plochy je výjimka */}
      {p === 'ios' && (
        <div class="tip small" role="note">
          <strong>Pozor na iPhone:</strong> Safari samo maže data webům, které člověk 7 dní neotevře. Netýká se to aplikace přidané na plochu. Prosím přidej si ji.
        </div>
      )}
      {p === 'android' && installPrompt.value && !jiny ? (
        <button class="btn block" onClick={nainstalovat}><Icon name="plus" size={18} /> Přidat na plochu</button>
      ) : p === 'ios' && iosMimoSafari() && !jiny ? (
        <div class="stack" style={{ gap: 6 }}>
          <p class="small" style={{ margin: 0 }}>Na iPhonu to jde jen ze <b>Safari</b>. Zkopíruj si adresu, otevři Safari a vlož ji do adresního řádku.</p>
          <button class="btn secondary small" onClick={kopirovatAdresu}><Icon name="copy" size={16} /> Zkopírovat adresu</button>
        </div>
      ) : (
        <Kroky p={zobrazit} />
      )}
      {p !== 'jine' && (
        <button class="btn ghost small" style={{ alignSelf: 'flex-start' }} onClick={() => setJiny(!jiny)}>
          {jiny ? 'Zpět na můj telefon' : p === 'ios' ? 'Mám Android' : 'Mám iPhone'}
        </button>
      )}
      {p === 'jine' && (
        <details class="small">
          <summary class="muted">Na iPhonu</summary>
          <div style={{ marginTop: 6 }}><Kroky p="ios" /></div>
        </details>
      )}
    </div>
  );
}
