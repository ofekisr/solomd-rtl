// Exports under test: createGateController (mindmap-gate-controller.ts), createMapKeyDispatch (mindmap-key-dispatch.ts)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MindElixirInstance, NodeObj, Topic } from 'mind-elixir';
import { createGateController, type GateController, type GateNotice } from './gate-controller.ts';
import { resolveBindings } from '../keybindings.ts';
import { createMapKeyDispatch } from './key-dispatch.ts';

const FOLLOW_KEY = { key: 'Enter', altKey: true };
const BACK_KEY = { key: 'ArrowLeft', altKey: true };
const PLAIN_ENTER = { key: 'Enter' };

interface Harness {
  controller: GateController;
  selected: string[];
  notices: GateNotice[];
  setCurrent(id: string): void;
}

function topicFor(node: NodeObj): Topic {
  return { nodeObj: node } as unknown as Topic;
}

function allNodes(node: NodeObj): NodeObj[] {
  return [node, ...(node.children ?? []).flatMap(allNodes)];
}

function buildTree(): NodeObj {
  const gate: NodeObj = { id: 'g1', topic: '⇒ A', metadata: { gate: { target: 'a' } } };
  const broken: NodeObj = { id: 'g2', topic: '⇒ ?', metadata: { gate: { target: 'missing' } } };
  const target: NodeObj = { id: 'a', topic: 'A', children: [{ id: 'a1', topic: 'A1' }] };
  return { id: 'root', topic: 'Root', children: [target, { id: 'b', topic: 'B', children: [gate, broken] }] };
}

function buildHarness(): Harness {
  const root = buildTree();
  const selected: string[] = [];
  const notices: GateNotice[] = [];
  const fake = {
    nodeData: root,
    currentNode: topicFor(root),
    findEle: (id: string) => {
      const node = allNodes(root).find((n) => n.id === id);
      return node ? topicFor(node) : undefined;
    },
    selectNode: (el: Topic) => { selected.push(el.nodeObj.id); fake.currentNode = el; },
    scrollIntoView: () => undefined,
    refresh: () => undefined,
  };
  const controller = createGateController({
    getMind: () => fake as unknown as MindElixirInstance,
    isReadOnly: () => false,
    brokenLabel: () => '?',
    notify: (key) => notices.push(key),
    onChange: () => undefined,
  }, { 'mindmap.markGateTarget': 'm', 'mindmap.insertGate': 'i', 'mindmap.followGate': 'f', 'mindmap.gateBack': 'b', 'mindmap.repairGate': 'r', 'mindmap.removeGate': 'x' });
  const setCurrent = (id: string): void => { fake.currentNode = fake.findEle(id) as Topic; };
  return { controller, selected, notices, setCurrent };
}

interface FakeKeyEvent {
  key: string; code: string; altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean;
  isComposing: boolean; repeat: boolean; defaultPrevented: boolean; isStopped: boolean;
  preventDefault(): void; stopPropagation(): void;
}

function keyEvent(init: { key: string; altKey?: boolean }): FakeKeyEvent {
  const e: FakeKeyEvent = {
    key: init.key, code: '', altKey: init.altKey ?? false, ctrlKey: false, metaKey: false, shiftKey: false,
    isComposing: false, repeat: false, defaultPrevented: false, isStopped: false,
    preventDefault: () => { e.defaultPrevented = true; },
    stopPropagation: () => { e.isStopped = true; },
  };
  return e;
}

interface KeyRig {
  press(init: { key: string; altKey?: boolean }): { event: FakeKeyEvent; coreHandled: number };
}

function buildKeyRig(controller: GateController): KeyRig {
  const dispatch = createMapKeyDispatch({
    isIgnored: () => false,
    getBindings: () => resolveBindings({}, 'mindmap'),
    canRunOn: () => true,
    getAction: (id) => controller.actions[id],
    onChordFollowUp: () => undefined,
  });
  return {
    press: (init) => {
      const event = keyEvent(init);
      let coreHandled = 0;
      dispatch.onCapture(event as unknown as KeyboardEvent);
      if (!event.isStopped) dispatch.onBubble(event as unknown as KeyboardEvent);
      if (!event.isStopped) coreHandled += 1;
      return { event, coreHandled };
    },
  };
}

