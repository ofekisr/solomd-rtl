import { test } from '../kit/fixtures';
import { MapUi } from '../kit/mindmap';
import { runCommand } from '../kit/palette';
import { doc } from '../kit/seed';

// Directed by the marketing brief: one Hebrew thread — write → diagram → map → back to Markdown.
const TYPED_LINE = 'פגישת צוות עם Claude Code ביום ראשון';
const PASTED_OUTLINE = ['- עיצוב', '  - מערכת עיצוב', '  - נגישות'].join('\n');

test('Write Hebrew. Think in maps.', async ({ demo }) => {
  const { page, director } = demo;
  await demo.open([doc('Notes.md'), doc('מדריך.md'), doc('תוכנית.md')], { viewMode: 'edit', rightSidebarHidden: true });
  const map = new MapUi(page);
  const editor = page.locator('.cm-content').first();
  const tab = (name: string) => page.locator('.tab', { hasText: name }).first();
  const viewButton = (title: string) => page.locator(`.toolbar__group button[title^="${title}"]`);

  await director.title('Write Hebrew. Think in maps.', 'solomd-rtl — the Markdown editor that gets right-to-left right');

  await director.step('English stays left-to-right. Hebrew flips — automatically.', async (c) => {
    await c.click(tab('מדריך.md'));
  });

  await director.step('Type Hebrew, mix in English — it stays readable.', async (c) => {
    await c.click(editor.locator('.cm-line', { hasText: 'משתלבות בתוך המשפט' }));
    await c.press('End');
    await c.press('Enter');
    await c.type(TYPED_LINE);
  });

  await director.step('The preview follows. Code blocks stay left-to-right.', async (c) => {
    await c.click(viewButton('Split'));
  });

  await director.step('Diagrams and mind maps live inside your Markdown.', async (c) => {
    await c.click(tab('תוכנית.md'));
    await c.click(editor.locator('.cm-line', { hasText: /^\s*- אפליקציה למובייל$/ }));
    await c.press('End');
    await c.press('Enter');
    await c.type('שביעות רצון');
    await director.pause();
    await c.hover(page.locator('.preview-content [class*="mindmap"]').last());
  });

  await director.step('One command turns the whole document into a mind map.', async (c) => {
    await runCommand(page, c, 'convert document to map');
    await map.waitForCanvas();
    await c.click(map.dockButton('Fit to window'));
  });

  await director.step('Keep thinking from the keyboard — Tab adds a child.', async (c) => {
    await c.click(map.node('מטרות'));
    await c.press('Tab');
    await c.type('קהילה');
    await c.press('Enter');
  });

  await director.step('Paste an outline from your notes or AI chat — instant branches.', async (c) => {
    await c.click(map.node('צוותים'));
    await c.paste(PASTED_OUTLINE, MapUi.CONTAINER);
    await c.click(map.dockButton('Fit to window'));
  });

  await director.step('Same map, back as a Markdown outline. Always in sync.', async (c) => {
    await c.click(map.dockButton('Lens'));
    await c.click(map.menuItem('Doc'));
  });

  await director.title('And more', 'Folders & code highlighting · PNG/SVG/Markdown export · MCP for Claude Code & Codex');
  await director.end('solomd-rtl', 'Free · MIT · local-first · no telemetry — github.com/ofekisr/solomd-rtl');
});
