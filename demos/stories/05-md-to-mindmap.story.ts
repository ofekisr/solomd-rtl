import { test } from '../kit/fixtures';
import { MapUi } from '../kit/mindmap';
import { runCommand } from '../kit/palette';
import { doc } from '../kit/seed';

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
    await runCommand(page, c, 'convert document to map');
    await map.waitForCanvas();
  });

  await director.step('Headings become branches, bullets become leaves', async (c) => {
    await c.click(map.dockButton('Fit to window'));
  });

  await director.step('Or embed a live map of one section inside the document', async (c) => {
    await c.click(page.locator('.tab', { hasText: 'תוכנית.md' }).first());
    await c.click(editor.locator('.cm-line', { hasText: 'צוותים' }));
    await runCommand(page, c, 'insert map fence from section');
  });

  await director.step('The fence renders as a map in the preview', async (c) => {
    await c.hover(page.locator('.preview-content .mindmap, .preview-content [class*="mindmap"]').first());
  });

  await director.end('solomd-rtl', 'Markdown ⇄ mind maps · github.com/ofekisr/solomd-rtl');
});
