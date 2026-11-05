import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setUnitName } from '../names.js';

const csv = (r) => r.csv;

test('replaces an exact line', () => {
  assert.equal(csv(setUnitName('100,Old\n200,Other\n', 100, 'New')), '100,New\n200,Other\n');
});
test('appends when absent', () => {
  assert.equal(csv(setUnitName('100,A\n', 200, 'B')), '100,A\n200,B\n');
  assert.equal(csv(setUnitName('', 200, 'B')), '200,B\n');
});
test('no trailing newline preserved', () => {
  assert.equal(csv(setUnitName('100,A', 100, 'Z')), '100,Z');
});
test('keeps comments and other rows', () => {
  const src = '# hi\n/^1(\\d{3})$/,Engine $1\n100,A\n';
  assert.equal(csv(setUnitName(src, 100, 'B')), '# hi\n/^1(\\d{3})$/,Engine $1\n100,B\n');
});
test('regex-only match gets an exact line above it', () => {
  assert.equal(csv(setUnitName('/^1(\\d{3})$/,Engine $1\n', 1234, 'Mine')), '1234,Mine\n/^1(\\d{3})$/,Engine $1\n');
});
test('new line goes before the first regex row, after plain rows', () => {
  assert.equal(csv(setUnitName('# c\n100,A\n/x/,Y\n', 300, 'N')), '# c\n100,A\n300,N\n/x/,Y\n');
});
test('empty name removes only the exact line', () => {
  assert.equal(csv(setUnitName('100,A\n200,B\n', 100, '')), '200,B\n');
  assert.equal(csv(setUnitName('100,A\n', 999, '')), '100,A\n');
  assert.equal(csv(setUnitName('100,A\n', 100, '   ')), '');
});
test('preserves CRLF', () => {
  assert.equal(csv(setUnitName('100,A\r\n', 200, 'B')), '100,A\r\n200,B\r\n');
});
test('duplicates: first exact line wins, later ones untouched', () => {
  assert.equal(csv(setUnitName('100,A\n100,B\n', 100, 'Z')), '100,Z\n100,B\n');
});
test('rejects bad names', () => {
  for (const bad of ['a,b', 'a\nb', 'a\rb', '#x']) {
    assert.ok(setUnitName('', 1, bad).error, bad);
  }
});
test('trims the name', () => {
  assert.equal(csv(setUnitName('', 5, '  Bob ')), '5,Bob\n');
});
test('unit as string works and matches numerically-equal text', () => {
  assert.equal(csv(setUnitName('007,A\n', '007', 'B')), '007,B\n');
});

import { exactUnitName } from '../names.js';

test('exact line below a regex row moves above it (the regex would win otherwise)', () => {
  assert.equal(
    csv(setUnitName('/^1\\d{3}$/,Engine\n1234,Old\n', 1234, 'New')),
    '1234,New\n/^1\\d{3}$/,Engine\n');
});
test('exact line already above a regex row stays put', () => {
  assert.equal(csv(setUnitName('1234,Old\n/^1\\d{3}$/,Engine\n', 1234, 'New')), '1234,New\n/^1\\d{3}$/,Engine\n');
});
test('exactUnitName reads only the exact line', () => {
  assert.equal(exactUnitName('/^1\\d{3}$/,Engine\n1234,Mine\n', 1234), 'Mine');
  assert.equal(exactUnitName('/^1\\d{3}$/,Engine\n', 1234), '');
  assert.equal(exactUnitName('', 1), '');
});
test('a comma inside the regex does not confuse the shadow check', () => {
  assert.equal(csv(setUnitName('/^1\\d{2,3}$/,Eng\n1234,Old\n', 1234, 'New')), '1234,New\n/^1\\d{2,3}$/,Eng\n');
});
