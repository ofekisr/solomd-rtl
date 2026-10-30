import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatAgo, linkedRepoLabel, syncMessageKey } from './githubSyncFormat.ts';

const t = (key: string, params?: Record<string, string | number>): string =>
  params ? `${key}:${params.n}` : key;

test('syncMessageKey maps toast keys for gitea only', () => {
  assert.equal(syncMessageKey('gitea', 'pushedToast'), 'githubSync.giteaPushedToast');
  assert.equal(syncMessageKey('gitea', 'pulledToast'), 'githubSync.giteaPulledToast');
  assert.equal(syncMessageKey('gitea', 'repoCreatedToast'), 'githubSync.giteaRepoCreatedToast');
  assert.equal(syncMessageKey('gitea', 'other'), 'githubSync.other');
  assert.equal(syncMessageKey('github', 'pushedToast'), 'githubSync.pushedToast');
  assert.equal(syncMessageKey('gitlab', 'pulledToast'), 'githubSync.pulledToast');
});

test('formatAgo buckets seconds, minutes, hours, days', () => {
  const now = 1_000_000_000_000;
  const at = (secAgo: number): number => now / 1000 - secAgo;
  assert.equal(formatAgo(null, t, now), 'githubSync.never');
  assert.equal(formatAgo(0, t, now), 'githubSync.never');
  assert.equal(formatAgo(at(5), t, now), 'githubSync.agoSec:5');
  assert.equal(formatAgo(at(120), t, now), 'githubSync.agoMin:2');
  assert.equal(formatAgo(at(7300), t, now), 'githubSync.agoHour:2');
  assert.equal(formatAgo(at(200000), t, now), 'githubSync.agoDay:2');
});

test('linkedRepoLabel extracts owner/repo', () => {
  assert.equal(linkedRepoLabel('https://github.com/a/b.git'), 'a/b');
  assert.equal(linkedRepoLabel('git@github.com:a/b'), 'a/b');
  assert.equal(linkedRepoLabel('https://gitea.example.com:3000/o/r.git'), 'o/r');
  assert.equal(linkedRepoLabel('nonsense'), 'nonsense');
});
