import type { InvokeFn } from '../ipc/command.port.ts';
import { createTauriPort } from '../ipc/command.tauri.adapter.ts';
import type { Validation } from '../ipc/validation.service.ts';
import { captureCommands, type CapturePort } from './capture.port.ts';

export function createTauriCapturePort(invoke: InvokeFn, validation: Validation): CapturePort {
  return createTauriPort(captureCommands, invoke, validation);
}
