import { useTabsStore } from '../stores/tabs';
import welcomeEn from '../assets/welcome/welcome.en.md?raw';
import syntaxEn from '../assets/welcome/syntax.en.md?raw';
import slideshowEn from '../assets/welcome/slideshow.en.md?raw';
import shortcutsEn from '../assets/welcome/shortcuts.en.md?raw';
import liveEditDemoEn from '../assets/welcome/live-edit-demo.en.md?raw';

export function openWelcomeTour(): void {
  const tabs = useTabsStore();
  const docs = [
    { name: 'Welcome.md', content: welcomeEn },
    { name: 'Markdown syntax.md', content: syntaxEn },
    { name: 'Live edit demo.md', content: liveEditDemoEn },
    { name: 'Slideshow.md', content: slideshowEn },
    { name: 'Shortcuts.md', content: shortcutsEn },
  ];
  let firstId: string | undefined;
  for (const d of docs) {
    const tab = tabs.newTab({ fileName: d.name, language: 'markdown' });
    tab.content = d.content;
    tab.savedContent = d.content;
    if (!firstId) firstId = tab.id;
  }
  if (firstId) tabs.activate(firstId);
}
