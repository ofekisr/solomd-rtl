import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STYLE_TEMPLATES_MAX, normalizeStyleTemplates, removeTemplate, templateName, upsertTemplate } from './style-templates.ts';

test('normalizeStyleTemplates keeps allowed style keys and safe colors only', () => {
  const [template] = normalizeStyleTemplates([{ name: ' Pill ', style: { color: '#fff', background: 'url(x)', position: 'fixed' }, branchColor: 'javascript:x' }]);
  assert.deepEqual(template, { name: 'Pill', style: { color: '#fff' } });
});

test('normalizeStyleTemplates drops nameless, duplicate and excess entries', () => {
  const many = Array.from({ length: STYLE_TEMPLATES_MAX + 3 }, (_, i) => ({ name: `t${i}`, style: {} }));
  assert.equal(normalizeStyleTemplates(many).length, STYLE_TEMPLATES_MAX);
  assert.deepEqual(normalizeStyleTemplates([{ name: '' }, { name: 'a' }, { name: 'a' }, 'x', null]).map((t) => t.name), ['a']);
  assert.deepEqual(normalizeStyleTemplates('nope'), []);
});

test('templateName strips angle brackets and caps length', () => {
  assert.equal(templateName('<b>Hot</b>'), 'bHot/b');
  assert.equal(templateName('x'.repeat(100)).length, 60);
});

test('upsertTemplate replaces by name in place, else appends', () => {
  const list = [{ name: 'a', style: { color: '#000' } }, { name: 'b', style: {} }];
  assert.deepEqual(upsertTemplate(list, { name: 'a', style: { color: '#fff' } }).map((t) => [t.name, t.style.color]), [['a', '#fff'], ['b', undefined]]);
  assert.deepEqual(upsertTemplate(list, { name: 'c', style: {} }).map((t) => t.name), ['a', 'b', 'c']);
});

test('removeTemplate removes by name', () => {
  assert.deepEqual(removeTemplate([{ name: 'a', style: {} }, { name: 'b', style: {} }], 'a').map((t) => t.name), ['b']);
});
