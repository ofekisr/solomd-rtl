//! Typed git failure.

use serde::Serialize;

/// Typed git failure. Serializes to `SerializedGitError`
/// (`shared/git/errors.ts`): codes are PascalCase to match `GitErrorCode`.
#[derive(Debug, Clone, Serialize)]
pub struct GitError {
    #[serde(rename = "__gitError")]
    marker: bool,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub files: Option<Vec<String>>,
}

impl GitError {
    pub fn new(code: &str, message: String) -> Self {
        Self {
            marker: true,
            code: code.to_string(),
            message,
            detail: None,
            files: None,
        }
    }

    pub fn unknown(message: String) -> Self {
        Self::new("Unknown", message)
    }

    pub(crate) fn classified(
        code: &str,
        message: String,
        detail: Option<String>,
        files: Option<Vec<String>>,
    ) -> Self {
        Self {
            marker: true,
            code: code.to_string(),
            message,
            detail,
            files,
        }
    }
}
