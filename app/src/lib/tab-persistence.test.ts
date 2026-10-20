import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Tab } from '../types';
import {
  compactTabs,
  evictionCandidates,
  expandTabs,
  setItemWithEviction,
  type EvictionPolicy,
  type KeyValueStorage,
} from './tab-persistence.ts';

const BUCKET = 'solomd.tabs.v1::';
const SESSION = 'solomd.session.';

function tab(id: string, content: string, savedContent: string): Tab {
  return { id, fileName: `${id}.md`, content, savedContent, encoding: 'utf-8', language: 'markdown', hadBom: false };
}

class QuotaStorage implements KeyValueStorage {
  private readonly map = new Map<string, string>();
  private readonly quota: number;
  constructor(quota: number) { this.quota = quota; }
  get length(): number { return this.map.size; }
  key(i: number): string | null { return [...this.map.keys()][i] ?? null; }
  getItem(k: string): string | null { return this.map.get(k) ?? null; }
  removeItem(k: string): void { this.map.delete(k); }
  setItem(k: string, v: string): void {
    const used = [...this.map].reduce((n, [key, val]) => (key === k ? n : n + key.length + val.length), 0);
    if (used + k.length + v.length > this.quota) throw new DOMException('full', 'QuotaExceededError');
    this.map.set(k, v);
  }
}

function policy(recent: string[] = [], live: string[] = []): EvictionPolicy {
  return { bucketPrefix: BUCKET, sessionPrefix: SESSION, recentBucketKeys: recent, liveTabIds: new Set(live) };
}

test('clean tabs store their text once and round-trip', () => {
  const tabs = [tab('a', 'same', 'same'), tab('b', 'edited', 'orig')];
  const stored = compactTabs(tabs);
  assert.equal('savedContent' in stored[0], false);
  assert.equal(stored[1].savedContent, 'orig');
  assert.deepEqual(expandTabs(JSON.parse(JSON.stringify(stored))), tabs);
});

test('expandTabs keeps legacy buckets that store savedContent', () => {
  const legacy = [tab('a', 'x', 'x')];
  assert.deepEqual(expandTabs(legacy), legacy);
});

test('eviction order: orphan sessions, unknown buckets, then oldest recent', () => {
  const keys = [`${BUCKET}/new`, `${BUCKET}/old`, `${BUCKET}/gone`, `${BUCKET}/cur`, `${SESSION}t1`, `${SESSION}t2`, 'solomd.settings.v1'];
  const order = evictionCandidates(keys, `${BUCKET}/cur`, policy([`${BUCKET}/cur`, `${BUCKET}/new`, `${BUCKET}/old`], ['t1']));
  assert.deepEqual(order, [`${SESSION}t2`, `${BUCKET}/gone`, `${BUCKET}/old`, `${BUCKET}/new`]);
});

test('a full store evicts stale buckets until the write fits', () => {
  const storage = new QuotaStorage(120);
  storage.setItem(`${BUCKET}/old`, 'x'.repeat(40));
  storage.setItem(`${BUCKET}/new`, 'y'.repeat(40));
  const ok = setItemWithEviction(storage, `${BUCKET}/cur`, 'z'.repeat(40), policy([`${BUCKET}/new`, `${BUCKET}/old`]));
  assert.equal(ok, true);
  assert.equal(storage.getItem(`${BUCKET}/old`), null);
  assert.equal(storage.getItem(`${BUCKET}/new`), 'y'.repeat(40));
  assert.equal(storage.getItem(`${BUCKET}/cur`), 'z'.repeat(40));
});

test('reports failure when nothing evictable frees enough room', () => {
  const storage = new QuotaStorage(30);
  storage.setItem('solomd.settings.v1', 'x'.repeat(10));
  assert.equal(setItemWithEviction(storage, `${BUCKET}/cur`, 'z'.repeat(40), policy()), false);
  assert.equal(storage.getItem('solomd.settings.v1'), 'x'.repeat(10));
});
