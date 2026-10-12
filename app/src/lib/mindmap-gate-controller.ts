import type { MindElixirInstance, NodeObj, Options, Topic } from 'mind-elixir';
import {
  ancestorIds, canBeGateTarget, canHoldChildren, findNode, gateLabel, isBrokenGate, isGate, makeGateNode, readGate, walkNodes, withGate,
} from './mindmap-gates.ts';

type Before = NonNullable<Options['before']>;

export type GateNotice = 'gateMarked' | 'gateNoTarget' | 'gateTargetIsGate' | 'gateNotGate' | 'gateCannotHoldChildren';
export type GateMenuAction = 'mindmap.markGateTarget' | 'mindmap.insertGate' | 'mindmap.followGate' | 'mindmap.repairGate' | 'mindmap.removeGate';
export interface ContextMenuItem { name: string; onclick: () => void }
export interface GateControllerContext {
  getMind(): MindElixirInstance | null;
  isReadOnly(): boolean;
  brokenLabel(): string;
  notify(key: GateNotice): void;
  onChange(): void;
}
export interface GateController {
  actions: Record<string, () => void>;
  guards: Before;
  menu: ContextMenuItem[];
  syncLabels(): void;
}

const GATE_ID_LENGTH = 16;
const MENU_ACTIONS: readonly GateMenuAction[] = ['mindmap.markGateTarget', 'mindmap.insertGate', 'mindmap.followGate', 'mindmap.repairGate', 'mindmap.removeGate'];

function newNodeId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, GATE_ID_LENGTH);
}

function isGateTopic(tpc: Topic | undefined): boolean {
  return tpc !== undefined && isGate(tpc.nodeObj);
}

function liveRoot(m: MindElixirInstance): NodeObj {
  return m.isFocusMode && m.nodeDataBackup ? m.nodeDataBackup : m.nodeData;
}

function liveElement(m: MindElixirInstance, id: string): Topic | null {
  try {
    return m.findEle(id);
  } catch {
    return null;
  }
}

export function createGateController(ctx: GateControllerContext, labels: Record<GateMenuAction, string>): GateController {
  let markedId: string | null = null;
  const history: string[] = [];

  const mind = (): MindElixirInstance | null => ctx.getMind();
  const current = (): NodeObj | null => mind()?.currentNode?.nodeObj ?? null;
  const root = (): NodeObj | null => {
    const m = mind();
    return m ? liveRoot(m) : null;
  };
  const liveMarked = (): NodeObj | null => {
    const r = root();
    const node = r && markedId ? findNode(r, markedId) : null;
    return node && canBeGateTarget(node) ? node : null;
  };

  function reselect(id: string): void {
    const m = mind();
    const el = m ? liveElement(m, id) : null;
    if (m && el) m.selectNode(el);
  }

  function select(id: string): void {
    const m = mind();
    if (m?.isFocusMode && !liveElement(m, id)) m.cancelFocus();
    const el = m ? liveElement(m, id) : null;
    if (!m || !el) return;
    m.selectNode(el);
    m.scrollIntoView(el, true);
  }

  function expandAncestors(id: string): void {
    const m = mind();
    const path = m ? ancestorIds(liveRoot(m), id) : null;
    if (!m || !path) return;
    const collapsed = path.map((a) => findNode(liveRoot(m), a)).filter((n): n is NodeObj => n?.expanded === false);
    if (collapsed.length === 0) return;
    for (const node of collapsed) node.expanded = true;
    m.refresh();
  }

  function markTarget(): void {
    const node = current();
    if (!node) return;
    if (!canBeGateTarget(node)) return ctx.notify('gateTargetIsGate');
    markedId = node.id;
    ctx.notify('gateMarked');
  }

  function insertGate(): void {
    const m = mind(); const parent = m?.currentNode;
    if (!m || !parent || ctx.isReadOnly()) return;
    if (!canHoldChildren(parent.nodeObj)) return ctx.notify('gateCannotHoldChildren');
    const target = liveMarked();
    if (!target) return ctx.notify('gateNoTarget');
    void m.addChild(parent, makeGateNode(newNodeId(), target));
  }

  function followGate(): void {
    const gate = current(); const r = root();
    if (!gate || !r || !isGate(gate)) return ctx.notify('gateNotGate');
    const meta = readGate(gate);
    if (!meta || isBrokenGate(gate, r)) return ctx.notify('gateNoTarget');
    history.push(gate.id);
    expandAncestors(meta.target);
    select(meta.target);
  }

  function gateBack(): void {
    const id = history.pop();
    if (id) select(id);
  }

  function repairGate(): void {
    const gate = current(); const target = liveMarked();
    if (!gate || !isGate(gate) || ctx.isReadOnly()) return ctx.notify('gateNotGate');
    if (!target) return ctx.notify('gateNoTarget');
    Object.assign(gate, withGate(gate, { target: target.id }));
    syncLabels();
    ctx.onChange();
  }

  function removeGate(): void {
    const m = mind(); const tpc = m?.currentNode;
    if (!m || !tpc || ctx.isReadOnly()) return;
    if (!isGate(tpc.nodeObj)) return ctx.notify('gateNotGate');
    void m.removeNodes([tpc]);
  }

  function syncLabels(): void {
    const m = mind();
    if (!m) return;
    const broken = ctx.brokenLabel();
    const stale = walkNodes(liveRoot(m)).filter((n) => isGate(n) && n.topic !== gateLabel(n, liveRoot(m), broken));
    if (stale.length === 0) return;
    for (const node of stale) node.topic = gateLabel(node, liveRoot(m), broken);
    const selected = m.currentNode?.nodeObj.id;
    m.refresh();
    if (selected) reselect(selected);
  }

  function canAddChildTo(el: Topic | undefined): boolean {
    const target = (el ?? mind()?.currentNode)?.nodeObj;
    if (!target || canHoldChildren(target)) return true;
    ctx.notify('gateCannotHoldChildren');
    return false;
  }

  const guards: Before = {
    addChild: (el) => canAddChildTo(el),
    moveNodeIn: (_from, to) => !isGateTopic(to),
    copyNode: (_node, to) => !isGateTopic(to),
    copyNodes: (_tpcs, to) => !isGateTopic(to),
  };

  const actions: Record<string, () => void> = {
    'mindmap.markGateTarget': markTarget,
    'mindmap.insertGate': insertGate,
    'mindmap.followGate': followGate,
    'mindmap.gateBack': gateBack,
    'mindmap.repairGate': repairGate,
    'mindmap.removeGate': removeGate,
  };
  const menu: ContextMenuItem[] = MENU_ACTIONS.map((id) => ({ name: labels[id], onclick: actions[id] }));
  return { actions, guards, menu, syncLabels };
}
