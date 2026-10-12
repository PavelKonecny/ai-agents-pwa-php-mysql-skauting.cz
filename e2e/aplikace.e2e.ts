// UKÁZKOVÉ testy šablony: úvod, pozvánka, seznam položek, správa přístupů, profil a vzhled.
// U nové funkce přidej test hlavního scénáře tak, jak ho dělá uživatel (klepnutí, psaní), ne přes API.
import { expect, test } from '@playwright/test';
import { bezVodorovnehoPosunu, pozvat, potvrzovat, prihlasit } from './pomocne';

test('úvod bez přihlášení: nabídne pozvánku a odmítne nesmysl', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Mám pozvánku' })).toBeVisible();
  await bezVodorovnehoPosunu(page);
  await page.getByPlaceholder('Vlož odkaz s pozvánkou').fill('ahoj');
  await page.getByRole('button', { name: 'Připojit se' }).click();
  await expect(page.getByRole('status')).toContainText('nevypadá jako pozvánka');
});

test('položky: přidat, odškrtnout, smazat – a vydrží znovunačtení', async ({ page }) => {
  potvrzovat(page);
  await prihlasit(page);
  const pole = page.getByPlaceholder('Nová položka');
  await pole.fill('Koupit provázek');
  await pole.press('Enter');
  const radek = page.locator('.item', { hasText: 'Koupit provázek' });
  await expect(radek).toBeVisible();

  await radek.getByRole('checkbox', { name: 'Hotovo' }).check();
  await expect(radek).toHaveClass(/done/);
  await page.reload();
  await expect(radek).toHaveClass(/done/);

  await radek.getByRole('button', { name: 'Smazat' }).click();
  await expect(radek).toHaveCount(0);
  await bezVodorovnehoPosunu(page);
});

test('správa: správce pozve člena, člen se připojí a správu nevidí', async ({ page, browser }) => {
  await prihlasit(page);
  await page.getByRole('link', { name: 'Správa' }).click();
  await page.getByPlaceholder('Přezdívka').fill('Veverka');
  await page.getByRole('button', { name: 'Vytvořit pozvánku' }).click();
  const panel = page.getByRole('dialog');
  await expect(panel).toContainText('Pozvánka je hotová');
  const odkaz = (await panel.locator('.linkbox').textContent())!;
  await panel.getByRole('button', { name: 'Zavřít' }).click();
  await expect(page.locator('.item', { hasText: 'Veverka' })).toContainText('zatím neotevřeno');
  await bezVodorovnehoPosunu(page);

  // člen v novém kontextu prohlížeče = jiný telefon (vlastní úložiště)
  const telefon = await browser.newContext({ ...test.info().project.use });
  const clen = await telefon.newPage();
  await clen.goto(odkaz);
  await expect(clen.locator('.topbar')).toContainText('Veverka');
  await expect(clen.getByRole('link', { name: 'Správa' })).toHaveCount(0);
  await telefon.close();

  await page.reload();
  await expect(page.locator('.item', { hasText: 'Veverka' })).toContainText('naposledy');
});

test('zrušený přístup přestane fungovat', async ({ page, browser }) => {
  potvrzovat(page);
  await page.goto('/');
  const token = await pozvat(page, 'Zrušená');
  await prihlasit(page);
  await page.getByRole('link', { name: 'Správa' }).click();
  await page.locator('.item', { hasText: 'Zrušená' }).getByRole('button', { name: 'Zrušit přístup' }).click();
  await expect(page.locator('.item', { hasText: 'Zrušená' })).toContainText('zrušeno');

  const telefon = await browser.newContext({ ...test.info().project.use });
  const clen = await telefon.newPage();
  await clen.goto(`/#/pozvanka?t=${token}`);
  await expect(clen.getByRole('heading', { name: 'Mám pozvánku' })).toBeVisible();
  await telefon.close();
});

test('profil: přezdívka a tmavý režim se uloží', async ({ page }) => {
  await prihlasit(page);
  await page.getByRole('link', { name: 'Profil' }).click();
  await page.getByLabel('Přezdívka').fill('Hlavní správce');
  await page.getByRole('button', { name: 'Uložit přezdívku' }).click();
  await expect(page.locator('.topbar')).toContainText('Hlavní správce');

  await page.getByRole('radio', { name: 'Tmavý' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByText(/verze \d+\.\d+\.\d+/)).toBeVisible();
  await bezVodorovnehoPosunu(page);
});
