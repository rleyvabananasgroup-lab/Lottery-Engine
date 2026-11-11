// Copies the web app from the top of this project into mobile/www for Capacitor, then makes a few
// phone-app adjustments to the COPY only. The website files themselves are never modified.
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const www = new URL('../www/', import.meta.url);
const LIVE_FEED = 'https://rleyvabananasgroup-lab.github.io/Lottery-Engine/data/feed.json';

await rm(www, { recursive: true, force: true });
await mkdir(www, { recursive: true });
for (const f of ['index.html', 'manifest.webmanifest', 'data', 'icons']) await cp(new URL(f, root), new URL(f, www), { recursive: true });

let html = await readFile(new URL('index.html', www), 'utf8');
const patch = (from, to, why) => {
  const n = html.split(from).length - 1;
  if (n !== 1) throw new Error(`Mobile patch "${why}" expected 1 match, found ${n}. The web app changed; update scripts/build-www.mjs.`);
  html = html.replace(from, to);
};
// 1. No website offline worker inside the app (the app's files are already on the phone).
patch("if ('serviceWorker' in navigator && (", "if (!window.Capacitor && 'serviceWorker' in navigator && (", 'skip service worker');
// 2. The "Install on your phone" panel doesn't apply inside an installed app.
patch('if (isStandalone()) return', 'if (window.Capacitor || isStandalone()) return', 'install panel');
// 3. Read the results file kept current by the scheduled job, instead of the copy frozen into the app.
patch("fetchText('data/feed.json', 8000)", `fetchText(window.Capacitor ? '${LIVE_FEED}' : 'data/feed.json', 8000)`, 'live results file');
await writeFile(new URL('index.html', www), html);
console.log('mobile/www ready');
