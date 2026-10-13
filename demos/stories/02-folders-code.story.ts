import { test, MOD } from '../kit/fixtures';
import { useFakeBackend, vaultBackend } from '../kit/tauri-mock';

test('Folders, code and books', async ({ demo }) => {
  const { page, director } = demo;
  await useFakeBackend(page, vaultBackend('vault', ['epub-directives.json']));
  await demo.open([], { showFileTree: true, rightSidebarHidden: true, viewMode: 'edit' });
  const tree = page.locator('aside.ftree');
  const entry = (name: string) => tree.getByText(name, { exact: true }).first();
  const editor = page.locator('.cm-content').first();
  const viewButton = (title: string) => page.locator(`.toolbar__group button[title^="${title}"]`);

  await director.title('Folders, code and books', 'Open a folder · highlighting · numbered blocks · directives');

  await director.step('Open a whole folder — also from the terminal: solomd ./my-project', async (c) => {
    await c.click(tree.getByText('Open folder…').first());
    await entry('src').waitFor();
  });

  await director.step('Code files open with syntax highlighting — Python', async (c) => {
    await c.click(entry('src'));
    await c.click(entry('app.py'));
  });

  await director.step('.pyj files are recognized as Python', async (c) => {
    await c.click(entry('helpers.pyj'));
  });

  await director.step('TypeScript and shell scripts, each by its own language', async (c) => {
    await c.click(entry('index.ts'));
    await director.pause();
    await c.click(entry('scripts'));
    await c.click(entry('deploy.sh'));
  });

  await director.step('Code fences inside Markdown are highlighted too', async (c) => {
    await c.click(entry('notes'));
    await c.click(entry('פגישה.md'));
  });

  await director.step('*.full.md files number every content block in the preview', async (c) => {
    await c.click(entry('book'));
    await c.click(entry('פרק-1.full.md'));
    await c.click(viewButton('Split'));
  });

  await director.step('EPUB directives autocomplete from a manifest — keys…', async (c) => {
    await c.click(viewButton('Edit only'));
    await c.click(entry('פרק-2.md'));
    await c.click(editor);
    await c.press(`${MOD}+End`);
    await c.press('Enter');
    await c.press('Enter');
    await c.type('<!-- epub: ');
    await director.pause();
  });

  await director.step('…and their allowed values', async (c) => {
    await c.press('ArrowDown');
    await c.press('ArrowDown');
    await c.press('Enter');
    await c.type('=');
    await director.pause();
    await c.press('ArrowDown');
    await c.press('Enter');
  });

  await director.end('solomd-rtl', 'Folders, code and books · github.com/ofekisr/solomd-rtl');
});
