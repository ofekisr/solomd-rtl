import { isCleanRowData } from '../lib/pdf/paginate.ts';

/** Height of the strip drawn around each page break, in raster pixels. */
export const STRIP = 90;

export const ctx2d = (canvas: HTMLCanvasElement): CanvasRenderingContext2D => canvas.getContext('2d')!;

/**
 * Whether row `y` carries *text* ink: a pixel darker than any background,
 * border or rule the export draws (the lightest text colour is the quote grey
 * #6a6560). Not "any non-uniform row" — a table's column borders make every
 * row inside a table non-uniform, and a cut between two table rows would then
 * read as a shear although no glyph is touched (#337).
 */
export function rowHasInk(canvas: HTMLCanvasElement, y: number): boolean {
  if (y < 0 || y >= canvas.height) return false;
  const d = ctx2d(canvas).getImageData(0, y, canvas.width, 1).data;
  for (let i = 0; i < d.length; i += 4) {
    if (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < 140) return true;
  }
  return false;
}

/** A boundary is sheared when ink sits on both sides of it — a sliced glyph. */
export function isSheared(canvas: HTMLCanvasElement, y: number): boolean {
  return rowHasInk(canvas, y - 1) && rowHasInk(canvas, y);
}


export interface BoundaryCheck {
  /** jsPDF's own boundary, in raster rows. */
  nominal: number;
  /** Where the export cuts instead. */
  cut: number;
  /** Rows given up to reach a line with no ink. */
  moved: number;
  /**
   * Measured on the raster the receiving side actually gets: the raw raster for
   * jsPDF's boundaries, the re-paginated one for ours.
   */
  sheared: boolean;
  /** Blank rows directly above the boundary — a page-break pad leaves many. */
  blankAbove: number;
  /** Blank rows directly below it. */
  blankBelow: number;
}

export function px(value: number): string {
  return `${value}px (${((value / 96) * 25.4).toFixed(1)}mm)`;
}

/** Consecutive rows with no ink, walking `step` away from `from`. */
export function blankRun(canvas: HTMLCanvasElement, from: number, step: 1 | -1): number {
  let count = 0;
  for (let y = from; y >= 0 && y < canvas.height; y += step) {
    if (rowHasInk(canvas, y)) break;
    count++;
  }
  return count;
}

/**
 * Rows whose last two pixel columns carry ink: content that ran into the edge
 * of the raster. The page column is pinned to the printable width, so this
 * means the layout was wider than the paper and got clipped.
 */
export function rowsTouchingRightEdge(canvas: HTMLCanvasElement): number {
  const ctx = ctx2d(canvas);
  const row = ctx.getImageData(canvas.width - 2, 0, 2, canvas.height).data;
  let rows = 0;
  for (let y = 0; y < canvas.height; y++) {
    if (!isCleanRowData(row.subarray(y * 8, y * 8 + 8))) rows++;
  }
  return rows;
}

/**
 * A strip of the page break around `y`, drawn at 2x with a hairline on the
 * boundary row, so a sheared glyph is obvious at a glance.
 */
export function strip(
  canvas: HTMLCanvasElement,
  y: number,
  boundary: number,
  label: string,
): HTMLCanvasElement {
  const zoom = 2;
  const top = Math.max(0, y - STRIP);
  const rows = Math.min(canvas.height, y + STRIP) - top;
  const out = document.createElement('canvas');
  out.width = canvas.width * zoom;
  out.height = rows * zoom + 22;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#fbfaf6';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, 0, top, canvas.width, rows, 0, 22, out.width, rows * zoom);
  ctx.fillStyle = '#1f1d1a';
  ctx.font = '14px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillText(label, 8, 16);
  ctx.fillStyle = 'rgba(192, 43, 43, 0.9)';
  ctx.fillRect(0, (boundary - top) * zoom + 22, out.width, 1);
  return out;
}

export function table(rows: BoundaryCheck[]): string {
  const body = rows
    .map(
      (r) =>
        `<tr><td>${px(r.nominal)}</td><td>${px(r.cut)}</td><td>${r.moved}px</td>` +
        `<td>${r.blankAbove} / ${r.blankBelow}</td><td class="${r.sheared ? 'bad' : 'ok'}">${
          r.sheared ? 'YES — a line of text is cut in half' : 'no'
        }</td></tr>`,
    )
    .join('');
  return (
    '<table><thead><tr><th>boundary</th><th>cut at</th><th>given up</th>' +
    '<th>blank above / below</th><th>sheared?</th></tr></thead>' +
    `<tbody>${body}</tbody></table>`
  );
}

/** Page count of a single-page-image PDF, straight out of the byte stream. */
export async function countPdfPages(blob: Blob): Promise<number> {
  const text = new TextDecoder('latin1').decode(new Uint8Array(await blob.arrayBuffer()));
  return (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}
