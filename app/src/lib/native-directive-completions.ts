import type { LoadedDirectiveCompletionManifest } from "./directive-completion-registry.ts";
import {
  applyDirectiveCompletion,
  completionContextAt,
  type DirectiveCompletionContext,
} from "./directive-completions.ts";

export interface NativeDirectiveCompletionItem {
  label: string;
  hint?: string;
  insert: string;
  cursorOffset: number;
}

export interface NativeDirectiveCompletion {
  from: number;
  to: number;
  items: readonly NativeDirectiveCompletionItem[];
  sharedContext: DirectiveCompletionContext;
}

export function nativeDirectiveCompletion(
  text: string,
  caret: number,
  manifests: readonly LoadedDirectiveCompletionManifest[],
): NativeDirectiveCompletion | null {
  const sharedContext = completionContextAt(text, caret, manifests);
  if (!sharedContext) return null;
  return {
    from: sharedContext.from,
    to: sharedContext.to,
    items: sharedContext.options.map((option) => ({
      label: option.label,
      hint: option.detail ?? option.info,
      insert: option.insertText,
      cursorOffset: option.cursorOffset,
    })),
    sharedContext,
  };
}

export function applyNativeDirectiveCompletion(
  text: string,
  completion: NativeDirectiveCompletion,
  index: number,
): { text: string; caret: number } {
  const option = completion.sharedContext.options[index];
  if (!option)
    throw new RangeError(`invalid directive completion index: ${index}`);
  return applyDirectiveCompletion(text, completion.sharedContext, option);
}
