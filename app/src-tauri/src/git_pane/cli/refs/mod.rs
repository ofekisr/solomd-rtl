// Ported from git-light (https://github.com/ftuyama/git-light) @ 56f2ce7
// Copyright (c) ftuyama — MIT License. Modified for SoloMD.

mod fetch;
mod ref_parsers;
mod status;
#[cfg(test)]
mod tests;
mod util;

pub const BRANCH_FORMAT: &str = "%(refname)\x1f%(objectname)\x1f%(HEAD)\x1f%(upstream:short)\x1f%(upstream:track)\x1f%(committerdate:iso-strict)";
pub const BRANCH_REFSPECS: [&str; 2] = ["refs/heads", "refs/remotes"];
pub const TAG_FORMAT: &str =
    "%(refname:short)\x1f%(objectname)\x1f%(*objectname)\x1f%(objecttype)\x1f%(creatordate:iso-strict)\x1f%(contents:subject)";
pub const STASH_FORMAT: &str = "%gd\x1f%ct\x1f%gs";

pub const FIELD: char = '\x1f';

pub use fetch::*;
pub use ref_parsers::*;
pub use status::*;
pub use util::*;
