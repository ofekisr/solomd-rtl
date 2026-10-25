import { isSafeColor } from './mindmap-display.ts';
import { sanitizeStyle } from './mindmap-format.ts';
import type { NodeStyle } from './mindmap-node-copy.ts';

export interface StyleTemplate extends NodeStyle {
  readonly name: string;
}

export const STYLE_TEMPLATE_NAME_MAX = 60;
export const STYLE_TEMPLATES_MAX = 30;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function templateName(raw: string): string {
  return raw.replace(/[<>]/g, '').trim().slice(0, STYLE_TEMPLATE_NAME_MAX);
}

function parseTemplate(value: unknown): StyleTemplate | null {
  if (!isRecord(value) || typeof value.name !== 'string') return null;
  const name = templateName(value.name);
  if (name === '') return null;
  const style = (sanitizeStyle(value.style) ?? {}) as Record<string, string>;
  const branchColor = isSafeColor(value.branchColor) ? (value.branchColor as string).trim() : undefined;
  return branchColor ? { name, style, branchColor } : { name, style };
}

/** Settings are user-editable on disk, so every template is re-sanitized on load. */
export function normalizeStyleTemplates(value: unknown): StyleTemplate[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const templates: StyleTemplate[] = [];
  for (const template of value.map(parseTemplate)) {
    if (!template || seen.has(template.name)) continue;
    seen.add(template.name);
    templates.push(template);
  }
  return templates.slice(0, STYLE_TEMPLATES_MAX);
}

/** Saving under an existing name replaces that template in place. */
export function upsertTemplate(templates: readonly StyleTemplate[], template: StyleTemplate): StyleTemplate[] {
  const index = templates.findIndex((t) => t.name === template.name);
  const next = index === -1 ? [...templates, template] : templates.map((t, i) => (i === index ? template : t));
  return normalizeStyleTemplates(next);
}

export function removeTemplate(templates: readonly StyleTemplate[], name: string): StyleTemplate[] {
  return templates.filter((t) => t.name !== name);
}
