/**
 * terminal-block.ts — ```terminal / ```console / ```shell-session fences.
 *
 * A ```bash fence shows a script. A terminal fence shows a *session*: lines
 * that start with a prompt (`$ `, `% `, `# `, `❯ `, `user@host:~$ `,
 * `PS C:\> `) are commands, everything else is the output they printed.
 * The preview renders it as a terminal window — prompt dimmed, command
 * highlighted as shell, output plain — and the copy button copies only the
 * commands, so the block can be pasted straight back into a shell.
 *
 * A command ending in `\` continues on the next line, like a real shell.
 * The rest of the info string becomes the window title:
 * ```terminal deploy to staging
 */

export const TERMINAL_LANGS: ReadonlySet<string> = new Set(['terminal', 'console', 'shell-session']);

const DEFAULT_TITLE = 'Terminal';
export const CONTINUATION_RE = /\\\s*$/;
const PROMPT_SOURCE = String.raw`((?:[\w.-]+@[\w.-]+(?::\S*)?\s?)?[$%#❯➜]|PS(?: [^>\n]*)?>)(\s|$)`;
/** Just the prompt (and the space after it), for the code editor's stream mode. */
export const PROMPT_HEAD_RE = new RegExp(`^${PROMPT_SOURCE}`);
const PROMPT_RE = new RegExp(`^${PROMPT_SOURCE}(.*)$`);

export type TerminalLine =
  | { kind: 'command'; prompt: string; text: string }
  | { kind: 'continuation'; text: string }
  | { kind: 'output'; text: string };

export interface TerminalRenderOptions {
  title?: string;
  highlight?: (command: string) => string;
  attrs?: string;
}

export function isTerminalLang(lang: string): boolean {
  return TERMINAL_LANGS.has(lang.toLowerCase());
}

export function parseTerminalSession(code: string): TerminalLine[] {
  const lines = code.replace(/\n$/, '').split('\n');
  const parsed: TerminalLine[] = [];
  let isContinuing = false;
  for (const line of lines) {
    if (isContinuing) {
      parsed.push({ kind: 'continuation', text: line });
      isContinuing = CONTINUATION_RE.test(line);
      continue;
    }
    const m = PROMPT_RE.exec(line);
    if (!m) {
      parsed.push({ kind: 'output', text: line });
      continue;
    }
    parsed.push({ kind: 'command', prompt: m[1] + m[2], text: m[3] });
    isContinuing = CONTINUATION_RE.test(m[3]);
  }
  return parsed;
}

export function terminalCommands(code: string): string {
  return parseTerminalSession(code)
    .filter((line) => line.kind !== 'output')
    .map((line) => line.text)
    .join('\n');
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderLine(line: TerminalLine, highlight: (command: string) => string): string {
  if (line.kind === 'output') {
    return `<span class="term-line term-out">${escapeHtml(line.text) || ' '}</span>`;
  }
  const prompt = line.kind === 'command'
    ? `<span class="term-prompt" aria-hidden="true">${escapeHtml(line.prompt)}</span>`
    : '';
  return `<span class="term-line term-cmd">${prompt}<span class="term-input">${highlight(line.text)}</span></span>`;
}

export function renderTerminalBlock(code: string, options: TerminalRenderOptions = {}): string {
  const highlight = options.highlight ?? escapeHtml;
  const title = escapeHtml(options.title?.trim() || DEFAULT_TITLE);
  const body = parseTerminalSession(code).map((line) => renderLine(line, highlight)).join('\n');
  return (
    `<div class="terminal-block"${options.attrs ?? ''}>` +
    `<div class="terminal-bar" aria-hidden="true"><span class="terminal-dots"><i></i><i></i><i></i></span>` +
    `<span class="terminal-title">${title}</span></div>` +
    `<pre class="terminal-body" dir="ltr"><code class="language-terminal">${body}</code></pre>` +
    `</div>\n`
  );
}

/** Self-contained terminal styling for HTML / image exports, which do not load main.css. */
export function terminalExportCss(scope = ''): string {
  const s = scope ? `${scope} ` : '';
  return `
  ${s}.terminal-block { margin: 1.2em 0; border-radius: 8px; overflow: hidden; background: #16181d; direction: ltr; text-align: left; }
  ${s}.terminal-bar { display: flex; align-items: center; gap: 10px; height: 28px; padding: 0 12px; background: #24272e; }
  ${s}.terminal-dots { display: inline-flex; gap: 6px; }
  ${s}.terminal-dots i { width: 11px; height: 11px; border-radius: 50%; background: #ff5f57; }
  ${s}.terminal-dots i:nth-child(2) { background: #febc2e; }
  ${s}.terminal-dots i:nth-child(3) { background: #28c840; }
  ${s}.terminal-title { flex: 1; margin-right: 50px; color: #a9b1bd; font: 12px/1 sans-serif; text-align: center; }
  ${s}.terminal-block pre.terminal-body { margin: 0; padding: 12px 16px; border: 0; border-radius: 0; background: #16181d; }
  ${s}.terminal-block pre.terminal-body code { color: #e6e6e6; }
  ${s}.terminal-block .term-prompt { color: #5fd38d; font-weight: 600; }
  ${s}.terminal-block .term-out { color: #a9b1bd; }
  ${s}.terminal-block .hljs-keyword, ${s}.terminal-block .hljs-built_in { color: #c792ea; }
  ${s}.terminal-block .hljs-string { color: #c3e88d; }
  ${s}.terminal-block .hljs-variable { color: #f07178; }
  ${s}.terminal-block .hljs-comment { color: #6b7280; }
`;
}
