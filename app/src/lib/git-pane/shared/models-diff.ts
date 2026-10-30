// Ported from git-light (https://github.com/ftuyama/git-light) @ 56f2ce7
// Copyright (c) ftuyama — MIT License. Modified for SoloMD.

/* ----------------------------- Diff models ----------------------------- */

export type DiffSource = 'worktree' | 'index' | 'commit' | 'range'

export interface DiffRequest {
  path: string
  source: DiffSource
  /** For source==='commit' or 'range'. */
  sha?: string
  toSha?: string
  ignoreWhitespace?: boolean
}

export interface CommitFilesRequest {
  sha: string
}

export interface CompareCommitsRequest {
  fromSha: string
  toSha: string
}

export interface DiffLine {
  type: 'context' | 'add' | 'del' | 'hunk' | 'meta'
  content: string
  oldLine: number | null
  newLine: number | null
}

export interface DiffHunk {
  header: string
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: DiffLine[]
}

export interface DiffResult {
  path: string
  oldPath?: string
  binary: boolean
  tooLarge: boolean
  language: string
  hunks: DiffHunk[]
  additions: number
  deletions: number
}

/* ------------------------- Image preview models ------------------------ */

export interface ImagePreviewRequest {
  path: string
  source: DiffSource
  /** For source==='commit' or 'range'. */
  sha?: string
  toSha?: string
}

export interface ImagePreviewSide {
  dataUrl: string
  sizeBytes: number
}

export interface ImagePreviewResult {
  path: string
  mime: string
  oldImage?: ImagePreviewSide | null
  newImage?: ImagePreviewSide | null
  tooLarge: boolean
}

/* ----------------------------- Blame models ---------------------------- */

export interface BlameRequest {
  path: string
  source: DiffSource
  sha?: string
  toSha?: string
}

export interface WireBlameLine {
  lineNumber: number
  commitSha: string
  shortSha: string
  author: string
  authorEmail: string
  authorTime: number
  summary?: string
  content: string
}

export interface BlameResult {
  path: string
  language: string
  lines: WireBlameLine[]
}

/* ------------------------ File history models ------------------------- */

export interface FileHistoryRequest {
  path: string
  limit?: number
}

export interface FileHistoryEntry {
  sha: string
  shortSha: string
  subject: string
  author: string
  date: string
}

export interface FileHistoryResult {
  path: string
  entries: FileHistoryEntry[]
}

/* --------------------------- Conflict models --------------------------- */

export interface ConflictRequest {
  path: string
}

export interface ConflictBlock {
  index: number
  oursLabel: string
  theirsLabel: string
  ours: string
  theirs: string
  base?: string
  startLine: number
  endLine: number
}

export interface ConflictVersions {
  base: string | null
  ours: string | null
  theirs: string | null
}

export interface ConflictResult {
  path: string
  binary: boolean
  hasMarkers: boolean
  blocks: ConflictBlock[]
  versions: ConflictVersions
}
