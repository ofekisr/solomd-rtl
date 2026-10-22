import { ref } from 'vue';
import type { ConvertConflictChoice } from '../lib/convert-conflict';

export interface ConvertConflictAnswer {
  choice: ConvertConflictChoice;
  shouldRemember: boolean;
}

interface ConvertConflictPrompt {
  sourceName: string;
  targetName: string;
}

export const convertConflictPrompt = ref<ConvertConflictPrompt | null>(null);
let resolvePrompt: ((answer: ConvertConflictAnswer) => void) | null = null;

export function askConvertConflict(sourceName: string, targetName: string): Promise<ConvertConflictAnswer> {
  resolvePrompt?.({ choice: 'cancel', shouldRemember: false });
  convertConflictPrompt.value = { sourceName, targetName };
  return new Promise((resolve) => {
    resolvePrompt = resolve;
  });
}

export function answerConvertConflict(answer: ConvertConflictAnswer): void {
  convertConflictPrompt.value = null;
  const resolve = resolvePrompt;
  resolvePrompt = null;
  resolve?.(answer);
}
