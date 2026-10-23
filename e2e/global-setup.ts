// Jednou před všemi testy: instalace aplikace (založí tabulky a správce) – pozvánku správce předá testům.
export default async function globalSetup() {
  const base = `http://127.0.0.1:${process.env.E2E_PORT || 8190}`;
  const html = await (await fetch(`${base}/api/install.php`, { method: 'POST', body: new URLSearchParams({ key: 'e2e-instalace' }) })).text();
  const token = html.match(/pozvanka\?t=([0-9a-f]+)/)?.[1];
  if (!token) throw new Error(`Instalace se nepovedla:\n${html.slice(0, 500)}`);
  process.env.E2E_ADMIN = token; // proměnné nastavené v globalSetup dědí všechny testy
}
