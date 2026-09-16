// Минимальный клиент протокола DevTools без зависимостей: отдельный Chrome со своим профилем и отладочным портом.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function launch({width = 1920, height = 1080, port = 9333, headful = !!process.env.HEADFUL} = {}) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-chrome-'));
  const args = [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${width},${height}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', '--mute-audio',
    '--force-device-scale-factor=1', 'about:blank'];
  if (!headful) args.unshift('--headless=new');
  const chrome = spawn(CHROME, args, {stdio: 'ignore'});

  let target;
  for (let i = 0; i < 50 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'); }
    catch { await sleep(200); }
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, {once: true}));
  let seq = 0;
  const pending = new Map(), listeners = [];
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m); pending.delete(m.id); }
    else listeners.forEach(f => f(m));
  });
  const send = (method, params = {}) => new Promise(r => {
    const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({id, method, params}));
  });
  const evaluate = async expr =>
    (await send('Runtime.evaluate', {expression: expr, returnByValue: true, awaitPromise: true})).result?.value;

  await send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false});
  await send('Page.enable');
  return {
    send, evaluate,
    on: f => listeners.push(f),
    // Профиль удаляем после выхода Chrome: пока он закрывается, он дописывает туда файлы, и rm падает с ENOTEMPTY.
    close: async () => {
      ws.close();
      await new Promise(r => { chrome.once('exit', r); chrome.kill(); });
      fs.rmSync(profile, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
    },
  };
}
