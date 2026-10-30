import * as clipboardModule from '@tauri-apps/plugin-clipboard-manager';
import type { Image } from '@tauri-apps/api/image';
import type { ClipboardImage, ClipboardImageBytes, ClipboardPort } from './clipboard.port.ts';

export type ClipboardModule = Pick<typeof clipboardModule, 'readText' | 'writeText' | 'writeHtml' | 'writeImage'>;
export type ImageModule = { Image: { fromBytes(bytes: ClipboardImageBytes): Promise<Image> } };

const loadImageModule = (): Promise<ImageModule> => import('@tauri-apps/api/image');

export function createTauriClipboardPort(
  mod: ClipboardModule = clipboardModule,
  loadImage: () => Promise<ImageModule> = loadImageModule,
): ClipboardPort {
  return {
    readText: () => mod.readText(),
    writeText: (text) => mod.writeText(text),
    writeHtml: (html, altText) => mod.writeHtml(html, altText),
    writeImage: (image) => mod.writeImage(image as unknown as Image),
    imageFromBytes: async (bytes) => {
      const { Image: TauriImage } = await loadImage();
      return (await TauriImage.fromBytes(bytes)) as unknown as ClipboardImage;
    },
  };
}
