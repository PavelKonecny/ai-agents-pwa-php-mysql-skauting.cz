// Správa přístupů (jen správce): pozvat, změnit roli, nový odkaz, zrušit.

import { useEffect, useState } from 'preact/hooks';
import { ROLE, ROLE_NAZVY, type Role } from '../../shared/schema';
import { api, odkazPozvanky } from '../lib/api';
import { ja, jeSpravce, ukaz, type Pristup } from '../lib/stav';

function Odkaz({ odkaz, onHotovo }: { odkaz: string; onHotovo: () => void }) {
  const kopirovat = () => navigator.clipboard.writeText(odkaz).then(() => ukaz('Odkaz zkopírován.'), () => ukaz('Zkopíruj odkaz ručně.', true));
  const poslat = () => navigator.share?.({ title: 'Pozvánka', text: 'Tady je tvoje pozvánka:', url: odkaz }).catch(() => {});
  return (
    <div class="karta stack zvyraznena">
      <b>Odkaz je hotový – zobrazí se jen teď. Pošli ho tomu, koho zveš.</b>
      <div class="odkaz">{odkaz}</div>
      <div class="radek">
        <button class="tlacitko druhotne" onClick={kopirovat}>Kopírovat</button>
        {'share' in navigator && <button class="tlacitko" onClick={poslat}>Poslat</button>}
        <button class="tlacitko text" onClick={onHotovo}>Hotovo</button>
      </div>
    </div>
  );
}

export function Sprava() {
  const [list, setList] = useState<Pristup[] | null>(null);
  const [prezdivka, setPrezdivka] = useState('');
  const [role, setRole] = useState<Role>('clen');
  const [odkaz, setOdkaz] = useState('');
  const nacti = () => api<Pristup[]>('pristupy.list').then(setList).catch((e) => ukaz(e.message, true));
  useEffect(() => { void nacti(); }, []);
  if (!jeSpravce.value) return <p class="tlumene">Tato část je jen pro správce.</p>;

  const akce = async (fn: () => Promise<unknown>) => { try { await fn(); await nacti(); } catch (e) { ukaz((e as Error).message, true); } };
  const pozvat = () => akce(async () => {
    const r = await api<{ token: string }>('pristupy.create', { prezdivka, role });
    setOdkaz(odkazPozvanky(r.token)); setPrezdivka('');
  });
  const novyOdkaz = (p: Pristup) => confirm(`Nový odkaz pro ${p.prezdivka}? Starý přestane fungovat.`) && akce(async () => {
    const r = await api<{ token: string }>('pristupy.relink', { id: p.id });
    setOdkaz(odkazPozvanky(r.token));
  });
  const zrusit = (p: Pristup) => confirm(`Zrušit přístup ${p.prezdivka}?`) && akce(() => api('pristupy.revoke', { id: p.id }));
  const zmenRoli = (p: Pristup, r: string) => akce(() => api('pristupy.role', { id: p.id, role: r }));

  return (
    <div class="stack">
      <h1>Správa</h1>
      <div class="karta stack">
        <h2>Pozvat</h2>
        <input class="pole" value={prezdivka} placeholder="Přezdívka" maxLength={40} onInput={(e) => setPrezdivka(e.currentTarget.value)} />
        <select class="pole" value={role} onChange={(e) => setRole(e.currentTarget.value as Role)}>
          {ROLE.map((r) => <option value={r}>{ROLE_NAZVY[r]}</option>)}
        </select>
        <button class="tlacitko" disabled={!prezdivka.trim()} onClick={pozvat}>Vytvořit pozvánku</button>
      </div>
      {odkaz && <Odkaz odkaz={odkaz} onHotovo={() => setOdkaz('')} />}
      <h2>Přístupy</h2>
      {!list ? <p class="tlumene">Načítám…</p> : list.map((p) => (
        <div class="karta stack">
          <div class="radek">
            <b class="roste">{p.prezdivka}</b>
            {p.skautis && <span class="stitek">skautIS</span>}
            {p.zruseno && <span class="stitek">zrušeno</span>}
          </div>
          <span class="maly tlumene">{p.popis}{p.posledniPouziti ? ` · naposledy ${new Date(p.posledniPouziti).toLocaleString('cs-CZ')}` : ' · zatím neotevřeno'}</span>
          {p.id !== ja.value?.id && (
            <div class="radek zalomit">
              <select class="pole maly" value={p.role} onChange={(e) => zmenRoli(p, e.currentTarget.value)} aria-label="Role">
                {ROLE.map((r) => <option value={r}>{ROLE_NAZVY[r]}</option>)}
              </select>
              <button class="tlacitko druhotne" onClick={() => novyOdkaz(p)}>{p.zruseno ? 'Obnovit' : 'Nový odkaz'}</button>
              {!p.zruseno && <button class="tlacitko text chyba" onClick={() => zrusit(p)}>Zrušit</button>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
