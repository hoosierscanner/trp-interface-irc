// Pure helpers for the Unread section: ordering, next/previous, and the tab title.

/** Channels with unread messages, most recently updated first (ties by name). */
export function unreadList(unread, lastTs) {
  const out = [];
  for (const [name, count] of unread) if (count > 0) out.push({ name, count });
  out.sort((a, b) => (lastTs.get(b.name) || 0) - (lastTs.get(a.name) || 0) || a.name.localeCompare(b.name));
  return out;
}

/** The channel after (dir 1) or before (dir -1) `active` in `names`, wrapping; null when empty. */
export function stepUnread(names, active, dir) {
  if (!names.length) return null;
  const i = names.indexOf(active);
  if (i < 0) return dir > 0 ? names[0] : names[names.length - 1];
  return names[(i + dir + names.length) % names.length];
}

/** "(N) base" when something is unread; N over 99 shows "99+". */
export function tabTitle(total, base) {
  if (total <= 0) return base;
  return `(${total > 99 ? '99+' : total}) ${base}`;
}
