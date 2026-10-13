import { test, MOD } from '../kit/fixtures';
import { doc } from '../kit/seed';

const NEW_LINE_TEXT = 'שורה חדשה עם מילה באנגלית: SoloMD כותב מימין לשמאל.';

test('Hebrew, right to left', async ({ demo }) => {
  const { page, director } = demo;
  await demo.open([doc('מדריך.md'), doc('Notes.md')], { viewMode: 'edit' });
  const editor = page.locator('.cm-content').first();
  const viewButton = (title: string) => page.locator(`.toolbar__group button[title^="${title}"]`);

  await director.title('Hebrew, right to left', 'solomd-rtl · whole-file RTL for Hebrew and Arabic');

  await director.step('Hebrew files open right-to-left automatically — no setting to flip', async (c) => {
    await c.hover(page.locator('.cm-line').first());
  });

  await director.step('Caret, gutter and lists sit on the right side', async (c) => {
    await c.click(editor.locator('.cm-line', { hasText: 'משתלבות בתוך המשפט' }));
    await c.press('End');
  });

  await director.step('Type Hebrew with English words mixed in — lists continue on the right', async (c) => {
    await c.press('Enter');
    await c.type(NEW_LINE_TEXT);
  });

  await director.step('Code blocks stay left-to-right inside an RTL document', async (c) => {
    await c.hover(editor.locator('.cm-line', { hasText: 'const greeting' }));
  });

  await director.step('Split view: the preview follows the same direction', async (c) => {
    await c.click(viewButton('Split'));
  });

  await director.step('Reading mode — full-bleed, still right-to-left', async (c) => {
    await c.click(viewButton('Reading mode'));
  });

  await director.step('English files stay left-to-right — detection is per file', async (c) => {
    await c.press(`${MOD}+Shift+R`);
    await c.click(page.locator('.tab', { hasText: 'Notes.md' }).first());
  });

  await director.end('solomd-rtl', 'Hebrew-first Markdown · github.com/ofekisr/solomd-rtl');
});
