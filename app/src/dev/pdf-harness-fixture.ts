import type { ResolvedPdfOptions } from '../lib/pdf-options.ts';

/** A4 with the app's default 10mm side / 10+12mm vertical margins. */
export const PDF_OPTS: ResolvedPdfOptions = {
  pageSizeMm: { width: 210, height: 297 },
  pageSizeLabel: 'A4',
  marginMm: { top: 10, right: 10, bottom: 12, left: 10 },
  fontFamily: '',
  fontSizePt: 11,
  footer: false,
  codeTheme: 'preview',
  toc: false,
};

/**
 * A document that stays just as hostile to fixed-height slicing as the ones
 * users reported: long CJK prose with inline code, list items that run across
 * the boundary, a code block and a table.
 */
export function fixture(repeats: number): string {
  const blocks: string[] = ['# Settlement reconciliation\n'];
  for (let i = 1; i <= repeats; i++) {
    blocks.push(`
## ${i}. Channel ledger and bank deposits

The trial balance matches the two ledger lines of a single transaction side by side; "accrued" comes from the channel, "received" from the bank statement.
The following are the most common causes of differences, and each one must be traceable to the original ledger line:

- A Stripe ledger line with \`currency=CNY\` whose amount subject is \`requires_payment_method\` (payment not yet completed)
  is not counted as revenue; such lines usually stay in that \`status\` for no more than 24 hours.
- When the bank deposit date and Stripe's \`created\` time are one calendar day apart, the period is attributed to the next day;
  this is an accounting-period difference, not a booking error, and a reversal would only make the books messier.
- Fees are deducted on the channel side first and deposited net on the bank side, so the two never agree on gross, only on net.

> Note: after a \`payout\` arrives, it takes T+1 to appear in the bank ledger, so the ledger lines of the
> last two days of the month need an observation window, otherwise they are misjudged as missing.

\`\`\`ts
export function reconcile(rows: Row[]): Row[] {
  return rows.filter((row) => row.status === 'settled' && row.currency === 'CNY');
}
\`\`\`

| Field | Meaning | Note |
| --- | --- | --- |
| \`amount\` | In the smallest currency unit | CNY uses fen |
| \`fee\` | Channel fee | Tax included, excluded from revenue share |
| \`status\` | Channel status | Not the same source as the bank status |

Body paragraph that pushes the layout onto the next page: ${'This paragraph is filler text that repeats to make the document run across several pages. '.repeat(4)}
`);
  }
  // A single unbroken paragraph longer than a page. The pagebreak plugin's
  // `avoid` list can do nothing here — the block cannot be pushed to a page it
  // would fit in — so the boundary lands wherever the fixed grid puts it, which
  // is exactly where the old export sheared a line in half.
  blocks.push(`
## Appendix: a long body with no blank lines

${'Every reconciled figure must be traceable line by line; any difference that cannot be tied to an original ledger line is booked separately with the reason stated. '.repeat(90)}
`);
  return blocks.join('\n');
}


export interface HarnessConfig {
  label: string;
  opts: ResolvedPdfOptions;
  /** How many fixture blocks to render — drives how many pages we get. */
  blocks: number;
}

const A4 = { width: 210, height: 297 };
const A5 = { width: 148, height: 210 };

function preset(
  label: string,
  pageSizeLabel: string,
  size: { width: number; height: number },
  mm: number,
  blocks: number,
): HarnessConfig {
  return {
    label,
    blocks,
    opts: {
      pageSizeMm: size,
      pageSizeLabel,
      marginMm: { top: mm, right: mm, bottom: mm + 2, left: mm },
      fontFamily: '',
      fontSizePt: 11,
      footer: false,
      codeTheme: 'preview',
      toc: false,
    },
  };
}

/**
 * The page setups worth checking: default, a narrow printable width, a small page.
 *
 * The first one is long enough for the drift between jsPDF's raster-page grid
 * and the CSS-pixel grid the pagebreak plugin pads with to add up past a line's
 * leading — that is where the old export starts shearing lines in a document.
 */
export const CONFIGS: HarnessConfig[] = [
  preset('A4 · 10mm margins', 'A4', A4, 10, 9),
  preset('A4 · 25mm margins', 'A4', A4, 25, 9),
  preset('A5 · 15mm margins', 'A5', A5, 15, 9),
];
