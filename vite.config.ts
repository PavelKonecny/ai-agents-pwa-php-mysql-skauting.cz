import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';
import pkg from './package.json' with { type: 'json' };
import { APLIKACE } from './shared/schema.ts';

/**
 * Verze = major.minor z package.json + počet commitů → mění se s každým commitem sama.
 * Sestavení s neuloženými změnami dostane číslo, které bude mít jejich commit (počet + 1).
 */
function verze(): string {
  const [major, minor] = pkg.version.split('.');
  const git = (cmd: string) => execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  try {
    const pocet = Number(git('git rev-list --count HEAD'));
    const zmeny = git('git status --porcelain --untracked-files=no') !== '';
    return pocet ? `${major}.${minor}.${pocet + (zmeny ? 1 : 0)}` : pkg.version;
  } catch {
    return pkg.version;
  }
}

export default defineConfig({
  base: './', // aplikace funguje v kořeni subdomény i v podsložce
  define: { __APP_VERSION__: JSON.stringify(verze()), __BUILD_DATE__: JSON.stringify(new Date().toISOString()) },
  server: {
    port: 5190,
    // lokální PHP API (npm run api) – stejná cesta jako na hostingu
    proxy: { '/api': { target: 'http://127.0.0.1:8095', rewrite: (p) => p.replace(/^\/api/, '') } },
  },
  preview: { port: 4190 },
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: APLIKACE.nazev,
        short_name: APLIKACE.kratce,
        description: APLIKACE.popis,
        lang: 'cs',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f4f7f9',
        theme_color: '#527760',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        // PHP API na stejné doméně (api/install.php apod.) nesmí service worker nahradit aplikací
        navigateFallbackDenylist: [/\/api\//],
      },
    }),
  ],
});
