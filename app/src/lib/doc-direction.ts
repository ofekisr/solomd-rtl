export type TextDirection = 'rtl' | 'ltr';

const FENCED_CODE_RE = /^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm;
const RTL_LETTER_RE = /[\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Syriac}\p{Script=Thaana}]/gu;
const ANY_LETTER_RE = /\p{L}/gu;

function countMatches(text: string, re: RegExp): number {
  return text.match(re)?.length ?? 0;
}

// Whole-file direction: a document whose prose is mostly Hebrew / Arabic
// letters reads right-to-left end to end, English lines included. Code fences
// are ignored — they are LTR regardless and would outvote short RTL notes.
export function documentDirection(source: string): TextDirection {
  const prose = source.replace(FENCED_CODE_RE, '');
  const rtl = countMatches(prose, RTL_LETTER_RE);
  const ltr = countMatches(prose, ANY_LETTER_RE) - rtl;
  return rtl > ltr ? 'rtl' : 'ltr';
}
