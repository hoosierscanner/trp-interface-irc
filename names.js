// Edits the recorder's unit-names CSV (systems[i].unitNames.csv): headerless `unit,name` lines,
// `#` comments, and `/regex/,name` rows; the first matching line wins. Pure: text in, text out.

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
    lines[at] = `${id},${clean}`;
  } else {
    const r = lines.findIndex(isRegex);
    lines.splice(r >= 0 ? r : lines.length, 0, `${id},${clean}`);
  }
  if (lines.length === 0) return { csv: '' };
  return { csv: lines.join(eol) + (endsWithEol || at < 0 ? eol : '') };
}
