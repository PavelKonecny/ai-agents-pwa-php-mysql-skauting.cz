// Správa přístupů (jen správce): pozvat, změnit roli, nový odkaz, zrušit.

import { useEffect, useState } from 'preact/hooks';
import { ROLE, ROLE_NAZVY, type Role } from '../../shared/schema';
import { api, odkazPozvanky } from '../lib/api';
import { ja, jeSpravce, ukaz, type Pristup } from '../lib/stav';
import { Avatar, Icon, Sheet } from '../components/ui';

function Odkaz({ odkaz, onHotovo }: { odkaz: string; onHotovo: () => void }) {
  const kopirovat = () => navigator.clipboard.writeText(odkaz).then(() => ukaz('Odkaz zkopírován.'), () => ukaz('Zkopíruj odkaz ručně.', true));
  const poslat = () => navigator.share?.({ title: 'Pozvánka', text: 'Tady je tvoje pozvánka:', url: odkaz }).catch(() => {});
  return (
    <Sheet open={!!odkaz} onClose={onHotovo} title="Pozvánka je hotová">
      <div class="stack">
        <p class="small" style={{ margin: 0 }}>Odkaz se zobrazí <b>jen teď</b>. Pošli ho tomu, koho zveš – kdo ho otevře, je přihlášený.</p>
        <div class="linkbox">{odkaz}</div>
        <div class="grid2">
          <button class="btn secondary" onClick={kopirovat}><Icon name="copy" size={18} /> Kopírovat</button>
          {'share' in navigator
            ? <button class="btn" onClick={poslat}><Icon name="share" size={18} /> Poslat</button>
            : <button class="btn" onClick={onHotovo}>Hotovo</button>}
        </div>
      </div>
    </Sheet>
  );
}

export function Sprava() {
  const [list, setList] = useState<Pristup[] | null>(null);
  const [prezdivka, setPrezdivka] = useState('');
  const [role, setRole] = useState<Role>('clen');
  const [odkaz, setOdkaz] = useState('');
  const nacti = () => api<Pristup[]>('pristupy.list').then(setList).catch((e) => ukaz(e.message, true));
  useEffect(() => { void nacti(); }, []);
  if (!jeSpravce.value) return <p class="muted">Tato část je jen pro správce.</p>;

  const akce = async (fn: () => Promise<unknown>) => { try { await fn(); await nacti(); } catch (e) { ukaz((e as Error).message, true); } };
  const pozvat = () => akce(async () => {
    const r = await api<{ token: string }>('pristupy.create', { prezdivka, role });
    setOdkaz(odkazPozvanky(r.token)); setPrezdivka('');
  });
  const novyOdkaz = (p: Pristup) => confirm(`Nový odkaz pro ${p.prezdivka}? Starý přestane fungovat.`) && akce(async () => {
    const r = await api<{ token: string }>('pristupy.relink', { id: p.id });
    setOdkaz(odkazPozvanky(r.token));
  });
  const zrusit = (p: Pristup) => confirm(`Zrušit přístup ${p.prezdivka}? Jeho odkaz přestane fungovat.`) && akce(() => api('pristupy.revoke', { id: p.id }));
  const zmenRoli = (p: Pristup, r: string) => akce(() => api('pristupy.role', { id: p.id, role: r }));

  return (
    <div class="stack">
      <h1>Správa</h1>
      <div class="card stack">
        <h3>Pozvat</h3>
        <div class="grid2">
          <input class="input" value={prezdivka} placeholder="Přezdívka" maxLength={40} onInput={(e) => setPrezdivka(e.currentTarget.value)} />
          <select class="input" value={role} onChange={(e) => setRole(e.currentTarget.value as Role)} aria-label="Role">
            {ROLE.map((r) => <option value={r}>{ROLE_NAZVY[r]}</option>)}
          </select>
        </div>
        <button class="btn" disabled={!prezdivka.trim()} onClick={pozvat}><Icon name="plus" size={18} /> Vytvořit pozvánku</button>
      </div>
      <Odkaz odkaz={odkaz} onHotovo={() => setOdkaz('')} />
      <div class="section">
        <h2><Icon name="users" size={20} /> Přístupy</h2>
        {!list ? <p class="muted">Načítám…</p> : (
          <div class="list">
            {list.map((p) => (
              <div class={`item wrap ${p.zruseno ? 'done' : ''}`}>
                <Avatar name={p.prezdivka} size={36} round />
                <div class="item-text">
                  <div class="row wrap" style={{ gap: 6 }}>
                    <b>{p.prezdivka}</b>
                    {p.skautis && <span class="chip info">skautIS</span>}
                    {p.zruseno && <span class="chip warn">zrušeno</span>}
                  </div>
                  <div class="small muted">{p.popis}{p.posledniPouziti ? ` · naposledy ${new Date(p.posledniPouziti).toLocaleString('cs-CZ')}` : ' · zatím neotevřeno'}</div>
                </div>
                {p.id !== ja.value?.id && (
                  <div class="row item-actions">
                    <select class="input" style={{ width: 'auto', minHeight: 36, padding: '4px 8px' }} value={p.role} onChange={(e) => zmenRoli(p, e.currentTarget.value)} aria-label="Role">
                      {ROLE.map((r) => <option value={r}>{ROLE_NAZVY[r]}</option>)}
                    </select>
                    <button class="btn secondary small" onClick={() => novyOdkaz(p)}><Icon name="link" size={16} /> {p.zruseno ? 'Obnovit' : 'Nový odkaz'}</button>
                    {!p.zruseno && <button class="iconbtn" onClick={() => zrusit(p)} aria-label="Zrušit přístup" title="Zrušit přístup"><Icon name="trash" size={20} /></button>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
