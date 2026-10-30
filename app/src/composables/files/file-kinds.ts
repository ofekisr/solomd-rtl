import { MINDMAP_EXTENSIONS } from '../../lib/mindmap/format';


// Extensions that the built-in converter handles (Rust, no Python).
export const CONVERT_BUILTIN = new Set(['docx', 'csv', 'xlsx', 'xls', 'html', 'htm']);

// Extensions that need markitdown CLI (Python).
// #98 — image extensions were removed from here: clicking an image in the
// FileTree used to run it through the markitdown OCR converter (which fails
// and toasts an error). Images now open in the fullscreen viewer instead.
export const CONVERT_CLI = new Set([
  'pdf', 'pptx', 'epub',
  'mp3', 'wav', 'm4a', 'ogg', 'flac',
]);

// #98 — image files open in the fullscreen image overlay (same viewer the
// preview pane uses), not the document converter.
export const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']);

// Text / code files SoloMD opens natively as an editor tab. A Markdown link
// to one of these always opens in-app, regardless of the
// `openLinkedFilesExternally` setting (that setting only diverts non-text
// documents like PDF / Office / audio to the OS default app). `md` is here
// too so `[note](./other.md)` never leaves the editor.
export const TEXT_LINK_EXTENSIONS = new Set([
  'md', 'markdown', 'mdx', 'txt', 'text', 'log', 'rst', 'tex', 'org',
  'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'json', 'jsonc', 'yaml', 'yml',
  'toml', 'ini', 'conf', 'cfg', 'env', 'xml', 'css', 'scss', 'sass', 'less',
  'vue', 'svelte', 'astro', 'py', 'rb', 'php', 'go', 'rs', 'java', 'kt',
  'swift', 'c', 'h', 'cpp', 'hpp', 'cc', 'cs', 'sh', 'bash', 'zsh', 'fish',
  'pl', 'lua', 'r', 'sql', 'graphql', 'proto', 'gradle', 'properties',
  ...MINDMAP_EXTENSIONS,
]);


export function fileExtension(path: string): string {
  return (path.split('.').pop() || '').toLowerCase();
}
