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
