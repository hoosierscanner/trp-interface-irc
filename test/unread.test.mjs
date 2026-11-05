import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unreadList, stepUnread, tabTitle } from '../unread.js';

test('unreadList: only counts > 0, newest first, ties by name', () => {
  const u = new Map([['#b', 2], ['#a', 3], ['#c', 0], ['#d', 1]]);
  const t = new Map([['#b', 50], ['#a', 50], ['#d', 90]]);
  assert.deepEqual(unreadList(u, t), [
    { name: '#d', count: 1 }, { name: '#a', count: 3 }, { name: '#b', count: 2 },
  ]);
});
test('unreadList: missing timestamp counts as 0', () => {
  const u = new Map([['#x', 1], ['#y', 1]]);
  assert.deepEqual(unreadList(u, new Map([['#y', 5]])).map(e => e.name), ['#y', '#x']);
});
test('stepUnread: next, previous, wrap', () => {
  const n = ['#a', '#b', '#c'];
  assert.equal(stepUnread(n, '#a', 1), '#b');
  assert.equal(stepUnread(n, '#c', 1), '#a');
  assert.equal(stepUnread(n, '#a', -1), '#c');
  assert.equal(stepUnread(n, '#b', -1), '#a');
});
test('stepUnread: active not in list, and empty list', () => {
  assert.equal(stepUnread(['#a', '#b'], '#z', 1), '#a');
  assert.equal(stepUnread(['#a', '#b'], '#z', -1), '#b');
  assert.equal(stepUnread([], '#a', 1), null);
});
test('tabTitle', () => {
  assert.equal(tabTitle(0, 'Radio IRC'), 'Radio IRC');
  assert.equal(tabTitle(5, 'Radio IRC'), '(5) Radio IRC');
  assert.equal(tabTitle(99, 'Radio IRC'), '(99) Radio IRC');
  assert.equal(tabTitle(100, 'Radio IRC'), '(99+) Radio IRC');
});