test('follow on a gate selects its target and back returns to the gate', () => {
  const h = buildHarness();
  h.setCurrent('g1');
  h.controller.actions['mindmap.followGate']();
  assert.deepEqual(h.selected, ['a']);
  h.controller.actions['mindmap.gateBack']();
  assert.deepEqual(h.selected, ['a', 'g1']);
  h.controller.actions['mindmap.gateBack']();
  assert.deepEqual(h.selected, ['a', 'g1']);
});

test('follow on a broken gate keeps the selection and notifies', () => {
  const h = buildHarness();
  h.setCurrent('g2');
  h.controller.actions['mindmap.followGate']();
  assert.deepEqual(h.selected, []);
  assert.deepEqual(h.notices, ['gateNoTarget']);
  h.controller.actions['mindmap.gateBack']();
  assert.deepEqual(h.selected, []);
});

test('follow on a plain node is rejected', () => {
  const h = buildHarness();
  h.setCurrent('a');
  h.controller.actions['mindmap.followGate']();
  assert.deepEqual(h.selected, []);
  assert.deepEqual(h.notices, ['gateNotGate']);
});

test('before.addChild refuses a gate and allows a plain node', () => {
  const h = buildHarness();
  h.setCurrent('g1');
  assert.equal(h.controller.guards.addChild?.(), false);
  assert.deepEqual(h.notices, ['gateCannotHoldChildren']);
  h.setCurrent('a');
  assert.equal(h.controller.guards.addChild?.(), true);
});

test('Alt+Enter is handled in capture and never reaches the core Enter handler', () => {
  const h = buildHarness();
  h.setCurrent('g1');
  const { event, coreHandled } = buildKeyRig(h.controller).press(FOLLOW_KEY);
  assert.deepEqual(h.selected, ['a']);
  assert.equal(event.isStopped, true);
  assert.equal(event.defaultPrevented, true);
  assert.equal(coreHandled, 0);
});

test('Alt+ArrowLeft goes back in capture without reaching the core ArrowLeft handler', () => {
  const h = buildHarness();
  h.setCurrent('g1');
  const rig = buildKeyRig(h.controller);
  rig.press(FOLLOW_KEY);
  const { event, coreHandled } = rig.press(BACK_KEY);
  assert.deepEqual(h.selected, ['a', 'g1']);
  assert.equal(event.isStopped, true);
  assert.equal(coreHandled, 0);
});

test('a built-in combo is stopped in the bubble phase so outer handlers never see it', () => {
  const h = buildHarness();
  const { event, coreHandled } = buildKeyRig(h.controller).press(PLAIN_ENTER);
  assert.equal(event.isStopped, true);
  assert.equal(coreHandled, 0);
  assert.deepEqual(h.selected, []);
});

test('menu lists Back after Follow and carries shortcut hints', () => {
  const labels = { 'mindmap.markGateTarget': 'm', 'mindmap.insertGate': 'i', 'mindmap.followGate': 'f', 'mindmap.gateBack': 'b', 'mindmap.repairGate': 'r', 'mindmap.removeGate': 'x' } as const;
  const ctx = { getMind: () => null, isReadOnly: () => false, brokenLabel: () => '?', notify: () => undefined, onChange: () => undefined };
  const { menu } = createGateController(ctx, labels, { 'mindmap.followGate': '⌥Enter', 'mindmap.gateBack': '⌥←' });
  assert.deepEqual(menu.map((i) => i.name), ['m', 'i', 'f', 'b', 'r', 'x']);
  assert.equal(menu[2].key, '⌥Enter');
  assert.equal(menu[3].key, '⌥←');
  assert.equal(menu[0].key, undefined);
});
