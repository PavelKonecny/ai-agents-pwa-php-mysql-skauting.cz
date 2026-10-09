// Přidání aplikace na plochu telefonu: rozpoznání platformy a nabídka instalace (Android/Chrome).

import { signal } from '@preact/signals';

/** Událost beforeinstallprompt (Chrome/Android) – dá se z ní vyvolat systémová nabídka „Nainstalovat“. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const installPrompt = signal<InstallPromptEvent | null>(null);
export const installed = signal(isStandalone());

/** Běží aplikace z ikony na ploše (ne v prohlížeči)? */
export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

export type Platforma = 'ios' | 'android' | 'jine';

export function platforma(): Platforma {
  const ua = navigator.userAgent;
  // iPadOS se hlásí jako Mac – pozná se podle dotykové obrazovky
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'jine';
}

/** Na iPhonu jde na plochu přidat jen ze Safari (ne z Chromu, Firefoxu ani z prohlížeče uvnitř Messengeru apod.). */
export function iosMimoSafari(): boolean {
  const ua = navigator.userAgent;
  return platforma() === 'ios' && /CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram|Line\/|WhatsApp/.test(ua);
}

/** Zaregistrovat co nejdřív po startu – událost přijde jen jednou. */
export function listenForInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt.value = e as InstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => {
    installPrompt.value = null;
    installed.value = true;
  });
}

/** Vyvolá systémovou nabídku instalace. Vrací true, když ji uživatel potvrdil. */
export async function install(): Promise<boolean> {
  const e = installPrompt.value;
  if (!e) return false;
  await e.prompt();
  const { outcome } = await e.userChoice;
  installPrompt.value = null;
  return outcome === 'accepted';
}
