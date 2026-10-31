/*
 * trp-themes 1.0.0 — theme-engine.js
 *
 * Applies a theme from THEME_CONFIG (theme-config.js, loaded first) to the page:
 * its variables go on <html> as CSS custom properties (--bg, --text, …), a header
 * line with the page's title and a picker of the themes is put at the top, and the
 * choice is kept in the browser. Nothing is loaded from the internet.
 *
 *   <script src="theme-config.js"></script>
 *   <script src="theme-engine.js"></script>
 *
 * Options, set before the scripts on window.THEME_ENGINE_OPTIONS:
 *   pageTitle, pageSubtitle   the header line (default: the document's title, nothing)
 *   header: false             no header line (then there is no picker either)
 *   switcher: false           a header line without the picker
 *   toast: false              no theme-name toast on a change
 *   default: 'appleGlass'     the theme when none is saved
 *   storageKey: 'trp-theme'   where the choice is kept (localStorage)
 *   local: 'theme-local.js'   a file of the user's own themes beside the page (see below); '' for none
 *
 * Choosing: the picker, Ctrl/Cmd+Shift+T (the next theme), or ?theme=<key> in the
 * address, which is saved like a pick. The saved choice is per site (each interface's
 * port is its own), so a bookmark with ?theme= is the way to fix a look.
 *
 * The user's own themes: a theme-local.js beside index.html that sets
 *   window.THEME_LOCAL = { themes: { myTheme: { name, switcher, vars } }, default: 'myTheme' }
 * (or just the themes object). They join the picker; a missing file is fine. An
 * interface's upgrade replaces its own files, never that one.
 *
 * window.ThemeEngine: apply(key), current(), list(), config. 'themechange' is
 * dispatched on window with { key, name, theme } on every change.
 */
