import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as platform from './index.ts';

const PORT_COUNT = 18;
const unsupported = { name: 'PlatformUnsupportedError' };

const asyncCalls: Record<string, () => Promise<unknown>> = {
  fsPort: () => platform.fsPort.copyFile(undefined as never),
  androidPort: () => platform.androidPort.safPersistedTrees(),
  cloudPort: () => platform.cloudPort.deviceIdGetOrCreate(),
  convertPort: () => platform.convertPort.pandocDetect(),
  gitSyncPort: () => platform.gitSyncPort.giteaGetUrl(),
  gitHistoryPort: () => platform.gitHistoryPort.gitFileAtVersion(undefined as never),
  aiPort: () => platform.aiPort.aiCancel(undefined as never),
  aiToolsPort: () => platform.aiToolsPort.recipesDelete(undefined as never),
  ragPort: () => platform.ragPort.ragIndexStatus(undefined as never),
  settingsPort: () => platform.settingsPort.themeJsonList(),
  capturePort: () => platform.capturePort.captureGetState(),
  windowCommandsPort: () => platform.windowCommandsPort.forceCloseWindow(),
  eventsPort: () => platform.eventsPort.listen('x', () => undefined),
  dialogPort: () => platform.dialogPort.open({}),
  openerPort: () => platform.openerPort.openUrl('https://example.com'),
  clipboardPort: () => platform.clipboardPort.readText(),
  pathPort: () => platform.pathPort.homeDir(),
};

for (const [name, call] of Object.entries(asyncCalls)) {
  test(`${name} rejects with PlatformUnsupportedError off-desktop`, async () => {
    await assert.rejects(call, unsupported);
  });
}

test('windowPort.currentWindow throws synchronously off-desktop', () => {
  assert.throws(() => platform.windowPort.currentWindow(), unsupported);
});

test('every port is covered', () => {
  const exported = Object.keys(platform).filter((key) => key.endsWith('Port'));
  assert.equal(exported.length, PORT_COUNT);
  assert.equal(Object.keys(asyncCalls).length + 1, PORT_COUNT);
});
