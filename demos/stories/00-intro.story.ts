import { test } from '../kit/fixtures';
import { doc } from '../kit/seed';

test('From SoloMD to solomd-rtl', async ({ demo }) => {
  const { page, director } = demo;
  await demo.open([doc('Welcome.md')], { viewMode: 'split' });
  const editor = page.locator('.cm-content').first();

  await director.title('From SoloMD…', 'The editor where agents live — a local-first Markdown editor and the bridge to your LLM');

  await director.step('The baseline: SoloMD — English Markdown, editor and live preview side by side', async (c) => {
    await c.hover(editor.locator('.cm-line', { hasText: 'Welcome to SoloMD' }));
  });

  await director.step('Everything reads left-to-right', async (c) => {
    await c.hover(page.locator('.preview-content table').first());
  });

  await director.title('…to solomd-rtl', 'Hebrew-first: right-to-left writing · folders, code and books · mind maps · XMind ⇄ Markdown');
});
