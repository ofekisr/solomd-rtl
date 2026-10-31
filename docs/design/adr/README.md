# Architecture Decision Records

One file per decision that is expensive to reverse.

**Accepted ADRs are settled. Do not re-derive or re-argue them.** To change one, write a new ADR that supersedes it.

## Format

File: `NNNN-kebab-title.md`, numbered in order, never reused.

```markdown
# NNNN. Title

**Status**: accepted | superseded by NNNN · **Date**: YYYY-MM-DD

## Context
What forces the decision. Facts, numbers, links.

## Decision
What we do. One short paragraph or a list.

## Consequences
What gets easier, what gets harder, what we now must do.
```

## Rules

- Only `Status` changes after acceptance. Everything else is frozen.
- Link the spec the decision comes from.
- Keep it under one page.

## Index

| # | Title | Status |
|---|---|---|
| [0001](0001-wave-refactor.md) | Restructure solomd-rtl in waves | accepted |
| [0002](0002-arch-specs-not-eslint.md) | Architecture rules as `node --test` specs, not ESLint | accepted |
| [0003](0003-platform-ports.md) | Platform ports: command catalogs, generic adapters, report-mode Zod | accepted |
| [0004](0004-editor-feature-registry.md) | Editor features: an ordered registry of slots, commands and lifecycle hooks | accepted |
| [0005](0005-settings-slices.md) | Settings: typed slices over one flat blob, a versioned loader, and a page registry | accepted |
| [0006](0006-strict-ipc-validation-in-dev.md) | IPC validation: strict in dev, off in production | accepted |
| [0007](0007-settings-registry-as-shipped.md) | Settings registry as shipped | accepted |
| [0008](0008-plugins-folder.md) | One plugins/ folder and a Claude Code marketplace | accepted |
