import { createApp, defineAsyncComponent } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import {
  installDirectiveCompletionLoadResult,
  loadDirectiveCompletions,
  type DirectiveCompletionLoadResult,
} from './lib/directive-completion-registry';
import { useToastsStore } from './stores/toasts';
import { openInspectorIfRequested } from './lib/devtools';
import './styles/cjk-font.css';
import './styles/main.css';
import './styles/hljs-theme.css';
import './styles/git-pane.css';
import 'katex/dist/katex.min.css';

const params = new URLSearchParams(window.location.search);
const isSlideshow = params.get('slideshow') === '1';
// The quick-capture box is a second webview on the same bundle rather than a
// separate entry point: it needs the settings and workspace stores (theme,
// language, current folder) and gets them from the shared localStorage for
// free this way.
const isQuickCapture = params.get('quickCapture') === '1';

// Both alternate roots are chosen by a URL param that the main window never
// carries, so they are loaded on demand — keeping reveal.js and the capture
// box out of the entry chunk every normal launch has to compile.
const rootComponent = isSlideshow
  ? defineAsyncComponent(() => import('./components/Slideshow.vue'))
  : isQuickCapture
    ? defineAsyncComponent(() => import('./components/QuickCapture.vue'))
    : App;

async function bootstrap(): Promise<void> {
  if (import.meta.env.DEV && !isSlideshow && !isQuickCapture) {
    await (await import('./lib/dev-seed')).applyDevSeed();
  }
  const pinia = createPinia();
  const app = createApp(rootComponent);
  app.use(pinia);

  void openInspectorIfRequested();

  const result = await startupDirectiveCompletions();
  installDirectiveCompletionLoadResult(result);
  app.mount('#app');

  if (result.warnings.length > 0) {
    const count = result.warnings.length;
    useToastsStore(pinia).warning(
      `${count} directive completion manifest${count === 1 ? '' : 's'} could not be loaded.`,
    );
  }
}

async function startupDirectiveCompletions(): Promise<DirectiveCompletionLoadResult> {
  if (isSlideshow || isQuickCapture) {
    return { directory: '', manifests: [], warnings: [] };
  }
  try {
    return await loadDirectiveCompletions();
  } catch (error: unknown) {
    return {
      directory: '',
      manifests: [],
      warnings: [{ sourceFile: '<startup>', reason: String(error) }],
    };
  }
}

void bootstrap();
