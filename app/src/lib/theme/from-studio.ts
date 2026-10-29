import { THEME_TOKEN_KEYS, isGradient, toHex6, type Backdrop, type Palette, type UserTheme } from '../user-theme.ts';
import type { BackdropLayer, Theme, ThemeMode, Variant } from './schema.ts';
import { varsToVariant } from './css-vars.ts';
import { resolveVariant } from './resolve.ts';
import { themeVars } from './css.ts';

const GRADIENT_END = 100;
const NO_PANEL_OPACITY = 0;

function backdropOf(b: Backdrop): BackdropLayer[] | undefined {
  if (!isGradient(b)) return undefined;
  return [{ kind: 'linear', angle: b.angle, stops: [{ color: b.from, at: 0 }, { color: b.to, at: GRADIENT_END }] }];
}

function variantOf(ut: UserTheme, mode: ThemeMode): Variant {
  const { variant } = varsToVariant(ut[mode], mode);
  const backdrop = backdropOf(ut.gradient[mode]);
  return {
    ...variant,
    app: { ...variant.app, style: { radius: ut.radius } },
    ...(backdrop ? { surfaces: { ...variant.surfaces, style: { backdrop, panelOpacity: NO_PANEL_OPACITY } } } : {}),
  };
}

export function fromUserTheme(ut: UserTheme): Theme {
  return {
    id: ut.id, name: ut.name, version: 1, source: 'mine', origin: 'studio',
    variants: { light: variantOf(ut, 'light'), dark: variantOf(ut, 'dark') },
  };
}

export function paletteOf(variant: Variant): Palette {
  const vars = themeVars(resolveVariant(variant));
  return Object.fromEntries(THEME_TOKEN_KEYS.map((k) => [k, toHex6(vars[k] ?? '')]));
}
