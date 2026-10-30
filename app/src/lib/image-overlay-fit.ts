export const FIT_PADDING = 80;

const MAX_UPSCALE = 2;

export interface DisplaySize {
  width: number;
  height: number;
}

export function fitDisplaySize(natW: number, natH: number, rectW: number, rectH: number): DisplaySize {
  const availW = rectW - FIT_PADDING;
  const availH = rectH - FIT_PADDING;
  if (natW <= 0 || natH <= 0) return { width: availW, height: availH };
  const fitScale = Math.min(availW / natW, availH / natH);
  const finalScale = Math.min(fitScale, MAX_UPSCALE);
  return { width: natW * finalScale, height: natH * finalScale };
}

/** Natural content size. Side effect: SVG fixed width/height are removed so
 *  viewBox + CSS sizing take over. */
export function naturalSizeOf(child: HTMLElement): { width: number; height: number } {
  let natW = 0;
  let natH = 0;

  if (child instanceof SVGElement) {
    const vb = child.getAttribute('viewBox');
    if (vb) {
      const parts = vb.split(/[\s,]+/).map(Number);
      if (parts.length === 4) {
        natW = parts[2];
        natH = parts[3];
      }
    }
    if (!natW) {
      const wAttr = child.getAttribute('width');
      const hAttr = child.getAttribute('height');
      if (wAttr && hAttr) {
        natW = parseFloat(wAttr);
        natH = parseFloat(hAttr);
      }
    }
    if (!natW) {
      const bbox = (child as unknown as SVGSVGElement).getBBox();
      natW = bbox.width;
      natH = bbox.height;
    }
    // SVG: remove fixed attributes, rely on viewBox + CSS sizing
    child.removeAttribute('width');
    child.removeAttribute('height');
  } else if (child instanceof HTMLImageElement) {
    natW = child.naturalWidth || child.width;
    natH = child.naturalHeight || child.height;
  } else {
    natW = child.offsetWidth;
    natH = child.offsetHeight;
  }

  return { width: natW, height: natH };
}
