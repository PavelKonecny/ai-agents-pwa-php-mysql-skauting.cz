import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app';
import { applyVzhled } from './lib/theme';
import { listenForInstall } from './lib/install';
import './styles.css';

applyVzhled();
listenForInstall();
render(<App />, document.getElementById('app')!);

// Service worker: aplikace funguje offline. Novou verzi hledá při každém návratu do aplikace a každých 30 min;
// když ji najde, sám se aktualizuje a stránku znovu načte (registerType: autoUpdate) – na mobilu tak běží vždy poslední verze.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    const zkontrolovat = () => { if (navigator.onLine) void reg.update().catch(() => {}); };
    setInterval(zkontrolovat, 30 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') zkontrolovat(); });
  },
});
