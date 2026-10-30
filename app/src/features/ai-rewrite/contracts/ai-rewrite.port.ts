import type { Extension } from '@codemirror/state';

export interface AiRewritePort {
  extension(cmKey: string): Extension;
  isLocked(filePath: string | undefined): boolean;
}
