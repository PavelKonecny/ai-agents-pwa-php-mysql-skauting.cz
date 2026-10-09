// Základní UI prvky (stejné jako ve Schůzkovači): ikony, znak aplikace, avatar, spodní panel, pole, výběr data…

import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { ikonaVBarve, vzhled } from '../lib/theme';

/** Obrysové ikony 24×24 (styl Lucide). Novou přidej jako cestu `d` – drž jeden styl, žádné emoji v ovládání. */
const ICONS: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  check: 'M20 6 9 17l-5-5',
  checklist: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
  bulb: 'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  flag: 'M4 22V4M4 4h13l-2 4 2 4H4',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  left: 'M15 18l-6-6 6-6',
  right: 'M9 18l6-6-6-6',
  up: 'M18 15l-6-6-6 6',
  down: 'M6 9l6 6 6-6',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  message: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  wifiOff: 'M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.2-2.8M19 12.9a10 10 0 0 0-2.3-1.6M1.4 9a16 16 0 0 1 4.7-2.9M22.6 9A16 16 0 0 0 10.7 5M12 20h.01',
  share: 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  external: 'M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
  refresh: 'M21 12a9 9 0 1 1-2.6-6.4L21 8M21 3v5h-5',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  close: 'M18 6 6 18M6 6l12 12',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
  image: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15.5 9.5h.01',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
  star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
};

export function Icon({ name, size = 22 }: { name: keyof typeof ICONS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d={ICONS[name] ?? ''} />
    </svg>
  );
}

