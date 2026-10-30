import type { ImagePasteOptions } from '../../../../lib/cm-image-paste';
import type { CitationEntry } from '../../../../lib/citations';
import type { Tab } from '../../../../types';

export interface PlainDeps {
  props: { tab: Tab; focusMode: boolean; typewriterMode: boolean; spellCheck: boolean };
  usePlainWindowsEditor: boolean;
  emitCursor(line: number, col: number): void;
  emitSelection(text: string): void;
  getCitations(): CitationEntry[];
  imagePasteOpts(): ImagePasteOptions;
}
