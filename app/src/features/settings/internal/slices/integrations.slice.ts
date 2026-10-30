import { z } from 'zod';
import type { SettingsSlice } from '../../contracts/index.ts';

export type IntegrationsSettings = {
  // v2.0 F5: Pandoc + citations
  workspaceBibliography: string;
  workspaceCsl: string;
  // v2.3: Local RAG / semantic search. Off by default — when on, the
  // workspace is scanned + embedded into <workspace>/.solomd/embeddings.sqlite.
  ragEnabled: boolean;
  // Quick capture: a system-wide hotkey that opens a small box, takes a line
  // of text and files it in the Inbox without bringing the app forward. The
  // chord is an OS-level accelerator (Tauri's spelling, e.g.
  // `CmdOrCtrl+Alt+M`), not one of the rebindable in-app shortcuts, because
  // it has to work while another application is focused.
  quickCaptureEnabled: boolean;
  quickCaptureShortcut: string;
};

const schema = z.object({
  workspaceBibliography: z.string(),
  workspaceCsl: z.string(),
  ragEnabled: z.boolean(),
  quickCaptureEnabled: z.boolean(),
  quickCaptureShortcut: z.string(),
});

function defaults(): IntegrationsSettings {
  return {
    workspaceBibliography: '',
    workspaceCsl: '',
    ragEnabled: false,
    quickCaptureEnabled: true,
    quickCaptureShortcut: 'CmdOrCtrl+Alt+M',
  };
}

export const integrationsSlice: SettingsSlice<IntegrationsSettings> = {
  id: 'integrations',
  schema,
  defaults,
};
