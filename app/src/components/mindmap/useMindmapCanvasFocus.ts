import { ref } from 'vue';
import type { MindElixirInstance, NodeObj, Topic } from 'mind-elixir';
import { buildFreezeStrip, canAnchor, getTabFocus, getTabStripRoot, pathTo, setTabFocus, setTabStripRoot, type FreezeStrip } from '../../lib/mindmap/focus';
import { EMPTY_FRAME_STYLE, readFrameVars, type StripFrameStyle } from '../../lib/mindmap/frame-style';

export interface FocusDeps {
  getMind(): MindElixirInstance | null;
  focusKey(): string | undefined;
}

export function fullRoot(instance: MindElixirInstance): NodeObj {
  return instance.getData().nodeData;
}

function findLiveTopic(instance: MindElixirInstance, id: string): Topic | null {
  try {
    return instance.findEle(id) ?? null;
  } catch {
    return null;
  }
}

export function useMindmapCanvasFocus(deps: FocusDeps) {
  const initialKey = deps.focusKey();
  const focusId = ref<string | null>(initialKey ? getTabFocus(initialKey) : null);
  const stripRootId = ref<string | null>(initialKey ? getTabStripRoot(initialKey) : null);
  const strip = ref<FreezeStrip | null>(null);
  const frameStyle = ref<StripFrameStyle>(EMPTY_FRAME_STYLE);
  let isApplyingFocus = false;

  function rememberFocus(id: string | null): void {
    focusId.value = id;
    const key = deps.focusKey();
    if (key) setTabFocus(key, id);
  }

  function refreshFrameStyle(): void {
    const mind = deps.getMind();
    if (!mind) return;
    const computed = getComputedStyle(mind.container);
    frameStyle.value = { vars: readFrameVars((name) => computed.getPropertyValue(name)), palette: [...mind.theme.palette] };
  }

  function rememberStripRoot(id: string | null): void {
    stripRootId.value = id;
    const key = deps.focusKey();
    if (key) setTabStripRoot(key, id);
  }

  function setStripRoot(id: string | null): void {
    const mind = deps.getMind();
    if (!mind) return;
    const root = fullRoot(mind);
    if (id !== null && !canAnchor(root, id)) return;
    rememberStripRoot(id === root.id ? null : id);
    refreshStrip(root);
  }

  function pinCurrentAsStripRoot(): void {
    const id = deps.getMind()?.currentNode?.nodeObj.id;
    if (id) setStripRoot(id);
  }

  function refreshStrip(knownRoot?: NodeObj | null): void {
    const mind = deps.getMind();
    if (!mind || !deps.focusKey()) {
      strip.value = null;
      return;
    }
    const root = knownRoot ?? fullRoot(mind);
    if (stripRootId.value !== null && !canAnchor(root, stripRootId.value)) rememberStripRoot(null);
    strip.value = buildFreezeStrip(root, focusId.value, stripRootId.value);
  }

  function wrapFocus(instance: MindElixirInstance): void {
    const { focusNode, cancelFocus } = instance;
    instance.focusNode = (tpc) => {
      const isRoot = !tpc.nodeObj.parent;
      focusNode.call(instance, tpc);
      if (!isApplyingFocus && !isRoot) rememberFocus(tpc.nodeObj.id);
      refreshStrip();
    };
    instance.cancelFocus = () => {
      cancelFocus.call(instance);
      if (!isApplyingFocus) rememberFocus(null);
      refreshStrip();
    };
  }

  function focusById(id: string | null): void {
    const mind = deps.getMind();
    if (!mind) return;
    if (mind.isFocusMode) mind.cancelFocus();
    if (id === null || id === mind.nodeData.id) {
      rememberFocus(null);
      refreshStrip();
      return;
    }
    const el = findLiveTopic(mind, id);
    if (el) mind.focusNode(el);
  }

  function reapplyFocus(): void {
    const mind = deps.getMind();
    if (!mind) return;
    const id = focusId.value;
    if (id === null || !pathTo(fullRoot(mind), id)) {
      rememberFocus(null);
      refreshStrip();
      return;
    }
    isApplyingFocus = true;
    const el = findLiveTopic(mind, id);
    if (el) mind.focusNode(el);
    else rememberFocus(null);
    isApplyingFocus = false;
    refreshStrip();
  }

  function leaveFocusQuietly(): void {
    const mind = deps.getMind();
    if (!mind?.isFocusMode) return;
    isApplyingFocus = true;
    mind.cancelFocus();
    isApplyingFocus = false;
  }

  return { focusId, stripRootId, strip, frameStyle, refreshFrameStyle, setStripRoot, pinCurrentAsStripRoot, refreshStrip, wrapFocus, focusById, reapplyFocus, leaveFocusQuietly };
}