(function () {
  if (typeof THEME_CONFIG === 'undefined') {
    console.error('[trp-themes] THEME_CONFIG not found: load theme-config.js before theme-engine.js');
    return;
  }
  const config = THEME_CONFIG;
  const opts = Object.assign({
    pageTitle: document.title,
    pageSubtitle: '',
    header: true,
    switcher: true,
    toast: true,
    toastDuration: 2000,
    default: 'appleGlass',
    storageKey: 'trp-theme',
    local: 'theme-local.js',
  }, window.THEME_ENGINE_OPTIONS || {});

  const root = document.documentElement;
  let current = null;
  let wanted = null; // a saved key not (yet) in the config: a local theme's, applied when it arrives
  let toastTimer = null;
  let picker = null;

  /** Put a theme's variables on <html>. */
  function setVars(theme) {
    for (const [name, value] of Object.entries(theme.vars)) root.style.setProperty(`--${name}`, value);
  }

  /** Switch to a theme: its variables, the picker's mark, the saved choice, the toast. */
  function apply(key, quiet) {
    const theme = config[key];
    if (!theme) {
      console.warn(`[trp-themes] no theme "${key}"`);
      return false;
    }
    // A theme's variable the last one set and this one lacks would linger.
    if (current && config[current]) for (const name of Object.keys(config[current].vars)) root.style.removeProperty(`--${name}`);
    setVars(theme);
    current = key;
    // A pick, or the local theme the user had picked, is the choice; the default
    // standing in for a local theme not yet loaded is not, and doesn't overwrite it.
    if (!quiet || key === wanted) wanted = null;
    if (picker) for (const b of picker.children) b.classList.toggle('active', b.dataset.theme === key);
    if (!wanted) try { localStorage.setItem(opts.storageKey, key); } catch (e) { /* private mode */ }
    if (!quiet && opts.toast) toast(theme.name);
    window.dispatchEvent(new CustomEvent('themechange', { detail: { key, name: theme.name, theme } }));
    return true;
  }

  /** The theme to start with: ?theme=, the saved one (this key, or the older 'eh-theme'), the default, the first. */
  function startingTheme() {
    let key = null;
    try { key = new URLSearchParams(location.search).get('theme'); } catch (e) { /* no location */ }
    if (!key) {
      try { key = localStorage.getItem(opts.storageKey) || localStorage.getItem('eh-theme'); } catch (e) { /* private mode */ }
    }
    if (key && !config[key]) wanted = key; // maybe a local theme: kept until theme-local.js has come
    if (key && config[key]) return key;
    if (config[opts.default]) return opts.default;
    return Object.keys(config)[0];
  }

  // ── The header line and the picker ──

  const CSS = `
.trp-header {
  position: sticky; top: 0; z-index: 200;
  display: flex; align-items: center; gap: 16px; height: 60px; padding: 0 20px;
  background: color-mix(in srgb, var(--bg, #fff) 92%, transparent);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border, rgba(128,128,128,0.3));
  transition: background 0.5s, border-color 0.4s;
}
.trp-header-title {
  font-family: var(--font-display, sans-serif); font-size: 18px; font-weight: 700;
  color: var(--text, #111); white-space: nowrap;
}
.trp-header-sub {
  font-family: var(--font-mono, monospace); font-size: 11px; letter-spacing: 0.08em;
  color: var(--text-muted, #777); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.trp-picker {
  margin-left: auto; display: flex; gap: 4px; padding: 4px; flex-shrink: 0;
  background: var(--bg-surface, transparent); border: 1px solid var(--border, rgba(128,128,128,0.3));
  border-radius: 10px; transition: all 0.5s;
}
.trp-picker .theme-btn {
  width: 22px; height: 22px; border-radius: 5px; border: 2px solid transparent; padding: 0;
  cursor: pointer; transition: all 0.25s; position: relative; font-size: 0; flex-shrink: 0;
}
.trp-picker .theme-btn:hover { transform: scale(1.15); }
.trp-picker .theme-btn.active { border-color: var(--accent, #36f); transform: scale(1.1); }
.trp-picker .theme-btn::after {
  content: attr(data-name);
  position: absolute; bottom: -24px; left: 50%; transform: translateX(-50%);
  font-size: 8px; font-family: var(--font-mono, monospace); letter-spacing: 1px; text-transform: uppercase;
  white-space: nowrap; color: var(--text-muted, #777);
  background: var(--bg, #fff); border: 1px solid var(--border, rgba(128,128,128,0.3));
  padding: 2px 6px; border-radius: 4px; opacity: 0; transition: opacity 0.2s; pointer-events: none; z-index: 10001;
}
.trp-picker .theme-btn:hover::after { opacity: 1; }
.trp-toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 10000;
  font-family: var(--font-display, sans-serif); font-size: 12px; letter-spacing: 3px; text-transform: uppercase;
  color: var(--accent, #36f);
  background: color-mix(in srgb, var(--bg, #fff) 92%, transparent); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--border, rgba(128,128,128,0.3)); padding: 10px 24px; border-radius: 100px;
  transition: opacity 0.5s; pointer-events: none; opacity: 0;
}
.trp-toast.show { opacity: 1; }
@media (max-width: 600px) {
  .trp-header { height: 50px; padding: 0 12px; gap: 10px; }
  .trp-header-title { font-size: 16px; }
  .trp-header-sub { display: none; }
  .trp-picker { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .trp-picker::-webkit-scrollbar { display: none; }
  .trp-picker .theme-btn { width: 18px; height: 18px; }
}
`;

  function text(tag, className, content) {
    const el = document.createElement(tag);
    el.className = className;
    el.textContent = content;
    return el;
  }

  /** The header line at the top of the body: title, subtitle, the picker. */
  function buildHeader() {
    const style = document.createElement('style');
    style.id = 'trp-themes-style';
    style.textContent = CSS;
    document.head.appendChild(style);
    if (!opts.header) return;
    const header = document.createElement('header');
    header.className = 'trp-header';
    header.id = 'trp-header';
    header.appendChild(text('span', 'trp-header-title', opts.pageTitle));
    if (opts.pageSubtitle) header.appendChild(text('span', 'trp-header-sub', opts.pageSubtitle));
    if (opts.switcher) {
      picker = document.createElement('div');
      picker.className = 'trp-picker';
      picker.id = 'trp-picker';
      header.appendChild(picker);
      fillPicker();
    }
    document.body.insertBefore(header, document.body.firstChild);
  }

  /** A swatch a theme in the picker, the current one marked. */
  function fillPicker() {
    if (!picker) return;
    picker.textContent = '';
    for (const [key, theme] of Object.entries(config)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'theme-btn' + (key === current ? ' active' : '');
      b.dataset.theme = key;
      b.dataset.name = theme.name;
      b.title = theme.name;
      const sw = theme.switcher || {};
      b.style.background = sw.bg || theme.vars.bg || '';
      b.style.boxShadow = `inset 0 -8px 0 ${sw.accent || theme.vars.accent || 'transparent'}`;
      b.addEventListener('click', () => apply(key));
      picker.appendChild(b);
    }
  }

  /** The theme's name, briefly, at the bottom of the page. */
  function toast(name) {
    let el = document.getElementById('themeLabel');
    if (!el) {
      el = document.createElement('div');
      el.id = 'themeLabel';
      document.body.appendChild(el);
    }
    el.classList.add('trp-toast');
    el.textContent = name;
    el.classList.remove('show');
    void el.offsetWidth; // restart the transition
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), opts.toastDuration);
  }

  // ── The user's own themes ──

  /** Load theme-local.js if it is there; its themes join the config and the picker. */
  function loadLocal() {
    if (!opts.local) return;
    const s = document.createElement('script');
    s.src = opts.local;
    s.async = true;
    s.onload = () => {
      const local = window.THEME_LOCAL;
      if (!local || typeof local !== 'object') return;
      const themes = local.themes && typeof local.themes === 'object' ? local.themes : local;
      let n = 0;
      for (const [key, theme] of Object.entries(themes)) {
        if (key === 'default' || !theme || typeof theme !== 'object' || !theme.vars) continue;
        config[key] = Object.assign({ name: key, switcher: {} }, theme);
        n++;
      }
      if (!n) return;
      fillPicker();
      if (wanted && config[wanted]) apply(wanted, true);
      else if (!saved() && local.default && config[local.default]) apply(local.default, true);
    };
    s.onerror = () => s.remove(); // no such file: nothing to do
    document.head.appendChild(s);
  }

  function saved() {
    try { return localStorage.getItem(opts.storageKey); } catch (e) { return null; }
  }

  // ── Keys and start ──

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
      e.preventDefault();
      const keys = Object.keys(config);
      apply(keys[(keys.indexOf(current) + 1) % keys.length]);
    }
  });

  // The variables at once, before the page is drawn; the header once the body is there.
  const first = startingTheme();
  setVars(config[first]);
  current = first;
  function start() {
    buildHeader();
    apply(first, true);
    loadLocal();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  // Back from the back/forward cache: another tab may have changed the choice meanwhile.
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    const key = saved();
    if (key && key !== current && config[key]) apply(key, true);
  });

  window.ThemeEngine = {
    apply: (key) => apply(key),
    current: () => current,
    list: () => Object.keys(config),
    config,
    default: opts.default,
  };
})();
