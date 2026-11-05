// Edits the recorder's unit-names CSV (systems[i].unitNames.csv): headerless `unit,name` lines,
// `#` comments, and `/regex/,name` rows; the first matching line wins. Pure: text in, text out.

/** Does the `/pattern/,name` row's pattern match `id`? (An unreadable pattern counts as no match.) */
function regexMatches(line, id) {
  const t = line.trimStart();
  const comma = t.lastIndexOf(',');   // names never contain a comma, patterns may
  const end = t.lastIndexOf('/', comma >= 0 ? comma : t.length);
  if (end <= 0) return false;
  try { return new RegExp(t.slice(1, end)).test(id); } catch { return false; }
}

/** Set (or, with an empty name, remove) the exact line for `unit`. Returns { csv } or { error }. */
export function setUnitName(csv, unit, name) {
  const clean = String(name ?? '').trim();
  if (/[,\r\n]/.test(clean)) return { error: 'A name can\'t contain a comma or a line break' };
  if (clean.startsWith('#')) return { error: 'A name can\'t start with #' };

  const text = csv ?? '';
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const endsWithEol = text === '' || text.endsWith('\n');
  const lines = text === '' ? [] : text.replace(/\r?\n$/, '').split(/\r?\n/);
  const id = String(unit).trim();

  const isExact = (l) => {
    const t = l.trimStart();
    if (t.startsWith('#') || t.startsWith('/')) return false;
    const i = t.indexOf(',');
    return i >= 0 && t.slice(0, i).trim() === id;
  };
  const isRegex = (l) => l.trimStart().startsWith('/');

  const at = lines.findIndex(isExact);
  if (clean === '') {
    if (at >= 0) lines.splice(at, 1);
  } else if (at >= 0) {
    // The first matching line wins, so an exact line below a regex row would never be used: move it above.
    const shadow = lines.findIndex((l, i) => i < at && isRegex(l) && regexMatches(l, id));
    if (shadow >= 0) { lines.splice(at, 1); lines.splice(shadow, 0, `${id},${clean}`); }
    else lines[at] = `${id},${clean}`;
  } else {
    const r = lines.findIndex(isRegex);
    lines.splice(r >= 0 ? r : lines.length, 0, `${id},${clean}`);
  }
  if (lines.length === 0) return { csv: '' };
  return { csv: lines.join(eol) + (endsWithEol || at < 0 ? eol : '') };
}

/** The name on the exact `unit,name` line (regex rows ignored); '' when there is none. */
export function exactUnitName(csv, unit) {
  const id = String(unit).trim();
  for (const l of String(csv ?? '').split(/\r?\n/)) {
    const t = l.trimStart();
    if (t.startsWith('#') || t.startsWith('/')) continue;
    const i = t.indexOf(',');
    if (i >= 0 && t.slice(0, i).trim() === id) return t.slice(i + 1).trim();
  }
  return '';
}
