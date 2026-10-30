// Ported from git-light (https://github.com/ftuyama/git-light) @ 56f2ce7
// Copyright (c) ftuyama — MIT License. Modified for SoloMD.

mod fetch;
mod parse_diff;
mod parse_misc;
mod search;
#[cfg(test)]
mod tests;

pub const REBASE_LOG_FORMAT: &str = "%H\x1f%h\x1f%s\x1f%an\x1f%at\x1e";

pub use fetch::*;
pub use parse_diff::*;
pub use parse_misc::*;
#[allow(unused_imports)]
pub use search::*;
