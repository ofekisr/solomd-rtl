import { z } from 'zod';
import type { SettingsSlice } from '../../contracts/index.ts';

export type GitSettings = {
  // v2.2: AutoGit per-note version history
  autoGitEnabled: boolean;
  autoGitDebounceSeconds: number;
  /** Show the History pane in the right sidebar. v4.0.2: decoupled from
   *  autoGitEnabled so users can hide just the panel without disabling git
   *  sync entirely (issue #55 — Agent + History fighting for vertical space
   *  during conflict resolution). Defaults to true so existing AutoGit
   *  users see no behavior change. */
  showHistoryPanel: boolean;
  enableGitPane: boolean;
  gitTrustedRepos: string[];
  showGitCommit: boolean;
  showGitLog: boolean;
  gitDockHeight: number;
};

const schema = z.object({
  autoGitEnabled: z.boolean(),
  autoGitDebounceSeconds: z.number(),
  showHistoryPanel: z.boolean(),
  enableGitPane: z.boolean(),
  gitTrustedRepos: z.array(z.string()),
  showGitCommit: z.boolean(),
  showGitLog: z.boolean(),
  gitDockHeight: z.number(),
});

function defaults(): GitSettings {
  return {
    autoGitEnabled: false,
    autoGitDebounceSeconds: 30,
    showHistoryPanel: true,
    enableGitPane: true,
    gitTrustedRepos: [],
    showGitCommit: false,
    showGitLog: false,
    gitDockHeight: 280,
  };
}

export const gitSlice: SettingsSlice<GitSettings> = {
  id: 'git',
  schema,
  defaults,
  normalize(parsed, merged) {
    merged.gitTrustedRepos = Array.isArray(parsed.gitTrustedRepos)
      ? parsed.gitTrustedRepos.filter((root): root is string => typeof root === 'string')
      : [];
  },
};
