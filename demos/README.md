# Demo videos

Captioned showcase videos of solomd-rtl features, recorded by Playwright against the web build.

| Story | Shows |
| --- | --- |
| `highlights` | ~30 s reel of the strongest features — the only story rendered as mp4 **and** gif |
| `00-intro` | English baseline file: "From SoloMD… to solomd-rtl" |
| `01-rtl-hebrew` | Whole-file RTL detection, caret/gutter, mixed Hebrew + English, LTR code, split, reading, LTR English file |
| `02-folders-code` | Open Folder, file tree, highlighting for Python/`.pyj`/TypeScript/shell and Markdown fences, `*.full.md` numbered blocks, EPUB directive completions |
| `03-mindmap-new` | New `.mmap` from the explorer, keyboard-only building (Tab/Enter), Markdown + Mermaid snippets inside the map |
| `04-mindmap-basics` | `.mmap` canvas, Tab to add, raw JSON (Data lens), Markdown outline (Doc lens), focus mode, themes, export menu |
| `05-mindmap-power` | Freeze strip, focus, ⌥-click pin root, details pane note + fields, Space collapse, paste outline |
| `06-md-to-mindmap` | Mermaid + live mind map fence inside Markdown, Convert Document to Map, Insert Map Fence from Section |
| `07-xmind-markdown` | Open a `.xmind` from the folder, edit, export as Markdown, open the RTL outline |
| `08-mindmap-gates` | Gate nodes: mark target, insert gate, live label on rename, ⌥↵ follow / ⌥← back, merge duplicate into gate, graph view dashed links |

## Record

```bash
pnpm --dir demos install
```

```bash
pnpm --dir demos demo all
```

- One story: `pnpm --dir demos demo 03`
- Output: `demos/out/<story>.mp4` (1280×720, H.264). `all` records every numbered story and joins them into `out/solomd-rtl-demo.mp4`. `pnpm --dir demos demo highlights` writes `highlights.mp4` + `highlights.gif`. `out/` is gitignored.
- Every click, key and typed text shows an on-screen badge; the first use of each action is held longer.
- Playback speed: `DEMO_SPEED=1.5 pnpm --dir demos demo all` (default 1.5×, applied at encode).
- Pacing while recording: `DEMO_TEMPO=0.7` (1 = default; lower is faster).
- Review without watching: `DEMO_SHOTS=1 DEMO_TEMPO=0.3 pnpm --dir demos exec playwright test` saves one frame per step to `out/shots/`.
- Needs `ffmpeg` (`brew install ffmpeg`). Port 1440 must be free; your own dev server on 1420 is untouched.

## How it works

- `kit/seed.ts` writes tabs and settings into `localStorage` before the app boots, so no app code changes and no first-run dialogs.
- `kit/tauri-mock.ts` stands in for the desktop backend (Open Folder, file tree, `read_file`/`read_binary_file`, save dialog + `write_file`, directive manifests) and serves `content/vault/` as `/Users/demo/פרויקט`.
- `kit/overlay.ts` injects the caption bar, title/end cards and a drawn cursor (`pointer-events: none`).
- `kit/director.ts` runs `title → step(caption, action) → end`. `kit/cursor.ts` glides the real mouse and the drawn cursor together.
- `record.mjs` runs each story and trims the app boot. It writes a video only when the story passes.

## Write a story

```ts
import { test } from '../kit/fixtures';
import { doc } from '../kit/seed';

test('My feature', async ({ demo }) => {
  await demo.open([doc('מדריך.md')], { viewMode: 'split' });
  await demo.director.title('My feature', 'one-line subtitle');
  await demo.director.step('What the viewer should notice', async (c) => {
    await c.click(demo.page.getByRole('button', { name: 'Fit to window' }));
  });
  await demo.director.end('solomd-rtl', 'github.com/ofekisr/solomd-rtl');
});
```

- Put sample files in `content/` (Hebrew first). Name the story `NN-name.story.ts`.
- Headless Chromium ignores OS paste: use `c.paste(text, selector)`.
- Keep targets inside the 1280×720 frame. A long context menu can run off-screen.
