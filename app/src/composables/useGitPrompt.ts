import { ref } from 'vue';

export interface GitPromptRequest {
  title: string;
  placeholder?: string;
}

const request = ref<GitPromptRequest | null>(null);
let resolver: ((value: string | null) => void) | null = null;

export function promptText(options: GitPromptRequest): Promise<string | null> {
  resolver?.(null);
  request.value = options;
  return new Promise((resolve) => {
    resolver = resolve;
  });
}

export function settlePrompt(value: string | null): void {
  const resolve = resolver;
  resolver = null;
  request.value = null;
  resolve?.(value);
}

export function useGitPrompt() {
  return { request, settlePrompt };
}
