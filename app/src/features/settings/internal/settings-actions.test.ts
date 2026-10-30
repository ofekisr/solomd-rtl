import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aiActions } from './actions/ai.actions.ts';
import { appActions } from './actions/app.actions.ts';
import { appearanceActions } from './actions/appearance.actions.ts';
import { attachmentsActions } from './actions/attachments.actions.ts';
import { explorerActions } from './actions/explorer.actions.ts';
import { exportActions } from './actions/export.actions.ts';
import { generalActions } from './actions/general.actions.ts';
import { gitActions } from './actions/git.actions.ts';
import { inboxActions } from './actions/inbox.actions.ts';
import { integrationsActions } from './actions/integrations.actions.ts';
import { layoutActions } from './actions/layout.actions.ts';
import { mindmapActions } from './actions/mindmap.actions.ts';
import { previewActions } from './actions/preview.actions.ts';
import { writingActions } from './actions/writing.actions.ts';
import { SETTINGS_ACTIONS } from './settings-actions.ts';

const MIXINS: Record<string, object> = {
  aiActions, appActions, appearanceActions, attachmentsActions, explorerActions, exportActions, generalActions,
  gitActions, inboxActions, integrationsActions, layoutActions, mindmapActions, previewActions, writingActions,
};
const MIXIN_COUNT = 14;

test('the 14 action mixins define no duplicate action name', () => {
  assert.equal(Object.keys(MIXINS).length, MIXIN_COUNT);
  const owners = new Map<string, string[]>();
  for (const [mixin, actions] of Object.entries(MIXINS)) {
    for (const name of Object.keys(actions)) owners.set(name, [...(owners.get(name) ?? []), mixin]);
  }
  const duplicated = [...owners].filter(([, mixins]) => mixins.length > 1).map(([name, mixins]) => `${name}: ${mixins.join(', ')}`);
  assert.deepEqual(duplicated, []);
  assert.equal(Object.keys(SETTINGS_ACTIONS).length, owners.size);
});
