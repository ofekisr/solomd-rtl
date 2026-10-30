import {
  ExternalHyperlink,
  ShadingType,
  TextRun,
  type IRunOptions,
} from 'docx';
import type Token from 'markdown-it/lib/token.mjs';
import { md } from './markdown.ts';

export interface RunStyle {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
  link?: string;
}

export function buildRuns(inlineToken: Token, style: RunStyle = {}): (TextRun | ExternalHyperlink)[] {
  const out: (TextRun | ExternalHyperlink)[] = [];
  if (!inlineToken.children) {
    if (inlineToken.content) {
      out.push(new TextRun({ text: inlineToken.content, ...toRunOpts(style) }));
    }
    return out;
  }

  const stack: RunStyle[] = [{ ...style }];
  let pendingLink: { href: string; runs: (TextRun | ExternalHyperlink)[] } | null = null;

  const push = (run: TextRun) => {
    if (pendingLink) {
      pendingLink.runs.push(run);
    } else {
      out.push(run);
    }
  };

  for (const tok of inlineToken.children) {
    const cur = { ...stack[stack.length - 1] };
    switch (tok.type) {
      case 'text':
        if (tok.content) push(new TextRun({ text: tok.content, ...toRunOpts(cur) }));
        break;
      case 'softbreak':
        // #141 — DOCX builds from tokens, so markdown-it's `breaks` renderer
        // option doesn't apply here; honor it manually to match the preview
        // (hard breaks on → single newline is a real line break).
        if (md.options.breaks) {
          push(new TextRun({ text: '', break: 1, ...toRunOpts(cur) }));
        } else {
          push(new TextRun({ text: ' ', ...toRunOpts(cur) }));
        }
        break;
      case 'hardbreak':
        push(new TextRun({ text: '', break: 1, ...toRunOpts(cur) }));
        break;
      case 'strong_open':
        stack.push({ ...cur, bold: true });
        break;
      case 'strong_close':
        stack.pop();
        break;
      case 'em_open':
        stack.push({ ...cur, italic: true });
        break;
      case 'em_close':
        stack.pop();
        break;
      case 's_open':
        stack.push({ ...cur, strike: true });
        break;
      case 's_close':
        stack.pop();
        break;
      case 'code_inline':
        push(new TextRun({ text: tok.content, ...toRunOpts({ ...cur, code: true }) }));
        break;
      case 'link_open': {
        const href = tok.attrGet('href') ?? '';
        pendingLink = { href, runs: [] };
        break;
      }
      case 'link_close':
        if (pendingLink) {
          out.push(
            new ExternalHyperlink({
              link: pendingLink.href,
              children: pendingLink.runs as TextRun[],
            })
          );
          pendingLink = null;
        }
        break;
      case 'image':
        // Images are handled at the block level (see buildBody), but if an
        // image appears inline we emit a placeholder.
        push(new TextRun({ text: `[${tok.content || 'image'}]`, italics: true, color: '888888' }));
        break;
      default:
        if (tok.content) push(new TextRun({ text: tok.content, ...toRunOpts(cur) }));
    }
  }
  return out;
}

function toRunOpts(s: RunStyle): IRunOptions {
  const opts: { -readonly [K in keyof IRunOptions]: IRunOptions[K] } = {};
  if (s.bold) opts.bold = true;
  if (s.italic) opts.italics = true;
  if (s.strike) opts.strike = true;
  if (s.code) {
    opts.font = 'JetBrains Mono';
    opts.color = '8A4A00';
    opts.shading = { type: ShadingType.SOLID, color: 'F3EFE7', fill: 'F3EFE7' };
  }
  return opts;
}
