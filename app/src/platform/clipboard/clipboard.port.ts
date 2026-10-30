declare const clipboardImageBrand: unique symbol;

export type ClipboardImage = { readonly [clipboardImageBrand]: true };

export type ClipboardImageBytes = number[] | Uint8Array | ArrayBuffer;

export interface ClipboardPort {
  readText(): Promise<string>;
  writeText(text: string): Promise<void>;
  writeHtml(html: string, altText?: string): Promise<void>;
  writeImage(image: ClipboardImage): Promise<void>;
  imageFromBytes(bytes: ClipboardImageBytes): Promise<ClipboardImage>;
}
