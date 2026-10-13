import { test, MOD } from '../kit/fixtures';
import { MapUi } from '../kit/mindmap';
import { doc } from '../kit/seed';

const PASTED_OUTLINE = ['- ערוצי מכירה', '  - אונליין', '  - חנויות', '  - B2B'].join('\n');
const NOTE_TEXT = '**חשוב:** לסיים את הבדיקות עד יום חמישי';

test('Mind maps — power moves', async ({ demo }) => {
  const { page, director } = demo;
  await demo.open([doc('השקה.mmap', { lens: 'map' })], { viewMode: 'liveEdit' });
  const map = new MapUi(page);
  await map.waitForCanvas();

  await director.title('Mind map power moves', 'Freeze strip · pin root · details · collapse · paste');

  await director.step('The freeze strip keeps the root and main branches in view', async (c) => {
    await c.hover(map.strip);
  });

  await director.step('Click a branch in the strip to focus on it', async (c) => {
    await c.click(map.stripChip('פיתוח'));
  });

  await director.step('⌥-click pins a node as the strip root — at any depth', async (c) => {
    await c.click(map.stripChip('פיתוח'), { modifiers: ['Alt'] });
    await director.pause();
    await c.click(map.stripChip('בדיקות איכות'), { modifiers: ['Alt'] });
  });

  await director.step('Ancestors stay one click away — back to the whole map', async (c) => {
    await c.click(map.ancestor('השקת מוצר'));
    await c.click(map.stripRoot);
  });

  await director.step('Node details: a live Markdown note and custom fields', async (c) => {
    await c.click(map.node('פיתוח'));
    await c.press(`${MOD}+Alt+D`);
    await c.click(map.details.locator('.mm-details__note'));
    await c.press(`${MOD}+End`);
    await c.press('Enter');
    await c.type(NOTE_TEXT);
    await c.click(map.details.getByRole('button', { name: '+ Field' }));
    await c.click(map.details.getByPlaceholder('key').last());
    await c.type('אחראית');
    await c.click(map.details.getByPlaceholder('value').last());
    await c.type('נועה');
  });

  await director.step('Space collapses the selection — and expands it back', async (c) => {
    await c.click(map.details.locator('button.mm-details__close'));
    await c.click(map.node('פיתוח'));
    await c.press('Space');
    await director.pause();
    await director.snapshot();
    await c.press('Space');
  });

  await director.step('Paste a Markdown outline straight in as a subtree', async (c) => {
    await c.click(map.node('מכירות'));
    await c.paste(PASTED_OUTLINE, MapUi.CONTAINER);
  });

  await director.end('solomd-rtl', 'Mind maps, Hebrew-first · github.com/ofekisr/solomd-rtl');
});
