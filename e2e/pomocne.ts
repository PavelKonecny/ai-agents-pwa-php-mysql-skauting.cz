// Pomocné funkce pro testy v prohlížeči.
import { expect, type Page } from '@playwright/test';

export const adminToken = () => {
  const t = process.env.E2E_ADMIN;
  if (!t) throw new Error('Chybí pozvánka správce – spouštěj přes npm run e2e (globalSetup).');
  return t;
};

/** Volání API přímo – rychlá příprava dat bez klikání. Samotnou funkci testuj klikáním jako uživatel. */
export async function api<T>(page: Page, action: string, data: Record<string, unknown> = {}, token = adminToken()): Promise<T> {
  const res = await page.request.post('/api/', { headers: { 'Content-Type': 'text/plain' }, data: JSON.stringify({ ...data, action, token }) });
  const j = await res.json();
  if (!j.ok) throw new Error(`${action}: ${j.error?.message}`);
  return j.data as T;
}

/** Nový přístup přes API, vrátí klíč (token) pro pozvánku. */
export async function pozvat(page: Page, prezdivka: string, role: 'admin' | 'clen' = 'clen'): Promise<string> {
  return (await api<{ token: string }>(page, 'pristupy.create', { prezdivka, role })).token;
}

/** Otevře pozvánku jako uživatel a počká na hlavní obrazovku. */
export async function prihlasit(page: Page, token = adminToken()) {
  await page.goto(`/#/pozvanka?t=${token}`);
  await expect(page.locator('.topbar')).toBeVisible();
}

/** Stránka se nesmí na mobilu posouvat do strany. */
export async function bezVodorovnehoPosunu(page: Page) {
  const { sirka, obsah } = await page.evaluate(() => ({ sirka: innerWidth, obsah: document.documentElement.scrollWidth }));
  expect(obsah, 'stránka je širší než displej').toBeLessThanOrEqual(sirka);
}

/** Potvrzovací okna (confirm) automaticky odsouhlasit. */
export function potvrzovat(page: Page) {
  page.on('dialog', (d) => void d.accept());
}
