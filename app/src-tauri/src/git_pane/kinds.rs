pub const V1_KINDS: &[&str] = &[
    "refresh",
    "stage", "unstage", "stage-all", "unstage-all",
    "stage-patch", "unstage-patch", "discard-file", "discard-patch",
    "commit", "amend", "commit-and-push", "commit-and-force-push",
    "checkout", "create-branch", "delete-branch",
    "stash",
    "fetch", "pull", "push", "force-push",
];

pub fn is_allowed(kind: &str) -> bool {
    V1_KINDS.contains(&kind)
}
