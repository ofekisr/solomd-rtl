export const FRAME_CSS_VARS: readonly string[] = ['--bgcolor', '--root-color', '--root-bgcolor', '--root-border-color', '--root-radius', '--main-color', '--main-bgcolor', '--main-radius'];

export interface StripFrameStyle {
  readonly vars: Readonly<Record<string, string>>;
  readonly palette: readonly string[];
}

export const EMPTY_FRAME_STYLE: StripFrameStyle = { vars: {}, palette: [] };

export function readFrameVars(read: (name: string) => string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const name of FRAME_CSS_VARS) {
    const value = read(name).trim();
    if (value) vars[name] = value;
  }
  return vars;
}

export function branchColorAt(palette: readonly string[], index: number, own?: string): string | undefined {
  if (own) return own;
  return palette.length > 0 ? palette[index % palette.length] : undefined;
}
