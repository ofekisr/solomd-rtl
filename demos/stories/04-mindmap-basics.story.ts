import { test } from '../kit/fixtures';
import { MapUi } from '../kit/mindmap';
import { runCommand } from '../kit/palette';
import { doc } from '../kit/seed';

test('Mind maps — the basics', async ({ demo }) => {
  const { page, director } = demo;
  await demo.open([doc('השקה.mmap', { lens: 'map' })], { viewMode: 'liveEdit' });
  const map = new MapUi(page);
  const viewButton = (title: string) => page.locator(`.toolbar__group button[title^="${title}"]`);
  await map.waitForCanvas();
  await map.dockButton('Fit to window').click();

  await director.title('Mind maps in SoloMD', '.mmap files · raw JSON · outline · focus · themes · export');

  await director.step('A .mmap file opens as a live mind map — Hebrew maps grow right-to-left', async (c) => {
    await c.hover(map.node('השקת מוצר'));
  });

  await director.step('Add ideas from the keyboard — Tab adds a child', async (c) => {
    await c.click(map.node('תמיכה'));
    await c.press('Tab');
    await c.type('צ׳אט חי');
    await c.press('Enter');
  });

  await director.step('Data lens: the raw .mmap JSON next to the map — editable', async (c) => {
    await c.click(viewButton('Split'));
    await c.click(map.dockButton('Lens'));
    await c.click(map.menuItem('Data'));
    await c.hover(page.locator('.cm-line', { hasText: '"topic"' }).first());
  });

  await director.step('Doc lens: the same map as a Markdown outline', async (c) => {
    await c.click(map.dockButton('Lens'));
    await c.click(map.menuItem('Doc'));
  });

  await director.step('Focus mode: zoom into one branch', async (c) => {
    await c.click(viewButton('Live edit'));
    await c.click(map.dockButton('Lens'));
    await c.click(map.menuItem('Map'));
    await c.click(map.node('פיתוח'));
    await runCommand(page, c, 'focus node');
  });

  await director.step('…and step back out to the whole map', async (c) => {
    await runCommand(page, c, 'cancel focus');
  });

  await director.step('Five map themes, each with light and dark variants', async (c) => {
    await c.click(map.dockButton('Side panel'));
    await c.click(page.getByRole('tab', { name: 'Map' }));
    await c.click(page.getByRole('radio', { name: 'Ocean' }));
    await director.pause();
    await c.click(page.getByRole('radio', { name: 'Forest' }));
    await director.pause();
    await c.click(map.dockButton('Side panel'));
  });

  await director.step('Export to PNG, SVG, HTML, Markdown, Mermaid and more', async (c) => {
    await c.click(map.dockButton('Export as…'));
    await c.hover(map.menuItem('Markdown'));
    await c.press('Escape');
  });

  await director.step('Fit the whole map to the window in one click', async (c) => {
    await c.click(map.dockButton('Fit to window'));
  });

  await director.end('solomd-rtl', 'Mind maps, Hebrew-first · github.com/ofekisr/solomd-rtl');
});
