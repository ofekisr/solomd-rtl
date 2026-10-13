import { test } from '../kit/fixtures';
import { MapUi } from '../kit/mindmap';
import { useFakeBackend, vaultBackend } from '../kit/tauri-mock';

test('XMind in, Markdown out', async ({ demo }) => {
  const { page, director } = demo;
  await useFakeBackend(page, vaultBackend('vault'));
  await demo.open([], { showFileTree: true, rightSidebarHidden: true, viewMode: 'liveEdit' });
  const map = new MapUi(page);
  const tree = page.locator('aside.ftree');
  const entry = (name: string | RegExp) =>
    (typeof name === 'string' ? tree.getByText(name, { exact: true }) : tree.getByText(name)).first();
  const viewButton = (title: string) => page.locator(`.toolbar__group button[title^="${title}"]`);

  await director.title('XMind in, Markdown out', 'Import .xmind maps · edit · export to Markdown');

  await director.step('Open an XMind file straight from the folder', async (c) => {
    await c.click(tree.getByText('Open folder…').first());
    await c.click(entry('מחקר.xmind'));
    await map.waitForCanvas();
  });

  await director.step('It imports as a native SoloMD mind map', async (c) => {
    await c.click(map.dockButton('Fit to window'));
  });

  await director.step('Keep editing — Tab adds a child', async (c) => {
    await c.click(map.node('תובנות'));
    await c.press('Tab');
    await c.type('חיפוש איטי');
    await c.press('Enter');
  });

  await director.step('Export as Markdown', async (c) => {
    await c.click(map.dockButton('Export as…'));
    await c.click(map.menuItem('Markdown'));
  });

  await director.step('The export lands next to the original — a Hebrew outline, right-to-left', async (c) => {
    await c.click(tree.getByTitle('Refresh').first());
    await c.click(entry(/^מחקר.*\.md$/));
    await c.click(viewButton('Split'));
  });

  await director.end('solomd-rtl', 'XMind ⇄ Markdown · github.com/ofekisr/solomd-rtl');
});
