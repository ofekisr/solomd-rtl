import { escapeRegExp, type FindSpec } from './find-spec.ts';

export interface WrapPreset {
  id: string;
  label: string;
  before: string;
  after: string;
}

const WHOLE_MATCH = '$&';

export const WRAP_PRESETS: readonly WrapPreset[] = [
  { id: 'code', label: '`a`', before: '`', after: '`' },
  { id: 'bold', label: '**B**', before: '**', after: '**' },
  { id: 'italic', label: '*I*', before: '*', after: '*' },
  { id: 'strike', label: '~~S~~', before: '~~', after: '~~' },
  { id: 'highlight', label: '==H==', before: '==', after: '==' },
  { id: 'quote', label: '"q"', before: '"', after: '"' },
  { id: 'wikilink', label: '[[w]]', before: '[[', after: ']]' },
];

export function applyWrapPreset(spec: FindSpec, preset: WrapPreset): FindSpec {
  return {
    ...spec,
    search: spec.regexp ? spec.search : escapeRegExp(spec.search),
    regexp: true,
    skipCode: true,
    replace: `${preset.before}${WHOLE_MATCH}${preset.after}`,
  };
}
