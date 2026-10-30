import { clipboardPort } from '../../../platform/index.ts';

export async function writeClipboard(text: string): Promise<void> {
  try {
    await clipboardPort.writeText(text);
  } catch {
    await navigator.clipboard?.writeText(text);
  }
}

export async function readClipboard(): Promise<string> {
  try {
    return (await clipboardPort.readText()) ?? '';
  } catch {
    try {
      return (await navigator.clipboard?.readText()) ?? '';
    } catch {
      return '';
    }
  }
}
