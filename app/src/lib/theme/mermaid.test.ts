import assert from 'node:assert/strict';
import { test } from 'node:test';
import { graphvizThemeFor, mermaidConfigFor } from './mermaid.ts';
import { resolveVariant } from './resolve.ts';

const r = resolveVariant({ mode: 'dark', app: { colors: { bg: '#000000', text: '#ffffff', accent: '#ff9f40' } } });

test('Mermaid uses the base theme with diagram colours', () => {
  const c = mermaidConfigFor(r, (x) => x);
  assert.equal(c.theme, 'base');
  assert.equal(c.themeVariables.primaryBorderColor, '#ff9f40');
  assert.equal(c.themeVariables.darkMode, true);
});

test('graphviz keeps its light/dark switch', () => {
  assert.equal(graphvizThemeFor('dark'), 'dark');
  assert.equal(graphvizThemeFor('light'), 'default');
});
