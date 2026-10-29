import { THEME_TOKEN_KEYS, isGradient, toHex6, type Backdrop, type Palette, type UserTheme } from '../user-theme.ts';
import type { BackdropLayer, Theme, ThemeMode, Variant } from './schema.ts';
import { parseTheme } from './schema.ts';
import { varsToVariant } from './css-vars.ts';
import { resolveVariant } from './resolve.ts';
import { themeVars } from './css.ts';
import solomdJson from './builtin/solomd.json' with { type: 'json' };

const GRADIENT_END = 100;
const NO_PANEL_OPACITY = 0;
const UNTITLED_NAME = 'Untitled theme';
const REQUIRED_APP_COLORS = ['bg', 'text', 'accent'] as const;

type AppColors = Variant['app']['colors'];

const SOLOMD_BASE = parseTheme(solomdJson);

function baseAppColors(mode: ThemeMode): AppColors {
  if (!SOLOMD_BASE.ok) throw new Error(`built-in solomd theme is invalid: ${SOLOMD_BASE.error}`);
  return SOLOMD_BASE.theme.variants[mode].app.colors;
}

function backdropOf(b: Backdrop): BackdropLayer[] | undefined {
  if (!isGradient(b)) return undefined;
  return [{ kind: 'linear', angle: b.angle, stops: [{ color: b.from, at: 0 }, { color: b.to, at: GRADIENT_END }] }];
}

function appColorsOf(mode: ThemeMode, own: Partial<AppColors>): AppColors {
  const base = baseAppColors(mode);
  const filled = { ...own };
  for (const key of REQUIRED_APP_COLORS) filled[key] = own[key] ?? base[key];
  return filled as AppColors;
}

function variantOf(ut: UserTheme, mode: ThemeMode): Variant {
  const { variant } = varsToVariant(ut[mode], mode);
  const backdrop = backdropOf(ut.gradient[mode]);
  const colors = appColorsOf(mode, variant.app?.colors ?? {});
  return {
    ...variant,
    app: { ...variant.app, colors, style: { radius: ut.radius } },
    ...(backdrop ? { surfaces: { ...variant.surfaces, style: { backdrop, panelOpacity: NO_PANEL_OPACITY } } } : {}),
  };
}

export function fromUserTheme(ut: UserTheme): Theme {
  return {
    id: ut.id, name: ut.name.trim() || UNTITLED_NAME, version: 1, source: 'mine', origin: 'studio',
    variants: { light: variantOf(ut, 'light'), dark: variantOf(ut, 'dark') },
  };
}

export function paletteOf(variant: Variant): Palette {
  const vars = themeVars(resolveVariant(variant));
  return Object.fromEntries(THEME_TOKEN_KEYS.map((k) => [k, toHex6(vars[k] ?? '')]));
}
