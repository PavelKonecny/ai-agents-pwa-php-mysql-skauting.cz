// Volání PHP API (api/index.php na stejné adrese jako aplikace). Každý požadavek nese token přístupu.

import { token } from './stav';

export class ApiChyba extends Error {
  constructor(public kod: string, zprava: string) { super(zprava); }
}

export async function api<T>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  if (!navigator.onLine) throw new ApiChyba('offline', 'Nejsi připojený k internetu.');
  let res: Response;
  try {
    // text/plain = „jednoduchý“ požadavek bez CORS preflightu
    res = await fetch('./api/', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ ...data, action, token: token.value }) });
  } catch {
    throw new ApiChyba('offline', 'Server je nedostupný. Zkus to za chvíli.');
  }
  let json: { ok: boolean; data?: T; error?: { code: string; message: string } };
  try {
    json = await res.json();
  } catch {
    throw new ApiChyba('internal', `Server odpověděl chybou (${res.status}).`);
  }
  if (!json.ok) throw new ApiChyba(json.error?.code ?? 'internal', json.error?.message ?? 'Neznámá chyba.');
  return json.data as T;
}

/** Odkaz s pozvánkou (token v části za #, neodesílá se na server v adrese). */
export function odkazPozvanky(t: string): string {
  return `${location.origin}${location.pathname}#/pozvanka?t=${t}`;
}

/** Najde pozvánku v libovolném textu (vložený odkaz). */
export function tokenZOdkazu(text: string): string | null {
  return text.match(/[#&?]t=([0-9a-f]{32,})/i)?.[1] ?? null;
}
