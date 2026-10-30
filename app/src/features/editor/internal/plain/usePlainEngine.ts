import type { PlainApi } from './plain-api.ts';
import type { PlainDeps } from './plain-deps.ts';
import { createPlainState } from './usePlainState.ts';
import { usePlainGutter } from './usePlainGutter.ts';
import { usePlainFolds } from './usePlainFolds.ts';
import { usePlainRender } from './usePlainRender.ts';
import { usePlainOverlays } from './usePlainOverlays.ts';
import { usePlainFindBoxes } from './usePlainFindBoxes.ts';
import { usePlainFind } from './usePlainFind.ts';
import { usePlainAutocomplete } from './usePlainAutocomplete.ts';
import { usePlainKeys } from './usePlainKeys.ts';
import { usePlainBlockClicks } from './usePlainBlockClicks.ts';
import { usePlainBlockEditing } from './usePlainBlockEditing.ts';
import { usePlainContextMenu } from './usePlainContextMenu.ts';

export function usePlainEngine(deps: PlainDeps): PlainApi {
  const api = {} as PlainApi;
  Object.assign(api, createPlainState(deps, api));
  Object.assign(api, usePlainGutter(deps, api));
  Object.assign(api, usePlainFolds(deps, api));
  Object.assign(api, usePlainRender(deps, api));
  Object.assign(api, usePlainOverlays(deps, api));
  Object.assign(api, usePlainFindBoxes(deps, api));
  Object.assign(api, usePlainFind(deps, api));
  Object.assign(api, usePlainAutocomplete(deps, api));
  Object.assign(api, usePlainKeys(deps, api));
  Object.assign(api, usePlainBlockClicks(deps, api));
  Object.assign(api, usePlainBlockEditing(deps, api));
  Object.assign(api, usePlainContextMenu(deps, api));
  return api;
}
