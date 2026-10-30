import assert from 'node:assert/strict';
import test from 'node:test';
import { registerVimEx, VIM_SAVE_TIMEOUT_MS, type VimExHost } from './vim-ex.ts';

interface Recorder {
  host: VimExHost;
  ex: Map<string, { prefix: string; fn: () => void }>;
  defineCalls: string[];
  menu: string[];
  listeners: Map<string, () => void>;
  timers: Array<{ cb: () => void; ms: number }>;
  cleared: number[];
}

function recorder(flags: VimExHost['flags'] = {}): Recorder {
  const r: Recorder = { ex: new Map(), defineCalls: [], menu: [], listeners: new Map(), timers: [], cleared: [] } as unknown as Recorder;
  const target = {
    dispatchEvent: (e: Event) => { r.menu.push(String((e as CustomEvent).detail)); return true; },
    addEventListener: (type: string, fn: () => void) => { r.listeners.set(type, fn); },
    removeEventListener: (type: string) => { r.listeners.delete(type); },
    setTimeout: (cb: () => void, ms: number) => { r.timers.push({ cb, ms }); return r.timers.length; },
  } as unknown as VimExHost['target'];
  r.host = {
    defineEx: (name, prefix, fn) => { r.defineCalls.push(name); r.ex.set(name, { prefix, fn }); },
    target,
    clearTimeout: (id) => { r.cleared.push(id); },
    flags,
  };
  return r;
}

test('defines write, wq, xit, quit with their prefixes', () => {
  const r = recorder();
  registerVimEx(r.host);
  assert.deepEqual([...r.ex].map(([n, v]) => [n, v.prefix]), [['write', 'w'], ['wq', 'wq'], ['xit', 'x'], ['quit', 'q']]);
});

test(':w dispatches file.save once', () => {
  const r = recorder();
  registerVimEx(r.host);
  r.ex.get('write')?.fn();
  assert.deepEqual(r.menu, ['file.save']);
});

test(':q dispatches file.closeTab', () => {
  const r = recorder();
  registerVimEx(r.host);
  r.ex.get('quit')?.fn();
  assert.deepEqual(r.menu, ['file.closeTab']);
});

test(':wq saves, then closes after solomd:saved and clears the timer', () => {
  const r = recorder();
  registerVimEx(r.host);
  r.ex.get('wq')?.fn();
  assert.deepEqual(r.menu, ['file.save']);
  r.listeners.get('solomd:saved')?.();
  assert.deepEqual(r.menu, ['file.save', 'file.closeTab']);
  assert.equal(r.listeners.has('solomd:saved'), false);
  assert.equal(r.cleared.length, 1);
});

test(':x behaves like :wq', () => {
  const r = recorder();
  registerVimEx(r.host);
  r.ex.get('xit')?.fn();
  r.listeners.get('solomd:saved')?.();
  assert.deepEqual(r.menu, ['file.save', 'file.closeTab']);
});

test(':wq without solomd:saved drops the listener after the timeout', () => {
  const r = recorder();
  registerVimEx(r.host);
  r.ex.get('wq')?.fn();
  assert.equal(r.timers[0]?.ms, VIM_SAVE_TIMEOUT_MS);
  assert.equal(r.listeners.has('solomd:saved'), true);
  r.timers[0]?.cb();
  assert.equal(r.listeners.has('solomd:saved'), false);
  assert.deepEqual(r.menu, ['file.save']);
});

test('registering twice with the same flags defines each Ex once', () => {
  const flags: VimExHost['flags'] = {};
  const first = recorder(flags);
  const second = recorder(flags);
  registerVimEx(first.host);
  registerVimEx(second.host);
  assert.equal(first.defineCalls.length + second.defineCalls.length, 4);
  assert.equal(second.defineCalls.length, 0);
});
