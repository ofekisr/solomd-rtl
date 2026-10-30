import { generalActions } from './actions/general.actions.ts';
import { layoutActions } from './actions/layout.actions.ts';
import { explorerActions } from './actions/explorer.actions.ts';
import { previewActions } from './actions/preview.actions.ts';
import { appearanceActions } from './actions/appearance.actions.ts';
import { writingActions } from './actions/writing.actions.ts';
import { attachmentsActions } from './actions/attachments.actions.ts';
import { inboxActions } from './actions/inbox.actions.ts';
import { mindmapActions } from './actions/mindmap.actions.ts';
import { gitActions } from './actions/git.actions.ts';
import { integrationsActions } from './actions/integrations.actions.ts';
import { aiActions } from './actions/ai.actions.ts';
import { exportActions } from './actions/export.actions.ts';
import { appActions } from './actions/app.actions.ts';

export const SETTINGS_ACTIONS = {
  ...generalActions,
  ...layoutActions,
  ...explorerActions,
  ...previewActions,
  ...appearanceActions,
  ...writingActions,
  ...attachmentsActions,
  ...inboxActions,
  ...mindmapActions,
  ...gitActions,
  ...integrationsActions,
  ...aiActions,
  ...exportActions,
  ...appActions,
};
