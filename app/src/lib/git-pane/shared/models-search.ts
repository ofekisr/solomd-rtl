// Ported from git-light (https://github.com/ftuyama/git-light) @ 56f2ce7
// Copyright (c) ftuyama — MIT License. Modified for SoloMD.

import type { GraphScope, WireRepositorySnapshot } from './models-repo.ts'

/* ---------------------------- Search models ---------------------------- */

export interface SearchQuery {
  text: string
  fields?: ('message' | 'author' | 'sha')[]
  regex?: boolean
  limit?: number
  graphScope?: GraphScope
}

export interface SearchCommitHit {
  sha: string
  shortSha: string
  subject: string
  author: string
  date: string
}

export interface SearchResults {
  commits: SearchCommitHit[]
  files: string[]
}

/* ---------------------------- Action models ---------------------------- */

export interface RecentRepository {
  path: string
  name: string
  lastOpened: number
}

export interface OpenRepoResult {
  ok: boolean
  snapshot?: WireRepositorySnapshot
  error?: import('./errors.ts').SerializedGitError
}

/* ---------------------- Onboarding (clone/init/discover) ---------------------- */

export interface DiscoveredRepo {
  path: string
  name: string
}

export interface CloneRepoRequest {
  url: string
  parentPath: string
  name?: string
}

export interface InitRepoRequest {
  path: string
  defaultBranch?: string
}

export interface DiscoverReposRequest {
  root: string
  maxDepth?: number
}

export interface ExecutedGitCommand {
  /** Full argv without the leading `git`, e.g. `["fetch", "--all"]`. */
  argv: string[]
  /** Human-readable command line, e.g. `git fetch --all`. */
  command: string
  stdout: string
  stderr: string
  exitCode: number | null
  /** True when the command exited with 0 (or was allowed to fail). */
  ok: boolean
  /** True when stdout/stderr were truncated for transport. */
  truncated: boolean
}

export interface ActionEnvelope {
  ok: boolean
  message: string
  error?: import('./errors.ts').SerializedGitError
  /** Conflicted files when an operation stops mid-way. */
  conflicts?: string[]
  /** Every git CLI invocation executed for this action, in order. */
  commands?: ExecutedGitCommand[]
}