/** Znak aplikace – stejná ikona jako na ploše a v záložce prohlížeče, v barvě lišty z nastavení vzhledu. */
export function Logo({ size = 72 }: { size?: number }) {
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ikonaVBarve(vzhled.value.lista))}`;
  return <img class="logo" src={src} width={size} height={size} alt="" aria-hidden="true" />;
}

/** Fotka / logo, nebo iniciály ze jména. round = kolečko (lidé), jinak zaoblený čtverec (znaky, loga). */
export function Avatar({ src, name, size = 40, round }: { src?: string; name?: string; size?: number; round?: boolean }) {
  const style = { width: size, height: size, borderRadius: round ? '50%' : size / 4, flex: 'none' };
  if (src) return <img src={src} alt="" style={{ ...style, objectFit: round ? 'cover' : 'contain', background: '#fff' }} />;
  const initials = (name ?? '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span aria-hidden="true" style={{ ...style, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--c-primary-soft)', color: 'var(--c-primary-strong)', fontWeight: 700, fontSize: size * 0.4 }}>
      {initials}
    </span>
  );
}

type TextProps = {
  value: string | undefined;
  onSave: (v: string) => void;
  multiline?: boolean;
  disabled?: boolean;
  placeholder?: string;
  type?: string;
  label?: string;
  class?: string;
  inputMode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url';
};

/** Textové pole, které ukládá při opuštění (ne při každém stisku). */
export function EditText({ value, onSave, multiline, disabled, placeholder, type = 'text', label, inputMode, class: cls }: TextProps) {
  const [v, setV] = useState(value ?? '');
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setV(value ?? '');
  }, [value]);
  // Ukládá skutečnou hodnotu pole – stav komponenty může být při rychlém psaní a odchodu z pole o krok pozadu.
  const commit = (e: Event) => {
    focused.current = false;
    const current = (e.currentTarget as HTMLInputElement | null)?.value ?? v;
    if (current !== v) setV(current);
    if (current !== (value ?? '')) onSave(current);
  };
  const common = {
    class: `input ${cls ?? ''}`,
    value: v,
    disabled,
    placeholder,
    onFocus: () => { focused.current = true; },
    onBlur: commit,
    onInput: (e: Event) => setV((e.currentTarget as HTMLInputElement).value),
  };
  const input = multiline
    ? <textarea {...common} rows={2} />
    : <input {...common} type={type as 'text'} inputMode={inputMode} onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }} />;
  return label ? <label class="field">{label}{input}</label> : input;
}

export function Select({ value, options, onSave, disabled, label }: {
  value: string | undefined; options: (string | { value: string; label: string })[]; onSave: (v: string) => void; disabled?: boolean; label?: string;
}) {
  const sel = (
    <select class="input" value={value ?? ''} disabled={disabled} onChange={(e) => onSave(e.currentTarget.value)}>
      {options.map((o) => (typeof o === 'string' ? <option value={o}>{o || '—'}</option> : <option value={o.value}>{o.label}</option>))}
    </select>
  );
  return label ? <label class="field">{label}{sel}</label> : sel;
}

const MESICE = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
const DNY_TYDNE = ['po', 'út', 'st', 'čt', 'pá', 'so', 'ne'];
const DNY_ZKR = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'];
const isoDne = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const zIso = (iso: string | undefined) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

/** „pá 23. 10. 2026“ */
export const datumCesky = (iso: string | undefined) => {
  const d = zIso(iso);
  return d ? `${DNY_ZKR[d.getDay()]} ${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}` : '';
};

/**
 * Výběr data česky – týden od pondělí, formát „pá 23. 10. 2026“. Nativní <input type="date"> se řídí jazykem
 * prohlížeče (v anglickém prostředí neděle na začátku týdne a MM/DD/YYYY) – proto vlastní kalendář.
 * Hodnota je RRRR-MM-DD; `min` = nejdřívější povolené datum.
 */
export function DateInput({ label, value, onSave, disabled, min }: {
  label?: string; value: string | undefined; onSave: (v: string) => void; disabled?: boolean; min?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mesic, setMesic] = useState(() => zIso(value) ?? new Date());
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) setMesic(zIso(value) ?? zIso(min) ?? new Date()); }, [open]);
  // zavřít klepnutím mimo kalendář nebo Escape
  useEffect(() => {
    if (!open) return;
    const mimo = (e: Event) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', mimo);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', mimo); document.removeEventListener('keydown', esc); };
  }, [open]);
  const y = mesic.getFullYear();
  const m = mesic.getMonth();
  const posun = (new Date(y, m, 1).getDay() + 6) % 7; // pondělí = 0
  const pocet = new Date(y, m + 1, 0).getDate();
  const bunky: (string | null)[] = [...Array(posun).fill(null), ...Array.from({ length: pocet }, (_, i) => isoDne(new Date(y, m, i + 1)))];
  const dnes = isoDne(new Date());
  const vybrat = (iso: string) => { setOpen(false); if (iso !== value) onSave(iso); };
  const control = (
    <div class="datum" ref={box}>
      <button type="button" class="input datum-pole" disabled={disabled} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="calendar" size={18} /> <span class="grow">{datumCesky(value) || 'vyber datum'}</span>
      </button>
      {open && (
        <div class="kalendar" role="dialog" aria-label="Výběr data">
          <div class="row">
            <button type="button" class="iconbtn" aria-label="Předchozí měsíc" onClick={() => setMesic(new Date(y, m - 1, 1))}><Icon name="left" size={18} /></button>
            <b class="grow center">{MESICE[m]} {y}</b>
            <button type="button" class="iconbtn" aria-label="Další měsíc" onClick={() => setMesic(new Date(y, m + 1, 1))}><Icon name="right" size={18} /></button>
          </div>
          <div class="kalendar-mrizka">
            {DNY_TYDNE.map((d) => <span class="kalendar-den small muted">{d}</span>)}
            {bunky.map((iso) => (iso ? (
              <button type="button" class={`kalendar-bunka${iso === value ? ' vybrano' : ''}${iso === dnes ? ' dnes' : ''}`}
                disabled={!!min && iso < min} aria-pressed={iso === value} aria-label={datumCesky(iso)} onClick={() => vybrat(iso)}>
                {Number(iso.slice(8))}
              </button>
            ) : <span />))}
          </div>
        </div>
      )}
    </div>
  );
  return label ? <div class="field">{label}{control}</div> : control;
}

/** Spodní panel (dialog) – pro formuláře a volby, které by na stránce překážely. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ComponentChildren }) {
  const ref = useRef<HTMLDialogElement>(null);
  const openedAt = useRef(0);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { d.showModal(); openedAt.current = Date.now(); }
    if (!open && d.open) d.close();
  }, [open]);
  // Klepnutí na ztmavené pozadí zavře panel – ale ne dozvuk klepnutí, které ho otevřelo.
  const onBackdrop = (e: MouseEvent) => {
    if (e.target === ref.current && Date.now() - openedAt.current > 400) onClose();
  };
  return (
    <dialog ref={ref} class="sheet" onClose={onClose} onClick={onBackdrop}>
      {open && (
        <>
          <div class="sheet-head">
            <h2>{title}</h2>
            <button class="iconbtn" onClick={onClose} aria-label="Zavřít"><Icon name="close" /></button>
          </div>
          <div class="sheet-body">{children}</div>
        </>
      )}
    </dialog>
  );
}

/** Výrazné tlačítko zpět (odkaz na nadřazenou obrazovku, ne na historii prohlížeče). */
export function BackButton({ href, label }: { href: string; label: string }) {
  return <a class="backbtn" href={href}><Icon name="left" size={20} /> {label}</a>;
}

export function Empty({ icon, children }: { icon: string; children: ComponentChildren }) {
  return (
    <div class="empty">
      <Icon name={icon} size={40} />
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  );
}

export function Tip({ children }: { children: ComponentChildren }) {
  return <div class="tip"><strong>Tip: </strong>{children}</div>;
}
