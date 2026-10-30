import { createWebPort } from '../ipc/command.web.adapter.ts';
import { captureCommands, type CapturePort } from './capture.port.ts';

export function createWebCapturePort(): CapturePort {
  return createWebPort(captureCommands);
}
