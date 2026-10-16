import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serializeMindmap } from '../../app/src/lib/mindmap-format.ts';
import { MapStore } from '../src/store.ts';

export const SID = '0f8fad5b-d9cb-469f-a165-70867728950e';

export const sampleData = () => ({ nodeData: { id: 'r', topic: 'Plan', children: [
  { id: 'a', topic: 'Phase 2', metadata: { fields: [{ key: 'claude-session', value: SID }] }, children: [{ id: 'a1', topic: 'Design' }, { id: 'a2', topic: 'Tasks' }] },
  { id: 'b', topic: 'Design', children: [{ id: 'b1', topic: 'Notes' }] },
] } });

export async function workspace(allowWrite = true): Promise<{ dir: string; store: MapStore }> {
  const dir = await mkdtemp(join(tmpdir(), 'mmap-'));
  await writeFile(join(dir, 'plan.mmap'), serializeMindmap(sampleData()));
  return { dir, store: new MapStore({ workspace: dir, allowWrite }) };
}
