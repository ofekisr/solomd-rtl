import { test } from '../kit/fixtures';
import { MapUi } from '../kit/mindmap';
import { doc } from '../kit/seed';

const TARGET = 'תמחור';
const RENAMED_SUFFIX = ' ומבצעים';
const GATE_PARENT = 'קמפיין השקה';

test('Mind maps — gates', async ({ demo }) => {
  const { page, director } = demo;
  await demo.open([doc('רבעון.mmap', { lens: 'map' })], { viewMode: 'liveEdit', rightSidebarHidden: true });
  const map = new MapUi(page);
  await map.waitForCanvas();
  await map.dockButton('Fit to window').click();

  await director.title('Gates', 'One node, linked from anywhere in the map');

  await director.step('Right-click a node → Mark as gate target', async (c) => {
    await c.click(map.exactNode(TARGET));
    await c.click(map.exactNode(TARGET), { button: 'right' });
    await c.click(map.contextItem('Mark as gate target'));
  });

  await director.step('Elsewhere: Insert gate — a live link to the marked node', async (c) => {
    await c.click(map.exactNode(GATE_PARENT));
    await c.click(map.exactNode(GATE_PARENT), { button: 'right' });
    await c.click(map.contextItem('Insert gate to marked node'));
  });

  await director.step('Rename the target — every gate label follows', async (c) => {
    await c.click(map.exactNode(TARGET));
    await c.press('F2');
    await c.press('End');
    await c.type(RENAMED_SUFFIX);
    await c.press('Enter');
  });

  await director.step('⌥↵ follows the gate to its target · ⌥← jumps back', async (c) => {
    await c.click(map.gate(TARGET + RENAMED_SUFFIX));
    await c.press('Alt+Enter');
    await director.pause();
    await director.snapshot();
    await c.press('Alt+ArrowLeft');
    await c.click(map.dockButton('Fit to window'));
  });

  await director.step('Same topic twice? Merge the duplicate into a gate', async (c) => {
    await c.click(map.duplicatesChip);
    await c.click(map.duplicates.getByRole('button', { name: 'Merge into gate' }).first());
    await c.click(map.duplicates.getByRole('button', { name: 'Close' }));
  });

  await director.step('Graph view draws every gate as a dashed link', async (c) => {
    await c.click(map.dockButton('Graph view'));
    await c.click(map.dockButton('Fit to window'));
  });

  await director.end('solomd-rtl', 'Mind maps, Hebrew-first · github.com/ofekisr/solomd-rtl');
});
