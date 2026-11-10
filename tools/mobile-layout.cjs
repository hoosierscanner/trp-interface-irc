// Phone-layout check, run against a live recorder that serves this interface (the page needs the
// recorder's client library, so it cannot be tested from a plain file server).
//
//   docker run --rm --network host -v "$PWD/tools":/t --entrypoint sh zenika/alpine-chrome:with-puppeteer \
//     -c 'cd /usr/src/app && cp /t/mobile-layout.cjs . && node mobile-layout.cjs http://127.0.0.1:8087/ /t/shots'
//
// Exits 1 if any check fails. Screenshots go to the second argument when given.
const puppeteer = require('puppeteer');
const url = process.argv[2] || 'http://127.0.0.1:8087/';
const shots = process.argv[3];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const check = (where, ok, what) => { if (!ok) fails.push(`${where}: ${what}`); };

async function openPage(browser, width, height, mobile) {
  const p = await browser.newPage();
  await p.setViewport({ width, height, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => document.querySelectorAll('.channel-item').length > 5, { timeout: 30000 });
  // A talkgroup channel with calls in it
  await p.evaluate(() => {
    const items = [...document.querySelectorAll('.channel-item')].filter((e) => /^#/.test(e.textContent.trim()));
    (items.find((e) => e.querySelector('.unread')) || items[0]).click();
  });
  await p.waitForFunction(() => document.querySelectorAll('.msg .nick').length > 2, { timeout: 30000 }).catch(() => {});
  await sleep(1500);
  return p;
}

const box = (p, sel) => p.evaluate((s) => {
  const e = document.querySelector(s);
  if (!e) return null;
  const b = e.getBoundingClientRect(), cs = getComputedStyle(e);
  return { w: b.width, h: b.height, l: b.left, r: b.right, t: b.top, b: b.bottom,
    shown: b.width > 0 && b.height > 0 && cs.visibility !== 'hidden', font: parseFloat(cs.fontSize) };
}, sel);

// Everything visible inside these bars must sit inside the screen.
const overflow = (p, sels) => p.evaluate((sels) => {
  const out = [];
  for (const s of sels) for (const e of document.querySelectorAll(s + ', ' + s + ' *')) {
    const b = e.getBoundingClientRect();
    if (!b.width || !b.height || getComputedStyle(e).visibility === 'hidden') continue;
    if (b.right > innerWidth + 1 || b.left < -1) out.push((e.id || String(e.className).split(' ')[0] || e.tagName) + '@' + Math.round(b.left) + '-' + Math.round(b.right));
  }
  return [...new Set(out)];
}, sels);

async function phone(browser, width, height) {
  const at = `${width}x${height}`;
  const p = await openPage(browser, width, height, true);
  const shot = async (n) => { if (shots) await p.screenshot({ path: `${shots}/${at}-${n}.png` }); };
  const bars = ['.titlebar', '.channel-bar', '.input-area'];

  await shot('1-channel');
  let over = await overflow(p, bars);
  check(at, over.length === 0, `off-screen in the bars: ${over.join(', ')}`);
  check(at, !(await box(p, '.trp-header'))?.shown, 'the theme strip is still shown');
  check(at, !(await box(p, '.statusbar'))?.shown, 'the status bar is still shown');
  check(at, (await box(p, '#tb-dot'))?.shown, 'no connection dot in the top bar');
  const body = await p.evaluate(() => document.body.getBoundingClientRect().height);
  check(at, Math.abs(body - height) < 2, `page height ${body} is not the screen's ${height}`);

  for (const s of ['#mobile-hamburger', '#mobile-users-btn', '#mobile-menu-btn', '#listen-btn', '#titlebar-chan']) {
    const b = await box(p, s);
    check(at, b && b.shown && b.h >= 40, `${s} is ${b ? Math.round(b.w) + 'x' + Math.round(b.h) : 'missing'}, want 40 high`);
  }
  for (const s of ['#input-field']) check(at, (await box(p, s))?.font >= 16, `${s} text under 16px (iOS zooms)`);
  const nickCap = await p.evaluate(() => { const n = document.querySelector('.msg:not(.system) .nick'); return n ? getComputedStyle(n).maxWidth : null; });
  check(at, nickCap !== '80px', 'radio names are still capped at 80px');

  // Channel drawer
  await p.tap('#mobile-hamburger'); await sleep(500); await shot('2-drawer');
  const row = await p.evaluate(() => {
    const r = [...document.querySelectorAll('.channel-item')].find((e) => e.querySelector('.fav-star'));
    const b = r.getBoundingClientRect(), s = r.querySelector('.fav-star').getBoundingClientRect();
    const vis = (q) => [...r.querySelectorAll(q)].some((e) => e.getBoundingClientRect().width > 0);
    return { h: b.height, r: b.right, starW: s.width, starH: s.height, extra: vis('.ign-icon') || vis('.scan-icon') };
  });
  check(at, row.h >= 40, `drawer rows are ${Math.round(row.h)} high, want 40`);
  check(at, row.starW >= 32 && row.starH >= 32, `drawer star is ${Math.round(row.starW)}x${Math.round(row.starH)}, want 32`);
  check(at, !row.extra, 'drawer rows still show the mute/ignore icons');
  check(at, row.r <= width, 'drawer is wider than the screen');
  check(at, (await box(p, '#tree-search'))?.font >= 16, 'search box text under 16px');
  await p.evaluate(() => document.getElementById('drawer-backdrop').click()); await sleep(400);

  // Channel actions sheet, then rename
  await p.tap('#titlebar-chan'); await sleep(400); await shot('3-chan-sheet');
  const sheet = await p.evaluate(() => {
    const s = document.getElementById('chan-sheet');
    if (!s || !s.classList.contains('open')) return null;
    return [...s.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().height > 0)
      .map((b) => ({ t: b.textContent.trim(), h: b.getBoundingClientRect().height, r: b.getBoundingClientRect().right, bot: b.getBoundingClientRect().bottom }));
  });
  check(at, sheet && sheet.length >= 3, 'the channel sheet did not open with its actions');
  if (sheet) {
    check(at, sheet.every((b) => b.h >= 44), `channel sheet buttons under 44 high: ${sheet.filter((b) => b.h < 44).map((b) => b.t)}`);
    check(at, sheet.every((b) => b.r <= width && b.bot <= height), 'channel sheet runs off the screen');
    for (const want of ['Rename', 'Star', 'Ignore here']) check(at, sheet.some((b) => b.t.includes(want)), `channel sheet has no "${want}"`);
    await p.evaluate(() => [...document.querySelectorAll('#chan-sheet button')].find((b) => /Rename/.test(b.textContent)).click());
    await sleep(400); await shot('4-rename');
    const inp = await box(p, '.chan-edit-input');
    check(at, inp && inp.shown && inp.font >= 16 && inp.w >= width * 0.5, `rename field: ${JSON.stringify(inp)}`);
    over = await overflow(p, ['.channel-bar']);
    check(at, over.length === 0, `rename row off-screen: ${over.join(', ')}`);
    const sv = await box(p, '.chan-edit-save');
    check(at, sv && sv.h >= 40, `rename Save is ${sv ? Math.round(sv.h) : '?'} high, want 40`);
    await p.evaluate(() => document.querySelector('.chan-edit-cancel').click());
  }

  // Menu sheet
  await p.tap('#mobile-menu-btn'); await sleep(400); await shot('5-menu-sheet');
  const menu = await p.evaluate(() => {
    const s = document.getElementById('menu-sheet');
    if (!s || !s.classList.contains('open')) return null;
    const b = s.getBoundingClientRect();
    return { mode: !!s.querySelector('#listen-mode'), vol: !!s.querySelector('#listen-vol'), themes: s.querySelectorAll('.sheet-theme').length,
      sync: [...s.querySelectorAll('button')].some((x) => /SYNC/i.test(x.textContent)), bot: b.bottom, r: b.right };
  });
  check(at, menu && menu.mode && menu.vol && menu.sync && menu.themes > 3, `menu sheet contents: ${JSON.stringify(menu)}`);
  if (menu) check(at, menu.bot <= height + 1 && menu.r <= width, 'menu sheet runs off the screen');
  await p.evaluate(() => document.getElementById('sheet-backdrop').click()); await sleep(300);

  // Radio rename dialog
  await p.evaluate(() => document.querySelector('.msg:not(.system) .nick')?.click()); await sleep(1200); await shot('6-radio');
  const mb = await box(p, '.unit-modal-box'), ti = await box(p, '#unit-modal-tag'), sb = await box(p, '#unit-modal-save');
  check(at, mb && mb.shown && mb.w >= width - 1 && mb.h >= height - 1, `radio dialog is not full-screen: ${JSON.stringify(mb)}`);
  check(at, ti && ti.font >= 16 && ti.h >= 44, `radio name field: ${JSON.stringify(ti)}`);
  check(at, sb && sb.h >= 44 && sb.r <= width, `radio Save button: ${JSON.stringify(sb)}`);
  await p.evaluate(() => document.querySelector('.unit-modal-close').click());

  // Player
  await p.evaluate(() => document.querySelector('.msg .voice-play')?.click()); await sleep(1200); await shot('7-player');
  over = await overflow(p, ['.player-bar']);
  check(at, over.length === 0, `player off-screen: ${over.join(', ')}`);
  for (const s of ['#player-play', '#player-close']) { const b = await box(p, s); check(at, !b || !b.shown || b.h >= 40, `${s} is ${b && Math.round(b.h)} high, want 40`); }
  await p.close();
}

async function desktop(browser) {
  const at = 'desktop 1280';
  const p = await openPage(browser, 1280, 800, false);
  if (shots) await p.screenshot({ path: `${shots}/desktop.png` });
  for (const s of ['#mobile-hamburger', '#mobile-menu-btn', '#tb-dot', '#chan-sheet', '#menu-sheet']) check(at, !(await box(p, s))?.shown, `${s} shows on desktop`);
  for (const s of ['.statusbar', '.trp-header', '#sync-btn', '#chan-star', '#chan-name']) check(at, (await box(p, s))?.shown, `${s} is missing on desktop`);
  check(at, await p.evaluate(() => !!document.querySelector('#listen-ctl #listen-mode') && !!document.querySelector('#listen-ctl #listen-vol')), 'listen mode/volume left the title bar');
  check(at, (await box(p, '.titlebar'))?.h === 28, 'title bar height changed');
  const row = await p.evaluate(() => document.querySelector('.channel-item').getBoundingClientRect().height);
  check(at, row < 26, `tree rows grew to ${row}`);
  await p.close();
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser', args: ['--no-sandbox'] });
  try {
    await phone(browser, 390, 844);
    await phone(browser, 360, 640);
    await desktop(browser);
  } catch (e) { fails.push('crashed: ' + e.message); }
  await browser.close();
  if (fails.length) { console.log(`FAIL (${fails.length})`); for (const f of fails) console.log(' - ' + f); process.exit(1); }
  console.log('PASS: phone 390x844, phone 360x640, desktop 1280');
})();
