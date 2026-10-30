import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../lib/platform.ts';
import { PlatformUnsupportedError } from './ipc/platform-error.ts';
import type { InvokeFn } from './ipc/command.port.ts';
import { createValidation, resolveValidationMode } from './ipc/validation.service.ts';
import type { AiPort } from './ai/ai.port.ts';
import { createTauriAiPort } from './ai/ai.tauri.adapter.ts';
import { createWebAiPort } from './ai/ai.web.adapter.ts';
import type { AiToolsPort } from './ai-tools/ai-tools.port.ts';
import { createTauriAiToolsPort } from './ai-tools/ai-tools.tauri.adapter.ts';
import { createWebAiToolsPort } from './ai-tools/ai-tools.web.adapter.ts';
import type { AndroidPort } from './android/android.port.ts';
import { createTauriAndroidPort } from './android/android.tauri.adapter.ts';
import { createWebAndroidPort } from './android/android.web.adapter.ts';
import type { CapturePort } from './capture/capture.port.ts';
import { createTauriCapturePort } from './capture/capture.tauri.adapter.ts';
import { createWebCapturePort } from './capture/capture.web.adapter.ts';
import type { ClipboardPort } from './clipboard/clipboard.port.ts';
import { createTauriClipboardPort } from './clipboard/clipboard.tauri.adapter.ts';
import { createWebClipboardPort } from './clipboard/clipboard.web.adapter.ts';
import type { CloudPort } from './cloud/cloud.port.ts';
import { createTauriCloudPort } from './cloud/cloud.tauri.adapter.ts';
import { createWebCloudPort } from './cloud/cloud.web.adapter.ts';
import type { ConvertPort } from './convert/convert.port.ts';
import { createTauriConvertPort } from './convert/convert.tauri.adapter.ts';
import { createWebConvertPort } from './convert/convert.web.adapter.ts';
import type { DialogPort } from './dialog/dialog.port.ts';
import { createTauriDialogPort } from './dialog/dialog.tauri.adapter.ts';
import { createWebDialogPort } from './dialog/dialog.web.adapter.ts';
import type { EventsPort } from './events/events.port.ts';
import { createTauriEventsPort } from './events/events.tauri.adapter.ts';
import { createWebEventsPort } from './events/events.web.adapter.ts';
import type { FsPort } from './fs/fs.port.ts';
import { createTauriFsPort } from './fs/fs.tauri.adapter.ts';
import { createWebFsPort } from './fs/fs.web.adapter.ts';
import type { GitHistoryPort } from './git-history/git-history.port.ts';
import { createTauriGitHistoryPort } from './git-history/git-history.tauri.adapter.ts';
import { createWebGitHistoryPort } from './git-history/git-history.web.adapter.ts';
import type { GitPaneService } from '../lib/git-pane/service.ts';
import { createTauriGitPaneService } from './git-pane/git-pane.tauri.adapter.ts';
import type { GitSyncPort } from './git-sync/git-sync.port.ts';
import { createTauriGitSyncPort } from './git-sync/git-sync.tauri.adapter.ts';
import { createWebGitSyncPort } from './git-sync/git-sync.web.adapter.ts';
import type { OpenerPort } from './opener/opener.port.ts';
import { createTauriOpenerPort } from './opener/opener.tauri.adapter.ts';
import { createWebOpenerPort } from './opener/opener.web.adapter.ts';
import type { PathPort } from './path/path.port.ts';
import { createTauriPathPort } from './path/path.tauri.adapter.ts';
import { createWebPathPort } from './path/path.web.adapter.ts';
import type { RagPort } from './rag/rag.port.ts';
import { createTauriRagPort } from './rag/rag.tauri.adapter.ts';
import { createWebRagPort } from './rag/rag.web.adapter.ts';
import type { SettingsPort } from './settings/settings.port.ts';
import { createTauriSettingsPort } from './settings/settings.tauri.adapter.ts';
import { createWebSettingsPort } from './settings/settings.web.adapter.ts';
import type { WindowPort } from './window/window.port.ts';
export type { PlatformWebviewWindow } from './window/window.port.ts';
import { createTauriWindowPort } from './window/window.tauri.adapter.ts';
import { createWebWindowPort } from './window/window.web.adapter.ts';
import type { WindowCommandsPort } from './window/window-commands.port.ts';
import { createTauriWindowCommandsPort } from './window/window-commands.tauri.adapter.ts';
import { createWebWindowCommandsPort } from './window/window-commands.web.adapter.ts';

export type { UnlistenFn, PlatformEvent } from './events/events.port.ts';
export { PlatformUnsupportedError };

const isDesktop = isTauri();
const validation = createValidation(resolveValidationMode(import.meta.env));

export const fsPort: FsPort = isDesktop ? createTauriFsPort(invoke, validation) : createWebFsPort();
export const androidPort: AndroidPort = isDesktop ? createTauriAndroidPort(invoke, validation) : createWebAndroidPort();
export const cloudPort: CloudPort = isDesktop ? createTauriCloudPort(invoke, validation) : createWebCloudPort();
export const convertPort: ConvertPort = isDesktop ? createTauriConvertPort(invoke, validation) : createWebConvertPort();
export const gitSyncPort: GitSyncPort = isDesktop ? createTauriGitSyncPort(invoke, validation) : createWebGitSyncPort();
export const gitHistoryPort: GitHistoryPort = isDesktop
  ? createTauriGitHistoryPort(invoke, validation)
  : createWebGitHistoryPort();
export const aiPort: AiPort = isDesktop ? createTauriAiPort(invoke, validation) : createWebAiPort();
export const aiToolsPort: AiToolsPort = isDesktop ? createTauriAiToolsPort(invoke, validation) : createWebAiToolsPort();
export const ragPort: RagPort = isDesktop ? createTauriRagPort(invoke, validation) : createWebRagPort();
export const settingsPort: SettingsPort = isDesktop
  ? createTauriSettingsPort(invoke, validation)
  : createWebSettingsPort();
export const capturePort: CapturePort = isDesktop ? createTauriCapturePort(invoke, validation) : createWebCapturePort();
export const windowCommandsPort: WindowCommandsPort = isDesktop
  ? createTauriWindowCommandsPort(invoke, validation)
  : createWebWindowCommandsPort();
export const eventsPort: EventsPort = isDesktop ? createTauriEventsPort() : createWebEventsPort();
export const dialogPort: DialogPort = isDesktop ? createTauriDialogPort() : createWebDialogPort();
export const openerPort: OpenerPort = isDesktop ? createTauriOpenerPort() : createWebOpenerPort();
export const clipboardPort: ClipboardPort = isDesktop ? createTauriClipboardPort() : createWebClipboardPort();
export const pathPort: PathPort = isDesktop ? createTauriPathPort() : createWebPathPort();
export const windowPort: WindowPort = isDesktop ? createTauriWindowPort() : createWebWindowPort();

const rejectUnsupported: InvokeFn = (command) => Promise.reject(new PlatformUnsupportedError(command));

export const gitPaneService = (): GitPaneService =>
  createTauriGitPaneService(isDesktop ? invoke : rejectUnsupported, eventsPort.listen);
