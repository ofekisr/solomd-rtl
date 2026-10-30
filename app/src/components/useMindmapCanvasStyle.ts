import type { MindElixirInstance, NodeObj } from 'mind-elixir';
import { useSettingsStore } from '../stores/settings';
import { useToastsStore } from '../stores/toasts';
import { useI18n } from '../i18n';
import { copyStyle, pasteStyle, styleClipboard, type NodeStyle, type RenderedLook } from '../lib/mindmap/node-copy';
import { templateName } from '../lib/mindmap/style-templates';
import { promptText } from '../composables/useGitPrompt';
import type { GroupMenuItem } from '../lib/mindmap/context-menu';

export interface StyleDeps {
  getMind(): MindElixirInstance | null;
  selectedNodes(): NodeObj[];
  canEditTree(): boolean;
  commitTreeEdit(instance: MindElixirInstance, anchor: NodeObj, mutate: () => NodeObj[]): boolean;
  reselect(instance: MindElixirInstance, nodes: readonly NodeObj[]): void;
}

export function useMindmapCanvasStyle(deps: StyleDeps) {
  const settings = useSettingsStore();
  const toasts = useToastsStore();
  const { t } = useI18n();

  function reportingSyncErrors(run: () => void): () => void {
    return () => {
      try {
        run();
      } catch (e: unknown) {
        toasts.error(String(e));
      }
    };
  }

  function reportingErrors(run: () => Promise<void>): () => void {
    return () => { void run().catch((e: unknown) => toasts.error(String(e))); };
  }

  function liveNode(id: string): NodeObj | null {
    try {
      return deps.getMind()?.findEle(id)?.nodeObj ?? null;
    } catch {
      return null;
    }
  }

  function liveSelectedNodes(): NodeObj[] {
    return deps.selectedNodes().map((node) => liveNode(node.id)).filter((node): node is NodeObj => node !== null);
  }

  function renderedLookOf(id: string): RenderedLook | undefined {
    try {
      const element = deps.getMind()?.findEle(id);
      return element ? getComputedStyle(element) : undefined;
    } catch {
      return undefined;
    }
  }

  function copyNodeStyle(): void {
    const node = liveSelectedNodes()[0];
    if (!node) {
      toasts.info(t('mindmap.selectNodeFirst'));
      return;
    }
    styleClipboard.value = copyStyle(node, renderedLookOf(node.id));
    toasts.success(t('mindmap.styleCopied'));
  }

  function applyStyleToSelection(style: NodeStyle): void {
    const targets = liveSelectedNodes();
    const mind = deps.getMind();
    if (!mind || targets.length === 0) {
      toasts.info(t('mindmap.selectNodeFirst'));
      return;
    }
    if (!deps.canEditTree()) {
      toasts.info(t('mindmap.pasteBlocked'));
      return;
    }
    let count = 0;
    deps.commitTreeEdit(mind, targets[0], () => {
      const changed = pasteStyle(targets, style);
      count = changed.length;
      return changed;
    });
    deps.reselect(mind, targets);
    if (count === 0) toasts.info(t('mindmap.styleUnchanged'));
    else toasts.success(t('mindmap.stylePasted', { count }));
  }

  function pasteNodeStyle(): void {
    const style = styleClipboard.value;
    if (!style) {
      toasts.info(t('mindmap.styleClipboardEmpty'));
      return;
    }
    applyStyleToSelection(style);
  }

  async function saveStyleTemplate(): Promise<void> {
    const node = liveSelectedNodes()[0];
    if (!node) {
      toasts.info(t('mindmap.selectNodeFirst'));
      return;
    }
    const copied = copyStyle(node, renderedLookOf(node.id));
    const name = templateName((await promptText({ title: t('mindmap.styleTemplateNamePrompt'), placeholder: node.topic })) ?? '');
    if (name === '') return;
    settings.saveMindmapStyleTemplate({ name, ...copied });
    toasts.success(t('mindmap.styleTemplateSaved', { name }));
  }

  function styleTemplateMenuItems(): GroupMenuItem[] {
    const templates = settings.mindmapStyleTemplates.map((template) => ({
      name: template.name,
      onclick: reportingSyncErrors(() => applyStyleToSelection(template)),
      removeLabel: t('mindmap.styleTemplateRemove'),
      onremove: () => settings.removeMindmapStyleTemplate(template.name),
    }));
    return [{ name: t('mindmap.menuSaveStyleTemplate'), onclick: reportingErrors(saveStyleTemplate) }, ...templates];
  }

  function applyStyleTemplate(name: string): void {
    const template = settings.mindmapStyleTemplates.find((tpl) => tpl.name === name);
    if (template) reportingSyncErrors(() => applyStyleToSelection(template))();
  }

  return { reportingSyncErrors, reportingErrors, copyNodeStyle, pasteNodeStyle, saveStyleTemplate, styleTemplateMenuItems, applyStyleTemplate };
}
