import { test, MOD, type Demo } from '../kit/fixtures';
import { MapUi } from '../kit/mindmap';
import { doc } from '../kit/seed';
import type { DemoCursor } from '../kit/cursor';

async function runCommand(demo: Demo, c: DemoCursor, query: string): Promise<void> {
  await c.press(`${MOD}+Shift+K`);
  await demo.page.locator('input.palette__input').waitFor();
  await c.type(query);
  await demo.director.pause();
  await c.press('Enter');
}

test('Markdown to mind map', async ({ demo }) => {
  const { page, director } = demo;
  await demo.open([doc('תוכנית.md')], { viewMode: 'split' });
  const map = new MapUi(page);
  const editor = page.locator('.cm-content').first();

  await director.title('Markdown → mind map', 'Turn any outline into a map or a live map fence');

  await director.step('Start from any Markdown document', async (c) => {
    await c.hover(editor.locator('.cm-line', { hasText: 'תוכנית רבעונית' }));
  });

  await director.step('Command palette → Convert Document to Map', async (c) => {
    await runCommand(demo, c, 'convert document to map');
    await map.waitForCanvas();
  });

  await director.step('Headings become branches, bullets become leaves', async (c) => {
    await c.click(map.dockButton('Fit to window'));
  });

  await director.step('Or embed a live map of one section inside the document', async (c) => {
    await c.click(page.locator('.tab', { hasText: 'תוכנית.md' }).first());
    await c.click(editor.locator('.cm-line', { hasText: 'צוותים' }));
    await runCommand(demo, c, 'insert map fence from section');
  });

  await director.step('The fence renders as a map in the preview', async (c) => {
    await c.hover(page.locator('.preview-content .mindmap, .preview-content [class*="mindmap"]').first());
  });

  await director.end('solomd-rtl', 'Markdown ⇄ mind maps · github.com/ofekisr/solomd-rtl');
});
