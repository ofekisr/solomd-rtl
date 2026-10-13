import { test } from '../kit/fixtures';
import { MapUi } from '../kit/mindmap';
import { useFakeBackend, vaultBackend } from '../kit/tauri-mock';

const MD_SNIPPET = '**תזכורת:** לשלוח סיכום לצוות עד יום ראשון';
const MERMAID_SNIPPET = 'graph LR\n  רעיון --> טיוטה --> פרסום';

test('A mind map from scratch', async ({ demo }) => {
  const { page, director } = demo;
  await useFakeBackend(page, vaultBackend('vault'));
  await demo.open([], { showFileTree: true, rightSidebarHidden: true, viewMode: 'liveEdit' });
  const map = new MapUi(page);
  const tree = page.locator('aside.ftree');
  const snippets = page.locator('section.mm-snippets');

  await director.title('A mind map from scratch', 'New .mmap · keyboard-first editing · Markdown and Mermaid inside the map');

  await director.step('Create a new file in the folder and name it .mmap', async (c) => {
    await c.click(tree.getByText('Open folder…').first());
    await c.click(tree.getByTitle('New file').first());
    await c.press('ControlOrMeta+A');
    await c.type('רעיונות.mmap');
    await c.press('Enter');
    await map.waitForCanvas();
  });

  await director.step('An empty map, named after the file — select the root', async (c) => {
    await c.click(map.node('רעיונות'));
  });

  await director.step('Tab adds a child, Enter confirms', async (c) => {
    await c.press('Tab');
    await c.type('מטרות');
    await c.press('Enter');
  });

  await director.step('Enter on a node adds a sibling', async (c) => {
    await c.press('Enter');
    await c.type('משימות');
    await c.press('Enter');
  });

  await director.step('Keep going — children and siblings, all from the keyboard', async (c) => {
    await c.press('Tab');
    await c.type('לכתוב טיוטה');
    await c.press('Enter');
    await c.press('Enter');
    await c.type('לקבל משוב');
    await c.press('Enter');
  });

  await director.step('The map carries Markdown too — add a Markdown snippet', async (c) => {
    await c.click(snippets.getByRole('button', { name: '+ Markdown' }));
    await c.click(snippets.getByRole('button', { name: 'Edit' }).last());
    await c.click(snippets.locator('textarea.mm-snippet__body').last());
    await c.type(MD_SNIPPET);
    await c.click(snippets.getByRole('button', { name: 'Done' }).last());
  });

  await director.step('…and a Mermaid diagram, rendered right under the map', async (c) => {
    await c.click(snippets.getByRole('button', { name: '+ Mermaid' }));
    await c.click(snippets.getByRole('button', { name: 'Edit' }).last());
    await c.click(snippets.locator('textarea.mm-snippet__body').last());
    await c.type(MERMAID_SNIPPET);
    await c.click(snippets.getByRole('button', { name: 'Done' }).last());
    await c.hover(snippets.locator('.mm-snippet[data-kind="mermaid"] svg').first());
  });

  await director.end('solomd-rtl', 'Mind maps, Hebrew-first · github.com/ofekisr/solomd-rtl');
});
