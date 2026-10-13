import { test } from '../kit/fixtures';
import { MapUi } from '../kit/mindmap';
import { runCommand } from '../kit/palette';
import { doc } from '../kit/seed';

test('Highlights', async ({ demo }) => {
  const { page, director } = demo;
  await demo.open(
    [doc('מדריך.md'), doc('תוכנית.md'), doc('השקה.mmap', { lens: 'map' })],
    { viewMode: 'split' },
  );
  const map = new MapUi(page);
  const editor = page.locator('.cm-content').first();
  const tab = (name: string) => page.locator('.tab', { hasText: name }).first();

  await director.title('solomd-rtl in 30 seconds', 'Hebrew-first Markdown · diagrams · mind maps');

  await director.step('Hebrew documents open right-to-left, automatically', async (c) => {
    await c.click(tab('מדריך.md'));
    await c.hover(editor);
  });

  await director.step('Mermaid diagrams and live mind maps, right inside Markdown', async (c) => {
    await c.click(tab('תוכנית.md'));
    await c.hover(page.locator('.preview-content svg').first());
    await c.hover(page.locator('.preview-content [class*="mindmap"]').last());
  });

  await director.step('Command palette → Convert Document to Map', async (c) => {
    await c.click(editor.locator('.cm-line', { hasText: 'מפת יעדים' }));
    await runCommand(page, c, 'convert document to map');
    await map.waitForCanvas();
  });

  await director.step('Headings become branches — the whole outline as a map', async (c) => {
    await c.click(map.dockButton('Fit to window'));
  });

  await director.step('Freeze strip: ⌥-click pins any node as the root', async (c) => {
    await c.click(tab('השקה.mmap'));
    await map.waitForCanvas();
    await c.click(map.stripChip('פיתוח'), { modifiers: ['Alt'] });
    await c.click(map.stripChip('בדיקות איכות'), { modifiers: ['Alt'] });
  });

  await director.end('solomd-rtl', 'Hebrew-first Markdown · github.com/ofekisr/solomd-rtl');
});
