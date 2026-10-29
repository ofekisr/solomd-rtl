import { z } from 'zod';
import {
  MAX_BACKDROP_LAYERS, MAX_ID_LENGTH, MAX_NAME_LENGTH, MAX_PANEL_BLUR_PX, MAX_ROUNDNESS, MIN_ROUNDNESS,
  ID_RE, SECTION_COLOR_VARS, type ColorKey, type SectionId,
} from './tokens.ts';

const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%/]+\)|hsla?\([\d\s.,%/deg]+\)|color-mix\([a-z0-9\s.,%#()-]+\)|transparent)$/i;
const PERCENT_MIN = 0;
const PERCENT_MAX = 100;
const DEGREES_MAX = 360;
const OPACITY_MIN = 0;
const OPACITY_MAX = 1;
const MIN_GRADIENT_STOPS = 2;
const THEME_VERSION = 1;

const color = z.string().trim().regex(COLOR_RE, 'not an allowed colour');
const percent = z.number().min(PERCENT_MIN).max(PERCENT_MAX);
const roundness = z.number().min(MIN_ROUNDNESS).max(MAX_ROUNDNESS);
const textStyle = z.strictObject({ italic: z.boolean().optional(), bold: z.boolean().optional(), underline: z.boolean().optional() });

const backdropLayer = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('linear'),
    angle: z.number().min(0).max(DEGREES_MAX),
    stops: z.array(z.strictObject({ color, at: percent })).min(MIN_GRADIENT_STOPS),
  }),
  z.strictObject({ kind: z.literal('radial'), x: percent, y: percent, color, fade: percent }),
]);

function colorsOf<S extends SectionId>(section: S) {
  const keys = Object.keys(SECTION_COLOR_VARS[section]) as ColorKey<S>[];
  const shape = Object.fromEntries(keys.map((k) => [k, color.optional()])) as Record<ColorKey<S>, z.ZodOptional<typeof color>>;
  return z.strictObject(shape);
}

const appColors = colorsOf('app').extend({ bg: color, text: color, accent: color });

const styles = {
  app: z.strictObject({ radius: roundness.optional() }),
  surfaces: z.strictObject({
    backdrop: z.array(backdropLayer).max(MAX_BACKDROP_LAYERS).optional(),
    panelOpacity: z.number().min(OPACITY_MIN).max(OPACITY_MAX).optional(),
    panelBlur: z.number().min(0).max(MAX_PANEL_BLUR_PX).optional(),
  }),
  markdown: z.strictObject({ heading: textStyle.optional(), link: textStyle.optional(), quote: textStyle.optional() }),
  code: z.strictObject({
    comment: textStyle.optional(), keyword: textStyle.optional(), function: textStyle.optional(), string: textStyle.optional(),
  }),
  editor: z.strictObject({ activeLine: z.boolean().optional() }),
  diagrams: z.strictObject({ nodeRadius: roundness.optional() }),
};

function section<S extends SectionId, T extends z.ZodTypeAny>(id: S, style: T) {
  return z.strictObject({ colors: colorsOf(id).optional(), style: style.optional() }).optional();
}

export const variantSchema = z.strictObject({
  label: z.string().max(MAX_NAME_LENGTH).optional(),
  mode: z.enum(['light', 'dark']),
  app: z.strictObject({ colors: appColors, style: styles.app.optional() }),
  surfaces: section('surfaces', styles.surfaces),
  markdown: section('markdown', styles.markdown),
  code: section('code', styles.code),
  editor: section('editor', styles.editor),
  diagrams: section('diagrams', styles.diagrams),
});

export const themeSchema = z.strictObject({
  id: z.string().min(1).max(MAX_ID_LENGTH).regex(ID_RE),
  name: z.string().min(1).max(MAX_NAME_LENGTH),
  author: z.string().max(MAX_NAME_LENGTH).optional(),
  version: z.literal(THEME_VERSION),
  source: z.enum(['builtin', 'catalog', 'mine']),
  origin: z.enum(['studio', 'json', 'marketplace', 'fork']).optional(),
  basedOn: z.string().max(MAX_ID_LENGTH).optional(),
  variants: z.record(z.string().regex(ID_RE), variantSchema).refine((v) => Object.keys(v).length > 0, 'needs at least one variant'),
});

export type Theme = z.infer<typeof themeSchema>;
export type Variant = z.infer<typeof variantSchema>;
export type ThemeMode = Variant['mode'];
export type BackdropLayer = z.infer<typeof backdropLayer>;
export type TextStyle = z.infer<typeof textStyle>;
export type ParseResult = { ok: true; theme: Theme } | { ok: false; error: string };

export function parseTheme(raw: unknown): ParseResult {
  const r = themeSchema.safeParse(raw);
  if (r.success) return { ok: true, theme: r.data };
  const issue = r.error.issues[0];
  const keys = issue.code === 'unrecognized_keys' ? `.${issue.keys.join(',')}` : '';
  return { ok: false, error: `${issue.path.join('.')}${keys}: ${issue.message}` };
}
