import { z } from 'zod';
import { DEFAULT_AI_RELEASE_DELAY_MS, DEFAULT_AI_STALE_MS, clampAiDelay } from '../../../../lib/ai-activity.ts';
import type { SettingsSlice } from '../../contracts/index.ts';

export type AiSettings = {
  aiReleaseDelayMs: number;
  aiStaleTimeoutMs: number;
  aiWarningAlwaysMinimized: boolean;
  // v4.0 first-run agent setup wizard. Shown once after the welcome tour to
  // route the user into BYOK or Ollama. Re-openable from Settings → AI.
  agentWizardSeen: boolean;
  // v4.0 pillar 1: Inline Agent Panel — chat-with-vault sidebar.
  showAgentPanel: boolean;
  // v4.0 pillar 1: when true, the agent can call write_note / append_to_note
  // from chat. Default off — the agent is read-only by default.
  agentAllowWrite: boolean;
  // v4.0 pillar 1: max number of LLM ↔ tool round-trips per chat turn.
  // Cap protects against a runaway tool loop. C3.2 default is 8.
  agentToolLoopCap: number;
  // v2.0 F4: BYOK AI rewrite. `aiProvider` is a stable id from
  // ai-providers.ts PROVIDERS — widened to string to avoid breaking when
  // new providers land.
  aiEnabled: boolean;
  aiProvider: string;
  aiModel: string;
  aiBaseUrl: string;
};

const schema = z.object({
  aiReleaseDelayMs: z.number(),
  aiStaleTimeoutMs: z.number(),
  aiWarningAlwaysMinimized: z.boolean(),
  agentWizardSeen: z.boolean(),
  showAgentPanel: z.boolean(),
  agentAllowWrite: z.boolean(),
  agentToolLoopCap: z.number(),
  aiEnabled: z.boolean(),
  aiProvider: z.string(),
  aiModel: z.string(),
  aiBaseUrl: z.string(),
});

function defaults(): AiSettings {
  return {
    aiReleaseDelayMs: DEFAULT_AI_RELEASE_DELAY_MS,
    aiStaleTimeoutMs: DEFAULT_AI_STALE_MS,
    aiWarningAlwaysMinimized: false,
    agentWizardSeen: false,
    showAgentPanel: true,
    agentAllowWrite: false,
    agentToolLoopCap: 8,
    aiEnabled: false,
    aiProvider: 'openai',
    aiModel: '',
    aiBaseUrl: '',
  };
}

export const aiSlice: SettingsSlice<AiSettings> = {
  id: 'ai',
  schema,
  defaults,
  normalize(parsed, merged) {
    merged.aiReleaseDelayMs = clampAiDelay(parsed.aiReleaseDelayMs, 'releaseDelayMs');
    merged.aiStaleTimeoutMs = clampAiDelay(parsed.aiStaleTimeoutMs, 'staleMs');
    merged.aiWarningAlwaysMinimized = parsed.aiWarningAlwaysMinimized === true;
  },
};
